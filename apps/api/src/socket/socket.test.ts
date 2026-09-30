import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { createSocketServer } from "./index.js";
import { setIO } from "./io.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;

let httpServer: HttpServer;
let url: string;
const clients: ClientSocket[] = [];

function client(token?: string) {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
  clients.push(socket);
  return socket;
}

const tokenFor = (userId: string) => signToken({ userId, role: "STUDENT" });

function connected(socket: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
}

function emitWithAck<T>(socket: ClientSocket, event: string, payload: unknown) {
  return socket.timeout(2000).emitWithAck(event, payload) as Promise<T>;
}

function nextEvent<T>(socket: ClientSocket, event: string, ms = 1000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Alice and Bob share conversation c1; everyone else is a stranger */
function mockConversation() {
  prisma.participant.findUnique.mockImplementation(async ({ where }) => {
    const { conversationId, userId } = where.conversationId_userId;
    if (conversationId !== "c1" || !["alice", "bob"].includes(userId)) return null;
    return {
      id: `p-${userId}`,
      userId,
      conversationId,
      blockedAt: null,
      conversation: { id: "c1", type: "DIRECT", status: "ACCEPTED", requestedById: "alice" },
    };
  });
  prisma.participant.findMany.mockResolvedValue([
    { id: "p-alice", userId: "alice", blockedAt: null },
    { id: "p-bob", userId: "bob", blockedAt: null },
  ]);
  prisma.message.findFirst.mockResolvedValue(null);
  prisma.message.create.mockImplementation(async ({ data }) => ({
    id: `m-${data.clientId ?? Math.random()}`,
    createdAt: new Date(),
    ...data,
  }));
  prisma.conversation.update.mockResolvedValue({ id: "c1" });
}

beforeAll(async () => {
  httpServer = createServer();
  createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  setIO(null);
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mockConversation();
});

afterEach(() => {
  clients.splice(0).forEach((s) => s.disconnect());
});

describe("handshake", () => {
  it("rejects connections without a token", async () => {
    await expect(connected(client())).rejects.toThrow("Authentication required");
  });

  it("rejects connections with an invalid token", async () => {
    await expect(connected(client("not-a-jwt"))).rejects.toThrow("Invalid or expired token");
  });

  it("accepts a valid token", async () => {
    await expect(connected(client(tokenFor("alice")))).resolves.toBeUndefined();
  });
});

describe("message:send", () => {
  it("refuses non-members and saves nothing", async () => {
    const mallory = client(tokenFor("mallory"));
    await connected(mallory);

    const ack = await emitWithAck<{ error?: string }>(mallory, "message:send", { conversationId: "c1", text: "hi" });

    expect(ack.error).toBe("Conversation not found");
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("saves, then delivers message:new to every member and acks the sender", async () => {
    // Different users so the per-user rate limit from other tests doesn't interfere
    const alice = client(tokenFor("alice"));
    const bob = client(tokenFor("bob"));
    await Promise.all([connected(alice), connected(bob)]);

    const bobReceives = nextEvent<{ message: { text: string; senderId: string } }>(bob, "message:new");
    const aliceEcho = nextEvent<{ message: { clientId: string } }>(alice, "message:new");

    const ack = await emitWithAck<{ ok?: boolean; message?: { clientId: string } }>(alice, "message:send", {
      conversationId: "c1",
      text: "See you at the library",
      clientId: "tmp-42",
    });

    expect(ack.ok).toBe(true);
    expect(ack.message?.clientId).toBe("tmp-42");
    expect((await bobReceives).message).toMatchObject({ text: "See you at the library", senderId: "alice" });
    expect((await aliceEcho).message.clientId).toBe("tmp-42");
    expect(prisma.message.create).toHaveBeenCalledOnce();
  });

  it("rejects empty messages", async () => {
    const bob = client(tokenFor("bob"));
    await connected(bob);

    const ack = await emitWithAck<{ error?: string }>(bob, "message:send", { conversationId: "c1", text: "   " });
    expect(ack.error).toBe("Message cannot be empty");
  });

  it("rate-limits bursts to 10 messages per 5 seconds", async () => {
    const carol = client(tokenFor("carol"));
    await connected(carol);

    // carol isn't a member, but the limit applies before any other check
    const acks = [];
    for (let i = 0; i < 11; i++) {
      acks.push(await emitWithAck<{ error?: string }>(carol, "message:send", { conversationId: "c1", text: `m${i}` }));
    }

    expect(acks.slice(0, 10).every((a) => a.error === "Conversation not found")).toBe(true);
    expect(acks[10].error).toMatch(/too quickly/);
  });
});

describe("typing", () => {
  it("only reaches members who joined the conversation room", async () => {
    const alice = client(tokenFor("alice"));
    const bob = client(tokenFor("bob"));
    const mallory = client(tokenFor("mallory"));
    await Promise.all([connected(alice), connected(bob), connected(mallory)]);

    expect(await emitWithAck<{ ok?: boolean }>(alice, "conversation:join", { conversationId: "c1" })).toEqual({ ok: true });
    expect(await emitWithAck<{ ok?: boolean }>(bob, "conversation:join", { conversationId: "c1" })).toEqual({ ok: true });
    expect(await emitWithAck<{ error?: string }>(mallory, "conversation:join", { conversationId: "c1" })).toEqual({
      error: "Conversation not found",
    });

    const bobSees = nextEvent<{ userId: string; isTyping: boolean }>(bob, "typing");
    const mallorySees = nextEvent(mallory, "typing", 300).catch(() => "nothing");

    alice.emit("typing", { conversationId: "c1", isTyping: true });

    expect(await bobSees).toEqual({ conversationId: "c1", userId: "alice", isTyping: true });
    expect(await mallorySees).toBe("nothing");
  });
});
