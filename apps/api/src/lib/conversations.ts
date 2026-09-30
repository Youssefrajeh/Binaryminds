import type { Conversation, Message, Participant, Prisma } from "@prisma/client";
import type { ConversationDto, MessageDto } from "@campushub/shared";
import { prisma } from "./prisma.js";

/* ------------------------------------------------------------------ */
/*  Keys and membership                                                */
/* ------------------------------------------------------------------ */

/** Stable key for a 1:1 conversation, independent of who started it */
export function directKeyFor(userA: string, userB: string): string {
  return [userA, userB].sort().join("_");
}

export function groupKeyFor(studyGroupId: string): string {
  return `group:${studyGroupId}`;
}

export interface Membership {
  conversation: Conversation;
  participant: Participant;
}

/**
 * Returns the conversation and the caller's participant row, or null when the
 * user is not a member. Every conversation route and socket event goes through
 * this check.
 */
export async function findMembership(conversationId: string, userId: string): Promise<Membership | null> {
  const participant = await prisma.participant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: true },
  });
  if (!participant) return null;

  const { conversation, ...row } = participant;
  return { conversation, participant: row };
}

/* ------------------------------------------------------------------ */
/*  Unread counts                                                      */
/* ------------------------------------------------------------------ */

export function countUnread(conversationId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

/* ------------------------------------------------------------------ */
/*  DTO mapping                                                        */
/* ------------------------------------------------------------------ */

export const conversationInclude = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationWithMembers = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

function displayNameFor(user: { email: string; profile: { displayName: string } | null }) {
  return user.profile?.displayName || user.email.split("@")[0];
}

export function toConversationDto(
  conversation: ConversationWithMembers,
  userId: string,
  unreadCount: number
): ConversationDto {
  const members = conversation.participants.map((p) => ({
    id: p.user.id,
    displayName: displayNameFor(p.user),
    avatarUrl: p.user.profile?.avatarUrl ?? null,
  }));

  const other = members.find((m) => m.id !== userId);
  const me = conversation.participants.find((p) => p.userId === userId);
  const name =
    conversation.type === "GROUP" ? conversation.name ?? "Study group" : other?.displayName ?? "Conversation";

  return {
    id: conversation.id,
    type: conversation.type,
    name,
    status: conversation.status,
    isRequest:
      conversation.type === "DIRECT" &&
      conversation.status === "PENDING" &&
      conversation.requestedById !== userId,
    blockedByMe: Boolean(me?.blockedAt),
    studyGroupId: conversation.studyGroupId,
    members,
    lastMessage: conversation.lastMessage
      ? {
          text: conversation.lastMessage.text,
          senderId: conversation.lastMessage.senderId,
          createdAt: conversation.lastMessage.createdAt.toISOString(),
        }
      : null,
    unreadCount,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    attachments: message.attachments,
    clientId: message.clientId,
    createdAt: message.createdAt.toISOString(),
  };
}
