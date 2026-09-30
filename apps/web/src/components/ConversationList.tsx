import { Link } from "react-router";
import type { ConversationDto, ConversationTab } from "@campushub/shared";
import { Avatar } from "./Avatar";
import { formatListTime } from "../lib/format";

interface ConversationListProps {
  tab: ConversationTab;
  onTabChange: (tab: ConversationTab) => void;
  conversations: ConversationDto[];
  loading: boolean;
  error: string;
  activeId?: string;
  meId?: string;
  requestCount: number;
}

const tabClass = (active: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
    active ? "bg-surface text-ink shadow-xs" : "text-ink-soft hover:text-ink"
  }`;

function avatarFor(conversation: ConversationDto, meId?: string) {
  if (conversation.type === "GROUP") return null;
  return conversation.members.find((m) => m.id !== meId)?.avatarUrl ?? null;
}

function preview(conversation: ConversationDto, meId?: string) {
  const last = conversation.lastMessage;
  if (!last) return conversation.type === "GROUP" ? "No messages yet" : "Say hello 👋";
  if (last.senderId === meId) return `You: ${last.text}`;
  if (conversation.type === "GROUP") {
    const sender = conversation.members.find((m) => m.id === last.senderId);
    return `${sender?.displayName ?? "Someone"}: ${last.text}`;
  }
  return last.text;
}

export function ConversationList({
  tab,
  onTabChange,
  conversations,
  loading,
  error,
  activeId,
  meId,
  requestCount,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <h1 className="text-lg font-semibold text-ink">Messages</h1>
        <div className="mt-3 flex gap-1 rounded-xl bg-canvas p-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "inbox"} onClick={() => onTabChange("inbox")} className={tabClass(tab === "inbox")}>
            Inbox
          </button>
          <button type="button" role="tab" aria-selected={tab === "requests"} onClick={() => onTabChange("requests")} className={tabClass(tab === "requests")}>
            Requests
            {requestCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {requestCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <div className="alert-error m-4">{error}</div>}

        {loading && conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Loading…</p>
        ) : conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            {tab === "requests"
              ? "No message requests. When someone new messages you, it shows up here."
              : "No conversations yet. Use the Message button on a student's profile to start one."}
          </p>
        ) : (
          <ul>
            {conversations.map((c) => {
              const unread = c.unreadCount > 0 && c.id !== activeId;
              return (
                <li key={c.id}>
                  <Link
                    to={`/messages/${c.id}`}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-canvas ${
                      c.id === activeId ? "bg-canvas" : ""
                    }`}
                  >
                    {c.type === "GROUP" ? (
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </span>
                    ) : (
                      <Avatar name={c.name} src={avatarFor(c, meId)} className="h-11 w-11 text-sm" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                          {c.name}
                        </p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-xs text-muted">{formatListTime(c.lastMessage.createdAt)}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "text-ink" : "text-muted"}`}>{preview(c, meId)}</p>
                        {unread && (
                          <span
                            className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white"
                            aria-label={`${c.unreadCount} unread`}
                          >
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
