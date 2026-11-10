import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { parseUpload, uploadSchema } from "../lib/files.js";
import { MessageError, sendMessage } from "../lib/messages.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { emitToUsers } from "../socket/io.js";
import {
  conversationInclude,
  conversationSummaryInclude,
  conversationWhere,
  unreadCounts,
  toConversationSummaryDto,
  countUnread,
  directKeyFor,
  findMembership,
  toConversationDto,
  toMessageDto,
  withChatThumbnails,
} from "../lib/conversations.js";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

const uploadLimiter = createRateLimiter(10, 60_000);

/* ------------------------------------------------------------------ */
/*  POST /conversations/:id/files — share a file as a message          */
/* ------------------------------------------------------------------ */

conversationsRouter.post("/:id/files", async (req, res) => {
  const userId = req.user!.userId;
  if (!uploadLimiter.tryConsume(userId)) {
    res.status(429).json({ error: "You're sharing files too quickly. Please wait a minute." });
    return;
  }
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid file" });
    return;
  }
  const { name, data, text, clientId } = parsed.data;
  const upload = parseUpload(name, data);
  if (typeof upload === "string") {
    res.status(400).json({ error: upload });
    return;
  }
  try {
    const { message, memberIds, accepted } = await sendMessage(userId, { conversationId: req.params.id, text: text ?? "", clientId }, upload);
    const dto = toMessageDto(message);
    emitToUsers(memberIds, "message:new", { message: dto, accepted });
    res.status(201).json(dto);
  } catch (err) {
    if (err instanceof MessageError) {
      res.status(err.message === "Conversation not found" ? 404 : 409).json({ error: err.message });
      return;
    }
    console.error("File share error:", err);
    res.status(500).json({ error: "Could not share this file" });
  }
});

const startSchema = z.object({
  recipientId: z.string().min(1, "recipientId is required"),
  // Set when the chat is started from a listing page
  listingId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
}).refine(({ listingId, eventId }) => !(listingId && eventId), "Choose either an event or a listing");

const listSchema = z.object({
  tab: z.enum(["inbox", "requests"]).default("inbox"),
});

const messagesSchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/* ------------------------------------------------------------------ */
/*  POST /conversations — find or create a DM                          */
/* ------------------------------------------------------------------ */

conversationsRouter.post("/", async (req, res) => {
  try {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
      return;
    }

    const userId = req.user!.userId;
    const { recipientId, listingId, eventId } = parsed.data;

    if (recipientId === userId) {
      res.status(400).json({ error: "You cannot message yourself" });
      return;
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status !== "ACTIVE") {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing || listing.status !== "ACTIVE" || (listing.sellerId !== recipientId && listing.sellerId !== userId)) {
        res.status(400).json({ error: "This listing is unavailable or neither participant is its seller" });
        return;
      }
    }

    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.status !== "PUBLISHED" || event.organizerId !== recipientId) {
        res.status(400).json({ error: "This event is unavailable or belongs to a different organizer" });
        return;
      }
    }

    const pairKey = directKeyFor(userId, recipientId);
    const directKey = eventId ? `event:${eventId}:${pairKey}` : listingId ? `listing:${listingId}:${pairKey}` : `direct:${pairKey}`;

    let conversation = await prisma.conversation.findUnique({
      where: { directKey },
      include: conversationInclude,
    });
    // Older DMs used only the member pair as their key. Reuse their history
    // only when its context matches; never merge an ad chat with a general DM.
    if (!conversation && !eventId) {
      const legacy = await prisma.conversation.findUnique({ where: { directKey: pairKey }, include: conversationInclude });
      if (legacy?.type === "DIRECT" && !legacy.eventId &&
          (listingId ? legacy.listingId === listingId : !legacy.listingId)) {
        conversation = legacy;
      }
    }
    let created = false;

    if (!conversation) {
      try {
        conversation = await prisma.conversation.create({
          data: {
            type: "DIRECT",
            status: "PENDING",
            requestedById: userId,
            directKey,
            ...(listingId ? { listingId } : {}),
            ...(eventId ? { eventId } : {}),
            participants: { create: [{ userId }, { userId: recipientId }] },
          },
          include: conversationInclude,
        });
        created = true;
      } catch (err) {
        // Two requests raced to create the same DM — use the one that won
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          conversation = await prisma.conversation.findUniqueOrThrow({
            where: { directKey },
            include: conversationInclude,
          });
        } else {
          throw err;
        }
      }
    }

    const me = conversation.participants.find((p) => p.userId === userId);
    if (me && (me.blockedAt || me.ignoredAt)) {
      // Choosing to message someone again undoes my own block or ignore
      await prisma.participant.update({ where: { id: me.id }, data: { blockedAt: null, ignoredAt: null } });
    }
    const unread = me ? await countUnread(conversation.id, userId, me.lastReadAt) : 0;

    res.status(created ? 201 : 200).json(toConversationDto(await withChatThumbnails(conversation), userId, unread));
  } catch (err) {
    console.error("Start conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /conversations?tab=inbox|requests                              */
/* ------------------------------------------------------------------ */

conversationsRouter.get("/counts", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [inbox, requestCount] = await Promise.all([
      prisma.conversation.findMany({ where: conversationWhere(userId, "inbox"), select: { id: true, participants: { where: { userId }, select: { lastReadAt: true } } } }),
      prisma.conversation.count({ where: conversationWhere(userId, "requests") }),
    ]);
    const counts = await unreadCounts(userId, inbox.map((conversation) => ({ conversationId: conversation.id, lastReadAt: conversation.participants[0]?.lastReadAt ?? null })));
    res.json({ unreadTotal: [...counts.values()].reduce((sum, count) => sum + count, 0), requestCount });
  } catch (err) {
    console.error("Conversation counts error:", err);
    res.status(500).json({ error: "Could not load notification counts" });
  }
});

