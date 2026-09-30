import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type { ConversationDto, ConversationTab, MessageDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { ConversationList } from "../components/ConversationList";
import { ChatWindow } from "../components/ChatWindow";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../lib/api";

export function MessagesPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { socket, connected, requestCount, refreshUnread } = useSocket();
  const meId = user?.id ?? "";

  const [tab, setTab] = useState<ConversationTab>("inbox");
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The open chat may not be in the current list (a new DM, or a request while on Inbox)
  const [active, setActive] = useState<ConversationDto | null>(null);
  const [activeError, setActiveError] = useState("");
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get<ConversationDto[]>("/conversations", { params: { tab } });
      setConversations(res.data);
      setError("");
    } catch {
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const loadActive = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await api.get<ConversationDto>(`/conversations/${conversationId}`);
      setActive(res.data);
      setActiveError("");
    } catch {
      setActive(null);
      setActiveError("This conversation doesn't exist or you're no longer a member.");
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    loadList();
  }, [loadList]);

  useEffect(() => {
    setActive(null);
    setActiveError("");
    loadActive();
  }, [loadActive]);

  // Opening a request from a link should show the Requests tab
  useEffect(() => {
    if (active?.isRequest) setTab("requests");
  }, [active?.id, active?.isRequest]);

  const refreshAll = useCallback(() => {
    loadList();
    loadActive();
    refreshUnread();
  }, [loadList, loadActive, refreshUnread]);

  /* ---- Live updates for the list ---- */
  useEffect(() => {
    if (!socket) return;

    function onMessageNew({ message, accepted }: { message: MessageDto; accepted: boolean }) {
      if (accepted) {
        // A request just became a normal conversation — lists and header change
        refreshAll();
        return;
      }

      if (!conversationsRef.current.some((c) => c.id === message.conversationId)) {
        // New conversation or a request on the other tab
        loadList();
        return;
      }

      setConversations((list) => {
        const index = list.findIndex((c) => c.id === message.conversationId);
        if (index === -1) return list;
        const isOpen = message.conversationId === conversationId;
        const fromOther = message.senderId !== meId;
        const updated: ConversationDto = {
          ...list[index],
          lastMessage: { text: message.text, senderId: message.senderId, createdAt: message.createdAt },
          unreadCount: fromOther && !isOpen ? list[index].unreadCount + 1 : list[index].unreadCount,
          updatedAt: message.createdAt,
        };
        return [updated, ...list.filter((_, i) => i !== index)];
      });
    }

    function onConversationRemoved({ conversationId: removedId }: { conversationId: string }) {
      setConversations((list) => list.filter((c) => c.id !== removedId));
      if (removedId === conversationId) loadActive();
    }

    socket.on("message:new", onMessageNew);
    socket.on("conversation:updated", loadList);
    socket.on("conversation:removed", onConversationRemoved);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("conversation:updated", loadList);
      socket.off("conversation:removed", onConversationRemoved);
    };
  }, [socket, conversationId, meId, loadList, loadActive, refreshAll]);

  // After a reconnect, anything could have changed
  useEffect(() => {
    if (connected) loadList();
  }, [connected, loadList]);

  const handleRead = useCallback(
    (readId: string) => {
      setConversations((list) => list.map((c) => (c.id === readId ? { ...c, unreadCount: 0 } : c)));
      refreshUnread();
    },
    [refreshUnread]
  );

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <Nav />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 sm:px-4 sm:py-4">
        <div className="flex min-h-0 w-full overflow-hidden border-line bg-surface sm:rounded-2xl sm:border sm:shadow-sm">
          <aside
            className={`w-full shrink-0 border-line sm:block sm:w-80 sm:border-r ${conversationId ? "hidden" : "block"}`}
          >
            <ConversationList
              tab={tab}
              onTabChange={setTab}
              conversations={conversations}
              loading={loading}
              error={error}
              activeId={conversationId}
              meId={meId}
              requestCount={requestCount}
            />
          </aside>

          <section className={`min-w-0 flex-1 ${conversationId ? "block" : "hidden sm:block"}`}>
            {!conversationId ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <p className="text-sm font-medium text-ink">Select a conversation</p>
                  <p className="mt-1 text-sm text-muted">
                    Or find a student and use the Message button on their profile. Study group chats live in{" "}
                    <Link to="/study-groups" className="link">
                      Study groups
                    </Link>
                    .
                  </p>
                </div>
              </div>
            ) : activeError ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <p className="text-sm text-muted">{activeError}</p>
                  <Link to="/messages" className="link mt-2 inline-block text-sm">
                    Back to messages
                  </Link>
                </div>
              </div>
            ) : active ? (
              <ChatWindow
                key={active.id}
                conversation={active}
                meId={meId}
                onRead={handleRead}
                onConversationChanged={refreshAll}
              />
            ) : (
              <p className="p-8 text-center text-sm text-muted">Loading…</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
