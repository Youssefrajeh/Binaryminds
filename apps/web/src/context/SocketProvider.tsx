import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConversationDto, MessageDto } from "@campushub/shared";
import { useAuth } from "./AuthContext";
import { SocketContext } from "./SocketContext";
import api from "../lib/api";

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

    // The socket is shared once it first connects; consumers only use it while connected
    function onConnect() {
      setSocket(s);
      setConnected(true);
      refreshUnread();
    }
    function onDisconnect() {
      setConnected(false);
    }

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setUnreadTotal(0);
      setRequestCount(0);
    };
  }, [token, refreshUnread]);

  /* ---- Unread counts ---- */
  useEffect(() => {
    if (!socket) return;

    function onMessageNew({ message }: { message: MessageDto }) {
      if (message.senderId !== user?.id) refreshUnread();
    }

    socket.on("message:new", onMessageNew);
    socket.on("conversation:updated", refreshUnread);
    socket.on("conversation:removed", refreshUnread);

    return () => {
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
