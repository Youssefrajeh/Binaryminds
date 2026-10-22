import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
  /** Unread messages across the inbox (badge in the nav) */
  unreadTotal: number;
  /** Message requests waiting for a decision */
  requestCount: number;
  refreshUnread: () => void;
}

// The provider lives in SocketProvider.tsx so this file exports no components
export const SocketContext = createContext<SocketState | undefined>(undefined);

export function useSocket(): SocketState {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
}
