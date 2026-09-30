import type { Server } from "socket.io";

/* ------------------------------------------------------------------ */
/*  Access to the running Socket.IO server from REST routes            */
/* ------------------------------------------------------------------ */

let io: Server | null = null;

export function setIO(server: Server | null) {
  io = server;
}

export const userRoom = (userId: string) => `user:${userId}`;
export const convoRoom = (conversationId: string) => `convo:${conversationId}`;

/** Emits to every open tab of each user; a no-op when sockets are not running (e.g. tests) */
export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  if (!io || userIds.length === 0) return;
  io.to(userIds.map(userRoom)).emit(event, payload);
}

/** Removes a user's sockets from a conversation room, e.g. after leaving a study group */
export function removeUserFromConversationRoom(userId: string, conversationId: string) {
  io?.in(userRoom(userId)).socketsLeave(convoRoom(conversationId));
}
