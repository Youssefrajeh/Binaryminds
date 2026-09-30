import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { createApp } from "../app.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();

const ALICE = "alice";
const BOB = "bob";
const aliceAuth = `Bearer ${signToken({ userId: ALICE, role: "STUDENT" })}`;

function member(userId: string, extra: Record<string, unknown> = {}) {
  return {
    id: `p-${userId}`,
    userId,
    conversationId: "c1",
    joinedAt: new Date("2026-09-01T00:00:00Z"),
    lastReadAt: null,
    blockedAt: null,
    user: { id: userId, email: `${userId}@fanshaweonline.ca`, profile: null },
    ...extra,
  };
}

function directConversation(extra: Record<string, unknown> = {}) {
  return {
    id: "c1",
    type: "DIRECT",
    name: null,
    studyGroupId: null,
    status: "PENDING",
    requestedById: BOB,
    directKey: "alice_bob",
    lastMessage: null,
    listingId: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-02T00:00:00Z"),
    participants: [member(ALICE), member(BOB)],
    ...extra,
  };
}

function membershipRow(conversation = directConversation()) {
  const { participants, ...plain } = conversation;
  return { ...participants[0], user: undefined, conversation: plain };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.message.count.mockResolvedValue(0);
});

describe("auth", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/conversations");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid token", async () => {
    const res = await request(app).get("/api/conversations").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/conversations", () => {
  it("refuses to start a conversation with yourself", async () => {
    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: ALICE });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown or inactive recipients", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "PENDING" });

    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });
    expect(res.status).toBe(404);
  });

  it("creates a pending DM requested by the caller", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(directConversation({ requestedById: ALICE }));

    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });

    expect(res.status).toBe(201);
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", requestedById: ALICE, directKey: "alice_bob" }),
      })
    );
    expect(res.body).toMatchObject({ id: "c1", name: "bob", isRequest: false });
  });

  it("returns the existing DM instead of creating a duplicate", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(directConversation());

    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });

    expect(res.status).toBe(200);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(res.body.isRequest).toBe(true);
  });

  it("recovers when a concurrent request created the DM first", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    );
    prisma.conversation.findUniqueOrThrow.mockResolvedValue(directConversation());

    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("c1");
  });
});

describe("GET /api/conversations", () => {
  it("rejects unknown tabs", async () => {
    const res = await request(app).get("/api/conversations?tab=spam").set("Authorization", aliceAuth);
    expect(res.status).toBe(400);
  });

  it("lists requests started by others with unread counts", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      directConversation({ lastMessage: { text: "Is the book still available?", senderId: BOB, createdAt: new Date() } }),
    ]);
    prisma.message.count.mockResolvedValue(2);

    const res = await request(app).get("/api/conversations?tab=requests").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    const where = prisma.conversation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      participants: { some: { userId: ALICE, blockedAt: null } },
      status: "PENDING",
      requestedById: { not: ALICE },
    });
    expect(res.body[0]).toMatchObject({ isRequest: true, unreadCount: 2 });
  });
});

describe("membership check", () => {
  it.each([
    ["get", "/api/conversations/c1"],
    ["get", "/api/conversations/c1/messages"],
    ["patch", "/api/conversations/c1/read"],
    ["patch", "/api/conversations/c1/accept"],
    ["patch", "/api/conversations/c1/block"],
    ["patch", "/api/conversations/c1/ignore"],
  ] as const)("%s %s returns 404 for non-members", async (method, url) => {
    prisma.participant.findUnique.mockResolvedValue(null);

    const res = await request(app)[method](url).set("Authorization", aliceAuth);

    expect(res.status).toBe(404);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(prisma.participant.update).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversations/:id/messages", () => {
  it("pages with a createdAt cursor, oldest-first within the page", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());
    const newest = new Date("2026-09-03T10:00:03Z");
    prisma.message.findMany.mockResolvedValue(
      [3, 2, 1].map((n) => ({
        id: `m${n}`,
        conversationId: "c1",
        senderId: BOB,
        text: `hi ${n}`,
        attachments: [],
        clientId: null,
        createdAt: new Date(newest.getTime() - (3 - n) * 1000),
      }))
    );

    const before = "2026-09-04T00:00:00.000Z";
    const res = await request(app)
      .get(`/api/conversations/c1/messages?before=${before}&limit=2`)
      .set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: "c1", createdAt: { lt: new Date(before) } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(["m2", "m3"]);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe(res.body.messages[0].createdAt);
  });

  it("rejects a malformed cursor", async () => {
    const res = await request(app).get("/api/conversations/c1/messages?before=yesterday").set("Authorization", aliceAuth);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/conversations/:id/accept", () => {
  it("lets the recipient accept a pending request", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());

    const res = await request(app).patch("/api/conversations/c1/accept").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.conversation.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "ACCEPTED" } });
  });

  it("does not let the requester accept their own request", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow(directConversation({ requestedById: ALICE })));

    const res = await request(app).patch("/api/conversations/c1/accept").set("Authorization", aliceAuth);

    expect(res.status).toBe(400);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/conversations/:id/block", () => {
  it("marks the caller's membership as blocked", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());

    const res = await request(app).patch("/api/conversations/c1/block").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.participant.update).toHaveBeenCalledWith({
      where: { id: "p-alice" },
      data: { blockedAt: expect.any(Date) },
    });
  });
});

describe("PATCH /api/conversations/:id/ignore", () => {
  it("hides a request from the recipient without telling the sender", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());

    const res = await request(app).patch("/api/conversations/c1/ignore").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.participant.update).toHaveBeenCalledWith({
      where: { id: "p-alice" },
      data: { ignoredAt: expect.any(Date), lastReadAt: expect.any(Date) },
    });
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it("refuses to ignore an accepted conversation", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow(directConversation({ status: "ACCEPTED" })));

    const res = await request(app).patch("/api/conversations/c1/ignore").set("Authorization", aliceAuth);

    expect(res.status).toBe(400);
    expect(prisma.participant.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversations/:id", () => {
  it("returns the conversation for members, including my block state", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());
    prisma.conversation.findUniqueOrThrow.mockResolvedValue(
      directConversation({ participants: [member(ALICE, { blockedAt: new Date() }), member(BOB)] })
    );

    const res = await request(app).get("/api/conversations/c1").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "c1", name: "bob", blockedByMe: true });
  });
});

describe("POST /api/conversations after blocking", () => {
  it("messaging someone again clears my own block", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(
      directConversation({ participants: [member(ALICE, { blockedAt: new Date() }), member(BOB)] })
    );

    const res = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });

    expect(res.status).toBe(200);
    expect(prisma.participant.update).toHaveBeenCalledWith({
      where: { id: "p-alice" },
      data: { blockedAt: null, ignoredAt: null },
    });
  });
});
