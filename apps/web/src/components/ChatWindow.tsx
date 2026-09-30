import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { ConversationDto, MessageDto, MessagesPageDto } from "@campushub/shared";
import { Avatar } from "./Avatar";
import { useSocket } from "../context/SocketContext";
import { formatDayLabel, formatMessageTime, newClientId } from "../lib/format";
import api from "../lib/api";

type UiMessage = MessageDto & { status?: "sending" | "failed"; error?: string };

interface SendAck {
  ok?: boolean;
  message?: MessageDto;
  error?: string;
}

interface ChatWindowProps {
  conversation: ConversationDto;
  meId: string;
  /** Called after the conversation was marked read */
  onRead: (conversationId: string) => void;
  /** Called after accept / ignore / block so the page can refresh its lists */
  onConversationChanged: () => void;
}

const MAX_LENGTH = 2000;
const NEAR_BOTTOM_PX = 120;

/** Inserts or replaces a message, matching on id or the sender's clientId */
function upsert(list: UiMessage[], incoming: UiMessage): UiMessage[] {
  const index = list.findIndex(
    (m) => m.id === incoming.id || (incoming.clientId && m.clientId === incoming.clientId && m.senderId === incoming.senderId)
  );
  const next = index === -1 ? [...list, incoming] : list.map((m, i) => (i === index ? incoming : m));
  return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function ChatWindow({ conversation, meId, onRead, onConversationChanged }: ChatWindowProps) {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const conversationId = conversation.id;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restoreScroll = useRef<{ height: number; top: number } | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const typingSent = useRef(false);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedOnce = useRef(false);

  const other = conversation.members.find((m) => m.id !== meId);
  const nameOf = (userId: string) => conversation.members.find((m) => m.id === userId)?.displayName ?? "Someone";

  /* ---- Read receipts (debounced) ---- */
  const markRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      try {
        await api.patch(`/conversations/${conversationId}/read`);
        onRead(conversationId);
      } catch {
        // Not critical; the badge catches up on the next visit
      }
    }, 400);
  }, [conversationId, onRead]);

  /* ---- Initial page ---- */
  useEffect(() => {
    let cancelled = false;
    loadedOnce.current = false;
    setMessages([]);
    setHasMore(false);
    setCursor(null);
    setError("");
    setLoading(true);
    setTypingUsers([]);

    api
      .get<MessagesPageDto>(`/conversations/${conversationId}/messages`)
      .then((res) => {
        if (cancelled) return;
        stickToBottom.current = true;
        setMessages(res.data.messages);
        setHasMore(res.data.hasMore);
        setCursor(res.data.nextCursor);
        loadedOnce.current = true;
        markRead();
      })
      .catch(() => !cancelled && setError("Failed to load messages"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [conversationId, markRead]);

  /* ---- Join the chat room; catch up on anything missed while offline ---- */
  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit("conversation:join", { conversationId });
    if (loadedOnce.current) {
      api
        .get<MessagesPageDto>(`/conversations/${conversationId}/messages`)
        .then((res) => setMessages((list) => res.data.messages.reduce(upsert, list)))
        .catch(() => {});
    }

    return () => {
      socket.emit("conversation:leave", { conversationId });
    };
  }, [socket, connected, conversationId]);

  /* ---- Live events ---- */
  useEffect(() => {
    if (!socket) return;
    const timers = typingTimers.current;

    function isNearBottom() {
      const el = listRef.current;
      return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    }

    function onMessageNew({ message }: { message: MessageDto }) {
      if (message.conversationId !== conversationId) return;
      stickToBottom.current = message.senderId === meId || isNearBottom();
      setMessages((list) => upsert(list, message));
      if (message.senderId !== meId) {
        setTypingUsers((users) => users.filter((u) => u !== message.senderId));
        markRead();
      }
    }

    function onTyping({ conversationId: id, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) {
      if (id !== conversationId || userId === meId) return;
      const existing = timers.get(userId);
      if (existing) clearTimeout(existing);

      if (isTyping) {
        setTypingUsers((users) => (users.includes(userId) ? users : [...users, userId]));
        // Drop the indicator if the "stopped typing" event never arrives
        timers.set(userId, setTimeout(() => setTypingUsers((users) => users.filter((u) => u !== userId)), 4000));
      } else {
        timers.delete(userId);
        setTypingUsers((users) => users.filter((u) => u !== userId));
      }
    }

    socket.on("message:new", onMessageNew);
    socket.on("typing", onTyping);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("typing", onTyping);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [socket, conversationId, meId, markRead]);

  /* ---- Scroll management ---- */
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    if (restoreScroll.current) {
      // Keep the viewport steady after prepending older messages
      el.scrollTop = el.scrollHeight - restoreScroll.current.height + restoreScroll.current.top;
      restoreScroll.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
      stickToBottom.current = false;
    }
  }, [messages, typingUsers]);

  async function loadOlder() {
    const el = listRef.current;
    if (!el || !hasMore || loadingOlder || !cursor) return;

    setLoadingOlder(true);
    try {
      const res = await api.get<MessagesPageDto>(`/conversations/${conversationId}/messages`, {
        params: { before: cursor },
      });
      restoreScroll.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((list) => res.data.messages.reduce(upsert, list));
      setHasMore(res.data.hasMore);
      setCursor(res.data.nextCursor);
    } catch {
      setError("Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleScroll() {
    if ((listRef.current?.scrollTop ?? 1) < 60) loadOlder();
  }

  /* ---- Typing indicator (outgoing) ---- */
  function stopTyping() {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (typingSent.current) {
      socket?.emit("typing", { conversationId, isTyping: false });
      typingSent.current = false;
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    if (!socket || !connected) return;

    if (!typingSent.current && value.trim()) {
      socket.emit("typing", { conversationId, isTyping: true });
      typingSent.current = true;
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(stopTyping, 2500);
  }

  // Leaving a chat mid-sentence: tell that chat we stopped typing
  useEffect(() => {
    return () => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (typingSent.current) {
        socket?.emit("typing", { conversationId, isTyping: false });
        typingSent.current = false;
      }
    };
  }, [socket, conversationId]);

  /* ---- Sending (optimistic) ---- */
  function deliver(body: string, clientId: string) {
    const optimistic: UiMessage = {
      id: `pending-${clientId}`,
      conversationId,
      senderId: meId,
      text: body,
      attachments: [],
      clientId,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    stickToBottom.current = true;
    setMessages((list) => upsert(list, optimistic));

    const fail = (reason: string) =>
      setMessages((list) => upsert(list, { ...optimistic, status: "failed", error: reason }));

    if (!socket || !connected) {
      fail("You're offline");
      return;
    }

    socket.timeout(10_000).emit("message:send", { conversationId, text: body, clientId }, (err: Error | null, ack?: SendAck) => {
      if (err) fail("No response from the server");
      else if (!ack?.ok || !ack.message) fail(ack?.error ?? "Message could not be sent");
      else setMessages((list) => upsert(list, ack.message!));
    });
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    stopTyping();
    deliver(body, newClientId());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function retry(message: UiMessage) {
    deliver(message.text, message.clientId ?? newClientId());
  }

  /* ---- Request / block actions ---- */
  async function runAction(action: "accept" | "ignore" | "block") {
    if (action === "block" && !window.confirm(`Block ${conversation.name}? They won't be able to message you here.`)) return;

    setBusyAction(true);
    setError("");
    try {
      await api.patch(`/conversations/${conversationId}/${action}`);
      onConversationChanged();
      if (action !== "accept") navigate("/messages");
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setBusyAction(false);
    }
  }

  const pendingOutgoing =
    conversation.type === "DIRECT" && conversation.status === "PENDING" && !conversation.isRequest;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to="/messages" className="-ml-1 rounded-lg p-1.5 text-ink-soft hover:bg-canvas sm:hidden" aria-label="Back to conversations">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        {conversation.type === "DIRECT" && other ? (
          <Link to={`/u/${other.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-90">
            <Avatar name={other.displayName} src={other.avatarUrl} className="h-9 w-9 text-xs" />
            <p className="truncate text-sm font-semibold text-ink">{conversation.name}</p>
          </Link>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{conversation.name}</p>
            <p className="text-xs text-muted">
              {conversation.members.length} member{conversation.members.length === 1 ? "" : "s"}
            </p>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!connected && <span className="text-xs text-muted">Reconnecting…</span>}
          {conversation.type === "DIRECT" && !conversation.isRequest && !conversation.blockedByMe && (
            <button type="button" onClick={() => runAction("block")} disabled={busyAction} className="text-xs font-medium text-muted hover:text-danger">
              Block
            </button>
          )}
        </div>
      </div>

      {conversation.isRequest && (
        <div className="border-b border-line bg-brand-soft/60 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">{conversation.name}</span> wants to message you. Replying also accepts.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => runAction("accept")} disabled={busyAction} className="btn-primary px-4 py-1.5">
              Accept
            </button>
            <button type="button" onClick={() => runAction("ignore")} disabled={busyAction} className="btn-secondary px-4 py-1.5">
              Ignore
            </button>
            <button type="button" onClick={() => runAction("block")} disabled={busyAction} className="btn-secondary px-4 py-1.5 text-danger">
              Block
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {error && <div className="alert-error mb-3">{error}</div>}
        {loadingOlder && <p className="py-2 text-center text-xs text-muted">Loading older messages…</p>}
        {!hasMore && !loading && messages.length > 0 && (
          <p className="py-2 text-center text-xs text-muted">Start of the conversation</p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {conversation.type === "GROUP" ? "No messages yet. Say hi to your study group!" : "No messages yet. Say hello!"}
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === meId;
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const showSender = conversation.type === "GROUP" && !mine && (newDay || prev?.senderId !== m.senderId);

            return (
              <div key={m.clientId ?? m.id}>
                {newDay && (
                  <p className="py-3 text-center text-xs font-medium text-muted">{formatDayLabel(m.createdAt)}</p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {showSender && (
                      <Link to={`/u/${m.senderId}`} className="mb-0.5 ml-1 text-xs font-medium text-ink-soft hover:underline">
                        {nameOf(m.senderId)}
                      </Link>
                    )}
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-canvas text-ink"
                      } ${m.status === "sending" ? "opacity-60" : ""} ${m.status === "failed" ? "ring-2 ring-danger/50" : ""}`}
                    >
                      {m.text}
                    </div>
                    <p className="mt-0.5 px-1 text-[11px] text-muted">
                      {m.status === "sending" ? (
                        "Sending…"
                      ) : m.status === "failed" ? (
                        <span className="text-danger">
                          Not sent{m.error ? ` · ${m.error}` : ""} ·{" "}
                          <button type="button" onClick={() => retry(m)} className="font-semibold underline">
                            Retry
                          </button>
                        </span>
                      ) : (
                        formatMessageTime(m.createdAt)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 && (
          <p className="pt-1 text-xs italic text-muted">
            {typingUsers.length === 1 ? `${nameOf(typingUsers[0])} is typing…` : "Several people are typing…"}
          </p>
        )}
      </div>

      {/* Input */}
      {conversation.blockedByMe ? (
        <p className="border-t border-line px-4 py-4 text-center text-sm text-muted">
          You blocked this conversation. Use the Message button on their profile to unblock.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-line p-3">
          {pendingOutgoing && (
            <p className="mb-2 text-xs text-muted">
              Message request sent. It moves to their inbox once they accept or reply.
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              rows={1}
              maxLength={MAX_LENGTH}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={stopTyping}
              placeholder="Write a message…"
              className="field-input max-h-32 min-h-11 resize-none"
            />
            <button type="submit" disabled={!text.trim()} className="btn-primary h-11 shrink-0 px-4">
              Send
            </button>
          </div>
          {text.length > MAX_LENGTH - 200 && (
            <p className="mt-1 text-right text-xs text-muted">
              {text.length}/{MAX_LENGTH}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
