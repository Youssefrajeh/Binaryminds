import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "./prisma.js";
import { MessageError, sendMessage } from "./messages.js";

vi.mock("./prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;

const now = new Date("2026-09-29T12:00:00Z");

function membership(conversation: Record<string, unknown> = {}) {
  return {
    id: "p-bob",
    userId: "bob",
    conversationId: "c1",
    blockedAt: null,
    conversation: { id: "c1", type: "DIRECT", status: "PENDING", requestedById: "alice", ...conversation },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.participant.findUnique.mockResolvedValue(membership());
  prisma.participant.findMany.mockResolvedValue([
    { id: "p-alice", userId: "alice", blockedAt: null },
    { id: "p-bob", userId: "bob", blockedAt: null },
  ]);
  prisma.message.findFirst.mockResolvedValue(null);
  prisma.message.create.mockImplementation(async ({ data }) => ({ id: "m1", createdAt: now, ...data }));
  prisma.conversation.update.mockImplementation(async ({ data }) => ({ id: "c1", ...data }));
});

describe("sendMessage", () => {
  it("rejects empty and whitespace-only messages", async () => {
    await expect(sendMessage("bob", { conversationId: "c1", text: "   " })).rejects.toThrow("Message cannot be empty");
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("rejects messages over 2000 characters", async () => {
    await expect(sendMessage("bob", { conversationId: "c1", text: "a".repeat(2001) })).rejects.toBeInstanceOf(MessageError);
  });

  it("rejects attachments until uploads are supported", async () => {
    await expect(
      sendMessage("bob", { conversationId: "c1", text: "hi", attachments: [{ url: "x" }] })
    ).rejects.toThrow("Attachments are not supported yet");
  });

  it("rejects senders who are not members", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);

    await expect(sendMessage("mallory", { conversationId: "c1", text: "hi" })).rejects.toThrow("Conversation not found");
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("rejects messages in a blocked conversation", async () => {
    prisma.participant.findMany.mockResolvedValue([
      { id: "p-alice", userId: "alice", blockedAt: now },
      { id: "p-bob", userId: "bob", blockedAt: null },
    ]);

    await expect(sendMessage("bob", { conversationId: "c1", text: "hi" })).rejects.toThrow("This conversation is blocked");
  });

  it("saves trimmed text, updates lastMessage and returns every member", async () => {
    const result = await sendMessage("alice", { conversationId: "c1", text: "  Is the book still available?  ", clientId: "tmp-1" });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: "c1", senderId: "alice", text: "Is the book still available?", attachments: [], clientId: "tmp-1" },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { lastMessage: { text: "Is the book still available?", senderId: "alice", createdAt: now } },
    });
    expect(result.memberIds).toEqual(["alice", "bob"]);
    expect(result.accepted).toBe(false);
  });

  it("accepts a pending request when the recipient replies", async () => {
    const result = await sendMessage("bob", { conversationId: "c1", text: "Yes it is!" });

    expect(result.accepted).toBe(true);
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACCEPTED" }) })
    );
  });

  it("returns the original message when a clientId is retried", async () => {
    const original = { id: "m0", conversationId: "c1", senderId: "bob", text: "hi", clientId: "tmp-1", createdAt: now };
    prisma.message.findFirst.mockResolvedValue(original);

    const result = await sendMessage("bob", { conversationId: "c1", text: "hi", clientId: "tmp-1" });

    expect(result.message).toBe(original);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
