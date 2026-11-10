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
  // Chat cards look up thumbnails for photos saved before they existed
  prisma.event.findMany.mockResolvedValue([]);
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
  const campusEvent = {
    id: "e1", organizerId: BOB, title: "Soccer League", description: "Bring your team", location: "BMO Centre",
    startsAt: new Date("2099-01-01T18:00:00Z"), endsAt: null, endDate: "2099-01-20", imageUrl: null, status: "PUBLISHED",
    organizer: { id: BOB, profile: { displayName: "Bob" } },
  };

  it("creates an event-specific DM with durable event details", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.event.findUnique.mockResolvedValue(campusEvent);
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(directConversation({ eventId: "e1", event: campusEvent }));
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, eventId: "e1" });
    expect(response.status).toBe(201);
    expect(prisma.conversation.create.mock.calls[0][0].data).toMatchObject({ eventId: "e1", directKey: "event:e1:alice_bob" });
    expect(response.body.event).toMatchObject({ id: "e1", title: "Soccer League", endsAt: null, endDate: "2099-01-20" });
  });

  it("reuses the same event DM without replacing a general DM's context", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.event.findUnique.mockResolvedValue(campusEvent);
    prisma.conversation.findUnique.mockResolvedValue(directConversation({ event: campusEvent }));
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, eventId: "e1" });
    expect(response.status).toBe(200);
    expect(prisma.conversation.findUnique.mock.calls[0][0].where.directKey).toBe("event:e1:alice_bob");
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it.each([null, { ...campusEvent, status: "CANCELLED" }, { ...campusEvent, status: "DRAFT" }, { ...campusEvent, organizerId: "carol" }])("rejects unavailable or mismatched event context", async (event) => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.event.findUnique.mockResolvedValue(event);
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, eventId: "e1" });
    expect(response.status).toBe(400);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("rejects ambiguous event and listing context", async () => {
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, eventId: "e1", listingId: "l1" });
    expect(response.status).toBe(400);
  });

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
        data: expect.objectContaining({ status: "PENDING", requestedById: ALICE, directKey: "direct:alice_bob" }),
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

  it("links a new conversation to the listing it was started from", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", sellerId: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(directConversation({ requestedById: ALICE, listingId: "l1" }));

    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", aliceAuth)
      .send({ recipientId: BOB, listingId: "l1" });

    expect(res.status).toBe(201);
    expect(prisma.conversation.create.mock.calls[0][0].data.listingId).toBe("l1");
    expect(prisma.conversation.create.mock.calls[0][0].data.directKey).toBe("listing:l1:alice_bob");
  });

  it("lets the seller start a separate ad chat with a buyer", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", sellerId: ALICE, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(directConversation({ listingId: "l1", requestedById: ALICE }));
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, listingId: "l1" });
    expect(response.status).toBe(201);
    expect(prisma.conversation.create.mock.calls[0][0].data).toMatchObject({ listingId: "l1", status: "PENDING", directKey: "listing:l1:alice_bob" });
  });

  it("reuses a legacy chat for the same ad without discarding its history", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", sellerId: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(directConversation({ listingId: "l1" }));
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB, listingId: "l1" });
    expect(response.status).toBe(200);
    expect(response.body.id).toBe("c1");
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("does not reuse a legacy ad chat for a general profile DM", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(directConversation({ listingId: "l1", status: "ACCEPTED" }));
    prisma.conversation.create.mockResolvedValue(directConversation({ id: "general", requestedById: ALICE }));
    const response = await request(app).post("/api/conversations").set("Authorization", aliceAuth).send({ recipientId: BOB });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe("general");
    expect(prisma.conversation.create.mock.calls[0][0].data.directKey).toBe("direct:alice_bob");
  });

  it("rejects a listing that is not the recipient's", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", sellerId: "carol", status: "ACTIVE" });

    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", aliceAuth)
      .send({ recipientId: BOB, listingId: "l1" });

    expect(res.status).toBe(400);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("creates a separate pending chat for another ad from the same seller", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: BOB, status: "ACTIVE" });
    prisma.listing.findUnique.mockResolvedValue({ id: "l2", sellerId: BOB, status: "ACTIVE" });
    prisma.conversation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(directConversation({ listingId: "l1", status: "ACCEPTED" }));
    prisma.conversation.create.mockResolvedValue(directConversation({ id: "c2", listingId: "l2", requestedById: ALICE }));

    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", aliceAuth)
      .send({ recipientId: BOB, listingId: "l2" });

    expect(res.status).toBe(201);
    expect(prisma.conversation.create.mock.calls[0][0].data).toMatchObject({ listingId: "l2", directKey: "listing:l2:alice_bob", status: "PENDING" });
    expect(res.body.id).toBe("c2");
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
    prisma.message.groupBy.mockResolvedValueOnce([{ conversationId: "c1", _count: { _all: 2 } }]);

    const res = await request(app).get("/api/conversations?tab=requests").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    const where = prisma.conversation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      participants: { some: { userId: ALICE, AND: [
        { OR: [{ blockedAt: null }, { blockedAt: { isSet: false } }] },
        { OR: [{ ignoredAt: null }, { ignoredAt: { isSet: false } }] },
      ] } },
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
  it("keeps messages sharing the boundary timestamp on one page", async () => {
    prisma.participant.findUnique.mockResolvedValue(membershipRow());
    const msg = (id: string, t: string) => ({
      id,
      conversationId: "c1",
      senderId: BOB,
      text: id,
      attachments: [],
      clientId: null,
      createdAt: new Date(t),
    });
    const tie = "2026-09-03T10:00:01Z";
    prisma.message.findMany
      .mockResolvedValueOnce([msg("m4", "2026-09-03T10:00:02Z"), msg("m3", tie), msg("m2", tie)])
      .mockResolvedValueOnce([msg("m3", tie), msg("m2", tie)]);
    prisma.message.findFirst.mockResolvedValueOnce({ id: "m1" });

    const res = await request(app).get("/api/conversations/c1/messages?limit=2").set("Authorization", aliceAuth);

    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(["m2", "m3", "m4"]);
    expect(res.body.hasMore).toBe(true);
  });

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
    prisma.participant.findMany.mockResolvedValue([{ userId: ALICE }, { userId: BOB }]);

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
