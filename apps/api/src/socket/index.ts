import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/jwt.js";
import { corsOptions } from "../lib/cors.js";
import { findMembership, toMessageDto } from "../lib/conversations.js";
import { MessageError, sendMessage } from "../lib/messages.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { convoRoom, emitToUsers, setIO, userRoom } from "./io.js";

type Ack = (response: Record<string, unknown>) => void;

const sendLimiter = createRateLimiter(10, 5000);

function safeAck(ack: unknown): Ack {
  return typeof ack === "function" ? (ack as Ack) : () => {};
}

function conversationIdFrom(payload: unknown): string | null {
  const id = (payload as { conversationId?: unknown } | null)?.conversationId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: corsOptions() });

  /* ---- Handshake: same JWT as the REST API ---- */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      socket.data.userId = verifyToken(token).userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;
    socket.join(userRoom(userId));

    /* ---- message:send ---- */
    socket.on("message:send", async (payload: unknown, ack: unknown) => {
      const reply = safeAck(ack);

      if (!sendLimiter.tryConsume(userId)) {
        reply({ error: "You're sending messages too quickly. Please wait a moment." });
        return;
      }

      try {
        const { message, memberIds, accepted } = await sendMessage(userId, payload);
        const dto = toMessageDto(message);

        emitToUsers(memberIds, "message:new", { message: dto, accepted });
        reply({ ok: true, message: dto });
      } catch (err) {
        if (err instanceof MessageError) {
          reply({ error: err.message });
        } else {
          console.error("Socket message:send error:", err);
          reply({ error: "Message could not be sent" });
        }
      }
    });

    /* ---- Open chat rooms (typing indicators) ---- */
    socket.on("conversation:join", async (payload: unknown, ack: unknown) => {
      const reply = safeAck(ack);
      const conversationId = conversationIdFrom(payload);
      if (!conversationId || !(await findMembership(conversationId, userId))) {
        reply({ error: "Conversation not found" });
        return;
      }
      socket.join(convoRoom(conversationId));
      reply({ ok: true });
    });

    socket.on("conversation:leave", (payload: unknown) => {
      const conversationId = conversationIdFrom(payload);
      if (conversationId) socket.leave(convoRoom(conversationId));
    });

    socket.on("typing", (payload: unknown) => {
      const conversationId = conversationIdFrom(payload);
      // Only sockets that passed the membership check in conversation:join are in the room
      if (!conversationId || !socket.rooms.has(convoRoom(conversationId))) return;

      socket.to(convoRoom(conversationId)).emit("typing", {
        conversationId,
        userId,
        isTyping: Boolean((payload as { isTyping?: unknown }).isTyping),
      });
    });
  });

  setIO(io);
  return io;
}
