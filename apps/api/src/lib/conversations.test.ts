import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "./prisma.js";
import { countUnread, directKeyFor, findMembership, groupKeyFor } from "./conversations.js";

vi.mock("./prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("directKeyFor", () => {
  it("is the same no matter who starts the conversation", () => {
    expect(directKeyFor("bob", "alice")).toBe("alice_bob");
    expect(directKeyFor("alice", "bob")).toBe("alice_bob");
  });

  it("never collides with group keys", () => {
    expect(groupKeyFor("sg1")).toBe("group:sg1");
    expect(directKeyFor("group:sg1", "x")).not.toBe(groupKeyFor("sg1"));
  });
});

describe("findMembership", () => {
  it("returns null when the user is not a participant", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);

    await expect(findMembership("c1", "stranger")).resolves.toBeNull();
    expect(prisma.participant.findUnique).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: "c1", userId: "stranger" } },
      include: { conversation: true },
    });
  });

  it("returns the conversation and the caller's participant row for members", async () => {
    const conversation = { id: "c1", type: "DIRECT" };
    prisma.participant.findUnique.mockResolvedValue({ id: "p1", userId: "u1", conversationId: "c1", conversation });

    const membership = await findMembership("c1", "u1");

    expect(membership?.conversation).toEqual(conversation);
    expect(membership?.participant).toEqual({ id: "p1", userId: "u1", conversationId: "c1" });
  });
});

describe("countUnread", () => {
  it("counts only messages from others after lastReadAt", async () => {
    prisma.message.count.mockResolvedValue(3);
    const lastReadAt = new Date("2026-09-01T12:00:00Z");

    await expect(countUnread("c1", "u1", lastReadAt)).resolves.toBe(3);
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { conversationId: "c1", senderId: { not: "u1" }, createdAt: { gt: lastReadAt } },
    });
  });

  it("counts every message from others when never read", async () => {
    prisma.message.count.mockResolvedValue(5);

    await countUnread("c1", "u1", null);
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { conversationId: "c1", senderId: { not: "u1" } },
    });
  });
});
