import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  conversationInclude,
  countUnread,
  directKeyFor,
  findMembership,
  toConversationDto,
  toMessageDto,
} from "../lib/conversations.js";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

const startSchema = z.object({
  recipientId: z.string().min(1, "recipientId is required"),
});

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
    const { recipientId } = parsed.data;

    if (recipientId === userId) {
      res.status(400).json({ error: "You cannot message yourself" });
      return;
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status !== "ACTIVE") {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const directKey = directKeyFor(userId, recipientId);

    let conversation = await prisma.conversation.findUnique({
      where: { directKey },
      include: conversationInclude,
    });
    let created = false;

    if (!conversation) {
      try {
        conversation = await prisma.conversation.create({
          data: {
            type: "DIRECT",
            status: "PENDING",
            requestedById: userId,
            directKey,
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

    res.status(created ? 201 : 200).json(toConversationDto(conversation, userId, unread));
  } catch (err) {
    console.error("Start conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /conversations?tab=inbox|requests                              */
/* ------------------------------------------------------------------ */

conversationsRouter.get("/", async (req, res) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "tab must be inbox or requests" });
      return;
    }

    const userId = req.user!.userId;
    const hasMessages: Prisma.ConversationWhereInput = { lastMessage: { isSet: true } };

    const tabFilter: Prisma.ConversationWhereInput =
      parsed.data.tab === "requests"
        ? { type: "DIRECT", status: "PENDING", requestedById: { not: userId }, ...hasMessages }
        : {
            OR: [
              { type: "GROUP" },
              { type: "DIRECT", status: "ACCEPTED", ...hasMessages },
              { type: "DIRECT", status: "PENDING", requestedById: userId, ...hasMessages },
            ],
          };

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some:
            parsed.data.tab === "requests"
              ? { userId, blockedAt: null, ignoredAt: null }
              : { userId, blockedAt: null },
        },
        ...tabFilter,
      },
      orderBy: { updatedAt: "desc" },
      include: conversationInclude,
    });

    const result = await Promise.all(
      conversations.map(async (conversation) => {
        const me = conversation.participants.find((p) => p.userId === userId)!;
        const unread = await countUnread(conversation.id, userId, me.lastReadAt);
        return toConversationDto(conversation, userId, unread);
      })
    );

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

    res.json(toConversationDto(conversation, userId, unread));
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
    const rows = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();

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
