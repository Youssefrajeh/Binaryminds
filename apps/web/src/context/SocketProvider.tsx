import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { MessageDto, UserDto } from "@campushub/shared";
import { useAuth } from "./AuthContext";
import { SocketContext } from "./SocketContext";
import api from "../lib/api";
import { clearCache } from "../services/listingService";
import { CONTENT_REMOVED_EVENT } from "../lib/useContentRemoval";

/** Same origin in dev (Vite proxies /socket.io) and on Render; the API's origin when VITE_API_URL is absolute */
function socketUrl(): string | undefined {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl?.startsWith("http") ? new URL(apiUrl).origin : undefined;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user, updateUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh persisted roles on login/reload, focus, and admin updates. The periodic
  // fallback also catches changes made while a socket was disconnected.
  useEffect(() => {
    if (!token) return;
    let stale = false;
    let latestRequest = 0;
    async function refreshProfile() {
      const request = ++latestRequest;
      try {
        const response = await api.get<UserDto>("/profile/me");
        if (!stale && request === latestRequest) updateUser(response.data);
      } catch { /* The API interceptor handles an expired session. */ }
    }
    if (!socket) refreshProfile();
    window.addEventListener("focus", refreshProfile);
    socket?.on("user:role-changed", refreshProfile);
    const timer = setInterval(refreshProfile, 30_000);
    return () => {
      stale = true;
      window.removeEventListener("focus", refreshProfile);
      socket?.off("user:role-changed", refreshProfile);
      clearInterval(timer);
    };
  }, [token, socket, updateUser]);

  const loadCounts = useCallback(async () => {
    try {
      const { data } = await api.get<{ unreadTotal: number; requestCount: number }>("/conversations/counts");
      setUnreadTotal(data.unreadTotal);
      setRequestCount(data.requestCount);
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
      clearCache(); // Reconnects may have missed content-removal notices.
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
    function onContentRemoved(detail: { targetType: string; targetId: string }) {
      if (detail.targetType === "LISTING") clearCache();
      window.dispatchEvent(new CustomEvent(CONTENT_REMOVED_EVENT, { detail }));
    }

    socket.on("message:new", onMessageNew);
    socket.on("content:removed", onContentRemoved);
    socket.on("conversation:updated", refreshUnread);
    socket.on("conversation:removed", refreshUnread);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("content:removed", onContentRemoved);
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
