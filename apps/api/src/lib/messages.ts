import { z } from "zod";
import { Prisma, type Conversation, type Message } from "@prisma/client";
import { sharedFileUrl } from "@campushub/shared";
import type { SharedUpload } from "./files.js";
import { prisma } from "./prisma.js";

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PENDING_MESSAGES = 3;

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().max(MAX_MESSAGE_LENGTH, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters`),
  // Files arrive through POST /conversations/:id/files, so socket clients cannot forge attachments
  attachments: z.array(z.unknown()).max(0, "Attachments are not supported yet").optional(),
  clientId: z.string().min(1).max(64).optional(),
});

export class MessageError extends Error {}

export interface SentMessage {
  message: Message;
  conversation: Conversation;
  memberIds: string[];
  /** True when this message was a reply that accepted a pending request */
  accepted: boolean;
}

/**
 * Saves a message after checking the sender belongs to the conversation and
 * nobody in it has blocked the other. Retries with the same clientId return
 * the original message instead of creating a duplicate.
 */
export async function sendMessage(senderId: string, input: unknown, upload?: SharedUpload): Promise<SentMessage> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessageError(parsed.error.issues[0]?.message ?? "Invalid message");
  }

  const { conversationId, clientId } = parsed.data;
  const text = parsed.data.text.trim() || (upload ? `Shared ${upload.name}` : "");
  if (!text) {
    throw new MessageError("Message cannot be empty");
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (db) => {
        const participant = await db.participant.findUnique({ where: { conversationId_userId: { conversationId, userId: senderId } }, include: { conversation: true } });
        if (!participant) {
          throw new MessageError("Conversation not found");
        }

        const participants = await db.participant.findMany({ where: { conversationId } });
        if (participants.some((p) => p.blockedAt)) {
          throw new MessageError("This conversation is blocked");
        }

        if (clientId) {
          const existing = await db.message.findFirst({ where: { conversationId, senderId, clientId } });
          if (existing) {
            return {
              message: existing,
              conversation: participant.conversation,
              memberIds: participants.map((p) => p.userId),
              accepted: false,
            };
          }
        }

        const before = participant.conversation;

        const pending = before.type === "DIRECT" && before.status === "PENDING";
        // A stranger's message request should not be able to deliver a file
        if (upload && pending) {
          throw new MessageError("Files can be shared once your message request is accepted");
        }
        const first = pending && !before.lastMessage ? await db.message.findFirst({ where: { conversationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }) : null;
        const requester = before.lastMessage ? before.requestedById : first?.senderId ?? senderId;

        // Until the recipient accepts, a requester may only send a few opening messages
        if (pending && requester === senderId) {
          const sent = await db.message.count({ where: { conversationId, senderId } });
          if (sent >= MAX_PENDING_MESSAGES) {
            throw new MessageError("Wait for them to accept your request before sending more messages");
          }
        }

        // Replying to a request accepts it
        const accepted = pending && Boolean(before.lastMessage || first) && requester !== senderId;

        const message = await db.message.create({
          data: {
            conversationId, senderId, text, clientId: clientId ?? null,
            attachments: upload ? [{ url: sharedFileUrl(upload.id), name: upload.name, mimeType: upload.mimeType, size: upload.size }] : [],
          },
        });

        if (upload) {
          const group = before.studyGroupId ? await db.studyGroup.findUnique({ where: { id: before.studyGroupId }, select: { courseCode: true } }) : null;
          await db.sharedFile.create({
            data: { ...upload, uploaderId: senderId, conversationId, messageId: message.id, courseCode: group?.courseCode ?? null, removedAt: null },
          });
        }

        const conversation = await db.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: { text: text.slice(0, 200), senderId, createdAt: message.createdAt },
            ...(pending && !before.lastMessage ? { requestedById: requester } : {}),
            ...(accepted ? { status: "ACCEPTED" as const } : {}),
          },
        });

        // Your own message counts as read up to now
        await db.participant.update({
          where: { id: participant.id },
          data: { lastReadAt: message.createdAt, ignoredAt: null },
        });

        return { message, conversation, memberIds: participants.map((p) => p.userId), accepted };
      });
    } catch (err) {
      if (attempt < 2 && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") continue;
      throw err;
    }
  }
}