conversationsRouter.get("/", async (req, res) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "tab must be inbox or requests" });
      return;
    }

    const userId = req.user!.userId;
    const conversations = await prisma.conversation.findMany({
      where: conversationWhere(userId, parsed.data.tab),
      orderBy: { updatedAt: "desc" },
      include: conversationSummaryInclude,
    });
    const counts = await unreadCounts(userId, conversations.map((conversation) => ({
      conversationId: conversation.id,
      lastReadAt: conversation.participants.find((member) => member.userId === userId)?.lastReadAt ?? null,
    })));
    const result = conversations.map((conversation) => toConversationSummaryDto(conversation, userId, counts.get(conversation.id) ?? 0));

    res.json(result);
  } catch (err) {
    console.error("List conversations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /conversations/:id                                             */
/* ------------------------------------------------------------------ */

conversationsRouter.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const membership = await findMembership(req.params.id, userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: conversationInclude,
    });
    const unread = await countUnread(conversation.id, userId, membership.participant.lastReadAt);

    res.json(toConversationDto(await withChatThumbnails(conversation), userId, unread));
  } catch (err) {
    console.error("Get conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /conversations/:id/messages?before=<ISO>&limit=30              */
/* ------------------------------------------------------------------ */

conversationsRouter.get("/:id/messages", async (req, res) => {
  try {
    const parsed = messagesSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
      return;
    }

    const membership = await findMembership(req.params.id, req.user!.userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { before, limit } = parsed.data;

    // Cursor pagination: newest first, one extra row tells us if there is more
    let rows = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    let hasMore = rows.length > limit;
    const extra = rows[limit];
    rows = rows.slice(0, limit);

    // The cursor is a timestamp, so messages sharing the oldest timestamp must
    // all land on this page or the next request (createdAt < cursor) would skip them
    const boundary = rows[rows.length - 1]?.createdAt;
    if (hasMore && extra && boundary && extra.createdAt.getTime() === boundary.getTime()) {
      const ties = await prisma.message.findMany({
        where: { conversationId: req.params.id, createdAt: boundary },
        orderBy: { createdAt: "desc" },
      });
      if (ties.length > 1) {
        rows = [...rows.filter((m) => m.createdAt.getTime() !== boundary.getTime()), ...ties];
        hasMore =
          (await prisma.message.findFirst({
            where: { conversationId: req.params.id, createdAt: { lt: boundary } },
            select: { id: true },
          })) !== null;
      }
    }

    const page = rows.reverse();

    res.json({
      messages: page.map(toMessageDto),
      hasMore,
      nextCursor: hasMore ? page[0].createdAt.toISOString() : null,
    });
  } catch (err) {
    console.error("List messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /conversations/:id/read                                      */
/* ------------------------------------------------------------------ */

conversationsRouter.patch("/:id/read", async (req, res) => {
  try {
    const membership = await findMembership(req.params.id, req.user!.userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await prisma.participant.update({
      where: { id: membership.participant.id },
      data: { lastReadAt: new Date() },
    });

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /conversations/:id/accept                                    */
/* ------------------------------------------------------------------ */

conversationsRouter.patch("/:id/accept", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const membership = await findMembership(req.params.id, userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { conversation } = membership;
    if (conversation.type !== "DIRECT" || conversation.status !== "PENDING" || conversation.requestedById === userId) {
      res.status(400).json({ error: "There is no message request to accept" });
      return;
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "ACCEPTED" },
    });

    // The requester's chat drops its "waiting for them to accept" state without a reload
    const members = await prisma.participant.findMany({ where: { conversationId: conversation.id }, select: { userId: true } });
    emitToUsers(members.map((member) => member.userId), "conversation:updated", { conversationId: conversation.id });

    res.json({ message: "Request accepted" });
  } catch (err) {
    console.error("Accept conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /conversations/:id/block                                     */
/* ------------------------------------------------------------------ */

conversationsRouter.patch("/:id/block", async (req, res) => {
  try {
    const membership = await findMembership(req.params.id, req.user!.userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (membership.conversation.type !== "DIRECT") {
      res.status(400).json({ error: "Only direct conversations can be blocked" });
      return;
    }

    await prisma.participant.update({
      where: { id: membership.participant.id },
      data: { blockedAt: membership.participant.blockedAt ?? new Date() },
    });

    res.json({ message: "Conversation blocked" });
  } catch (err) {
    console.error("Block conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /conversations/:id/ignore                                    */
/* ------------------------------------------------------------------ */

conversationsRouter.patch("/:id/ignore", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const membership = await findMembership(req.params.id, userId);
    if (!membership) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { conversation } = membership;
    if (conversation.type !== "DIRECT" || conversation.status !== "PENDING" || conversation.requestedById === userId) {
      res.status(400).json({ error: "There is no message request to ignore" });
      return;
    }

    // Hidden from my requests; the sender is not told
    await prisma.participant.update({
      where: { id: membership.participant.id },
      data: { ignoredAt: new Date(), lastReadAt: new Date() },
    });

    res.json({ message: "Request ignored" });
  } catch (err) {
    console.error("Ignore conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
