import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ConversationDto } from "@campushub/shared";
import { MessagesPage } from "./MessagesPage";

const { get, patch, socketState } = vi.hoisted(() => ({
  get: vi.fn(), patch: vi.fn(),
  socketState: { socket: null, connected: false, requestCount: 1, refreshUnread: vi.fn() },
}));
vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("../lib/api", () => ({ default: { get, patch } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "seller" } }) }));
vi.mock("../context/SocketContext", () => ({ useSocket: () => socketState }));

const incoming: ConversationDto = {
  id: "ad-chat", type: "DIRECT", name: "Buyer", status: "PENDING", isRequest: true, blockedByMe: false,
  studyGroupId: null, members: [{ id: "seller", displayName: "Seller", avatarUrl: null }, { id: "buyer", displayName: "Buyer", avatarUrl: null }],
  unreadCount: 1, updatedAt: "2026-10-30T12:00:00Z", lastMessage: { text: "Is this book available?", senderId: "buyer", createdAt: "2026-10-30T12:00:00Z" },
  listing: { id: "book", title: "Textbook", description: "Almost new", priceCents: 2500, condition: "GOOD", status: "ACTIVE", imageUrl: "data:image/png;base64,photo", sellerName: "Seller" },
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function show(path = "/messages") {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/messages" element={<MessagesPage />} /><Route path="/messages/:conversationId" element={<MessagesPage />} /></Routes></MemoryRouter>);
}

describe("message requests and listing references", () => {
  it("clears a Requests error immediately when switching to Inbox", async () => {
    let resolveInbox!: (value: { data: ConversationDto[] }) => void;
    let slowInbox = false;
    const inbox = new Promise<{ data: ConversationDto[] }>((resolve) => { resolveInbox = resolve; });
    get.mockImplementation((_url, options) => options.params.tab === "requests" ? Promise.reject(new Error("Request failed")) : slowInbox ? inbox : Promise.resolve({ data: [] }));
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Requests/ }));
    await screen.findByText("Failed to load conversations");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    slowInbox = true;
    fireEvent.click(screen.getByRole("tab", { name: "Inbox" }));
    expect(screen.queryByText("Failed to load conversations")).toBeNull();
    expect(screen.getByText("Loading…")).toBeTruthy();
    resolveInbox({ data: [] });
    await screen.findByText(/No conversations yet/);
  });
  it("retries a failed Requests load", async () => {
    let fail = true;
    get.mockImplementation((_url, options) => options.params.tab !== "requests" ? Promise.resolve({ data: [] }) : fail ? Promise.reject(new Error("Request failed")) : Promise.resolve({ data: [incoming] }));
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Requests/ }));
    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    fireEvent.click(retry);
    await screen.findByText("Ad: Textbook");
    expect(screen.queryByText("Failed to load conversations")).toBeNull();
  });
  it("shows the incoming ad chat in Requests and moves it to Inbox after acceptance", async () => {
    let accepted = false;
    get.mockImplementation(async (url, options) => {
      const conversation = accepted ? { ...incoming, status: "ACCEPTED", isRequest: false } : incoming;
      if (url === "/conversations") return { data: options.params.tab === "requests" ? accepted ? [] : [incoming] : accepted ? [conversation] : [] };
      if (url.endsWith("/messages")) return { data: { messages: [], hasMore: false, nextCursor: null } };
      return { data: conversation };
    });
    patch.mockImplementation(async (url) => { if (url.endsWith("/accept")) accepted = true; return { data: {} }; });
    show("/messages/ad-chat");
    await waitFor(() => expect(screen.getByRole("tab", { name: /Requests/ }).getAttribute("aria-selected")).toBe("true"));
    expect(await screen.findByRole("region", { name: "Listing reference" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View listing" }).getAttribute("href")).toBe("/marketplace/book");
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Inbox" }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.getByRole("region", { name: "Listing reference" })).toBeTruthy();
    expect(patch).toHaveBeenCalledWith("/conversations/ad-chat/accept");
  });

  it("does not replace Requests with an older, slower Inbox response", async () => {
    let resolveInbox!: (value: { data: ConversationDto[] }) => void;
    const inbox = new Promise<{ data: ConversationDto[] }>((resolve) => { resolveInbox = resolve; });
    get.mockImplementation((_url, options) => options.params.tab === "requests" ? Promise.resolve({ data: [incoming] }) : inbox);
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Requests/ }));
    await screen.findByText("Ad: Textbook");
    resolveInbox({ data: [{ ...incoming, id: "general", name: "General chat", listing: null, isRequest: false, status: "ACCEPTED" }] });
    await waitFor(() => expect(screen.getByRole("tab", { name: /Requests/ }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByText("Ad: Textbook")).toBeTruthy();
    expect(screen.queryByText("General chat")).toBeNull();
  });
});
