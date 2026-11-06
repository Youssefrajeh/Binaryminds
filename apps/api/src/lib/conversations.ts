import type { Conversation, Message, Participant, Prisma } from "@prisma/client";
import type { ConversationDto, ConversationSummaryDto, MessageDto } from "@campushub/shared";
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

export async function unreadCounts(userId: string, memberships: { conversationId: string; lastReadAt: Date | null }[]) {
  const counts = new Map<string, number>();
  // Bound the query expression even for accounts with a long chat history.
  for (let offset = 0; offset < memberships.length; offset += 200) {
    const rows = await prisma.message.groupBy({
      by: ["conversationId"],
      where: { senderId: { not: userId }, OR: memberships.slice(offset, offset + 200).map((member) => ({ conversationId: member.conversationId, ...(member.lastReadAt ? { createdAt: { gt: member.lastReadAt } } : {}) })) },
      _count: { _all: true },
    });
    for (const row of rows) counts.set(row.conversationId, row._count._all);
  }
  return counts;
}

export function conversationWhere(userId: string, tab: "inbox" | "requests"): Prisma.ConversationWhereInput {
  const hasMessages = { lastMessage: { isSet: true } };
  return {
    participants: { some: { userId, AND: [
      { OR: [{ blockedAt: null }, { blockedAt: { isSet: false } }] },
      ...(tab === "requests" ? [{ OR: [{ ignoredAt: null }, { ignoredAt: { isSet: false } }] }] : []),
    ] } },
    ...(tab === "requests" ? { type: "DIRECT", status: "PENDING", requestedById: { not: userId }, ...hasMessages } : {
      OR: [{ type: "GROUP" }, { type: "DIRECT", status: "ACCEPTED", ...hasMessages }, { type: "DIRECT", status: "PENDING", requestedById: userId, ...hasMessages }],
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  DTO mapping                                                        */
/* ------------------------------------------------------------------ */

export const conversationInclude = {
  listing: { select: {
    id: true, title: true, description: true, priceCents: true, condition: true, status: true,
    images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    seller: { select: { profile: { select: { displayName: true } } } },
  } },
  event: { include: { organizer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } } },
  participants: {
    // MongoDB can retain participant rows after an account is removed externally.
    // Filter the relation before Prisma attempts to materialize its required user.
    where: { user: { is: {} } },
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

export const conversationSummaryInclude = {
  ...conversationInclude,
  listing: { select: { id: true, title: true } },
  event: { select: { id: true, title: true } },
} satisfies Prisma.ConversationInclude;

export function toConversationSummaryDto(conversation: Prisma.ConversationGetPayload<{ include: typeof conversationSummaryInclude }>, userId: string, unreadCount: number): ConversationSummaryDto {
  return { ...toConversationDto({ ...conversation, listing: null, event: null }, userId, unreadCount), listing: conversation.listing, event: conversation.event };
}

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
    conversation.type === "GROUP" ? conversation.name ?? "Study group" : other?.displayName ?? "Deleted account";

  return {
    id: conversation.id,
    listing: conversation.listing ? {
      id: conversation.listing.id,
      title: conversation.listing.title,
      description: conversation.listing.description,
      priceCents: conversation.listing.priceCents,
      condition: conversation.listing.condition,
      status: conversation.listing.status,
      imageUrl: conversation.listing.images[0]?.url ?? null,
      sellerName: conversation.listing.seller.profile?.displayName || "campus-hub seller",
    } : null,
    event: conversation.event ? {
      ...conversation.event,
      startsAt: conversation.event.startsAt.toISOString(),
      endsAt: conversation.event.endsAt?.toISOString() ?? null,
    } : null,
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
    removedAt: message.removedAt?.toISOString() ?? null,
    attachments: message.attachments,
    clientId: message.clientId,
    createdAt: message.createdAt.toISOString(),
  };
}
