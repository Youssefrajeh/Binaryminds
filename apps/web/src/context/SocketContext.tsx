import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConversationDto, MessageDto } from "@campushub/shared";
import { useAuth } from "./AuthContext";
import api from "../lib/api";

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  /** Unread messages across the inbox (badge in the nav) */
  unreadTotal: number;
  /** Message requests waiting for a decision */
  requestCount: number;
  refreshUnread: () => void;
}

const SocketContext = createContext<SocketState | undefined>(undefined);

/** Same origin in dev (Vite proxies /socket.io) and on Render; the API's origin when VITE_API_URL is absolute */
function socketUrl(): string | undefined {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl?.startsWith("http") ? new URL(apiUrl).origin : undefined;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const [inbox, requests] = await Promise.all([
        api.get<ConversationDto[]>("/conversations", { params: { tab: "inbox" } }),
        api.get<ConversationDto[]>("/conversations", { params: { tab: "requests" } }),
      ]);
      setUnreadTotal(inbox.data.reduce((sum, c) => sum + c.unreadCount, 0));
      setRequestCount(requests.data.length);
    } catch {
      // Counts are a nicety; the Messages page shows real errors
    }
  }, []);

  // Coalesce bursts of events into one request
  const refreshUnread = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(loadCounts, 300);
  }, [loadCounts]);

  /* ---- Connect after login, disconnect on logout ---- */
  useEffect(() => {
    if (!token) return;

    const s = io(socketUrl(), { auth: { token } });
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setUnreadTotal(0);
      setRequestCount(0);
    };
  }, [token]);

  /* ---- Connection state and unread counts ---- */
  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setConnected(true);
      refreshUnread();
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onMessageNew({ message }: { message: MessageDto }) {
      if (message.senderId !== user?.id) refreshUnread();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message:new", onMessageNew);
    socket.on("conversation:updated", refreshUnread);
    socket.on("conversation:removed", refreshUnread);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message:new", onMessageNew);
      socket.off("conversation:updated", refreshUnread);
      socket.off("conversation:removed", refreshUnread);
    };
  }, [socket, user?.id, refreshUnread]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, unreadTotal, requestCount, refreshUnread }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketState {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
}
