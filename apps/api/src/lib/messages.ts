import { z } from "zod";
import type { Conversation, Message } from "@prisma/client";
import { prisma } from "./prisma.js";
import { findMembership } from "./conversations.js";

export const MAX_MESSAGE_LENGTH = 2000;

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().max(MAX_MESSAGE_LENGTH, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters`),
  // Attachments are a stretch goal: the schema stores them, but uploads are not enabled yet
  attachments: z.array(z.unknown()).max(0, "Attachments are not supported yet").optional(),
  clientId: z.string().min(1).max(64).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

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
export async function sendMessage(senderId: string, input: unknown): Promise<SentMessage> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessageError(parsed.error.issues[0]?.message ?? "Invalid message");
  }

  const { conversationId, clientId } = parsed.data;
  const text = parsed.data.text.trim();
  if (!text) {
    throw new MessageError("Message cannot be empty");
  }

  const membership = await findMembership(conversationId, senderId);
  if (!membership) {
    throw new MessageError("Conversation not found");
  }

  const participants = await prisma.participant.findMany({ where: { conversationId } });
  if (participants.some((p) => p.blockedAt)) {
    throw new MessageError("This conversation is blocked");
  }

  if (clientId) {
    const existing = await prisma.message.findFirst({ where: { conversationId, senderId, clientId } });
    if (existing) {
      return {
        message: existing,
        conversation: membership.conversation,
        memberIds: participants.map((p) => p.userId),
        accepted: false,
      };
    }
  }

  const { conversation: before } = membership;
  // Replying to a request accepts it
  const accepted = before.type === "DIRECT" && before.status === "PENDING" && before.requestedById !== senderId;

  const message = await prisma.message.create({
    data: { conversationId, senderId, text, attachments: [], clientId: clientId ?? null },
  });

  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: { text: text.slice(0, 200), senderId, createdAt: message.createdAt },
      ...(accepted ? { status: "ACCEPTED" as const } : {}),
    },
  });

  // Your own message counts as read up to now
  await prisma.participant.update({
    where: { id: membership.participant.id },
    data: { lastReadAt: message.createdAt, ignoredAt: null },
  });

  return { message, conversation, memberIds: participants.map((p) => p.userId), accepted };
}
