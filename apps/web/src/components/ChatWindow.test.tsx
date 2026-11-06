import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ConversationDto } from "@campushub/shared";
import { ChatWindow } from "./ChatWindow";

const { get, patch, post, socket } = vi.hoisted(() => ({
  get: vi.fn(), patch: vi.fn(), post: vi.fn(),
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), timeout: vi.fn() },
}));
vi.mock("../lib/api", () => ({ default: { get, patch, post } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "student" } }) }));
vi.mock("../context/SocketContext", () => ({ useSocket: () => ({ socket, connected: true }) }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("sharing files", () => {
  const base: ConversationDto = { id: "c1", type: "DIRECT", name: "Other Student", status: "ACCEPTED", isRequest: false, blockedByMe: false, studyGroupId: null, members: [{ id: "student", displayName: "Student", avatarUrl: null }, { id: "other", displayName: "Other Student", avatarUrl: null }], lastMessage: null, unreadCount: 0, updatedAt: "2026-11-01T12:00:00Z" };
  const notes = new File(["%PDF-1.7"], "notes.pdf", { type: "application/pdf" });
  async function open(conversation: ConversationDto) {
    get.mockResolvedValue({ data: { messages: [], hasMore: false, nextCursor: null } });
    patch.mockResolvedValue({ data: {} });
    render(<MemoryRouter><ChatWindow conversation={conversation} meId="student" onRead={vi.fn()} onConversationChanged={vi.fn()} /></MemoryRouter>);
    await screen.findByText(/No messages yet/);
  }
  const choose = (file: File) => fireEvent.change(screen.getByLabelText("Choose a file to share"), { target: { files: [file] } });

  it("uploads a file with the typed message as its caption", async () => {
    await open(base);
    post.mockResolvedValue({ data: { id: "m1", conversationId: "c1", senderId: "student", text: "Week 1", attachments: [{ url: "/api/files/f1/download", name: "notes.pdf", mimeType: "application/pdf", size: 8 }], clientId: "x", createdAt: "2026-11-01T12:00:00Z" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Week 1" } });
    choose(notes);
    expect(await screen.findByRole("button", { name: "notes.pdf" })).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/conversations/c1/files", expect.objectContaining({ name: "notes.pdf", data: btoa("%PDF-1.7"), text: "Week 1" }));
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });
  it("refuses unsupported and oversized files without uploading", async () => {
    await open(base);
    choose(new File(["x"], "virus.exe"));
    expect((await screen.findByRole("alert")).textContent).toContain("Share a PDF");
    choose(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("5 MB"));
    expect(post).not.toHaveBeenCalled();
  });
  it("shows the server error and keeps the typed message", async () => {
    await open(base);
    post.mockRejectedValue({ response: { data: { error: "That file does not match its file type" } } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Keep me" } });
    choose(notes);
    await screen.findByText("That file does not match its file type");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("Keep me");
  });
  it("tells group members that files reach the course library", async () => {
    await open({ ...base, type: "GROUP", name: "Algorithms" });
    expect(screen.getByText(/also appear in Course files/)).toBeTruthy();
  });
  it("offers no upload in a pending message request", async () => {
    await open({ ...base, status: "PENDING" });
    expect(screen.queryByRole("button", { name: "Attach" })).toBeNull();
  });
});

describe("event organizer chat", () => {
  it("offers message/file reports and applies live moderation without losing chat history", async () => {
    const message = { id: "m1", conversationId: "c1", senderId: "other", text: "Original content", attachments: [{ url: "https://example.test/file.pdf", name: "Shared notes.pdf", mimeType: "application/pdf", size: 200 }], clientId: null, createdAt: "2026-10-30T12:00:00Z" };
    get.mockResolvedValue({ data: { messages: [message], hasMore: false, nextCursor: null } });
    const conversation: ConversationDto = { id: "c1", type: "DIRECT", name: "Other Student", status: "ACCEPTED", isRequest: false, blockedByMe: false, studyGroupId: null, members: [{ id: "student", displayName: "Student", avatarUrl: null }, { id: "other", displayName: "Other Student", avatarUrl: null }], lastMessage: null, unreadCount: 0, updatedAt: message.createdAt };
    render(<MemoryRouter><ChatWindow conversation={conversation} meId="student" onRead={vi.fn()} onConversationChanged={vi.fn()} /></MemoryRouter>);
    await screen.findByText("Original content");
    expect(screen.getByRole("button", { name: "Report message" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report file: Shared notes.pdf" })).toBeTruthy();
    const update = socket.on.mock.calls.find(([event]) => event === "message:updated")?.[1];
    expect(update).toBeTypeOf("function");
    act(() => update({ message: { ...message, text: "[Message removed by an administrator]", attachments: [], removedAt: "2026-10-30T13:00:00Z" } }));
    expect(screen.getByText("[Message removed by an administrator]")).toBeTruthy();
    expect(screen.queryByText("Original content")).toBeNull();
    expect(screen.queryByRole("link", { name: "Shared notes.pdf" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Report message" })).toBeNull();
    expect(screen.getByLabelText("Message")).toBeTruthy();
  });
  it("keeps deleted-account history readable without allowing a message to the missing account", async () => {
    get.mockResolvedValue({ data: { messages: [{ id: "old", conversationId: "orphan", senderId: "deleted", text: "An older request", attachments: [], clientId: null, createdAt: "2026-10-01T12:00:00Z" }], hasMore: false, nextCursor: null } });
    patch.mockResolvedValue({ data: {} });
    const conversation: ConversationDto = { id: "orphan", type: "DIRECT", name: "Deleted account", status: "PENDING", isRequest: true, blockedByMe: false, studyGroupId: null, members: [{ id: "student", displayName: "Student", avatarUrl: null }], lastMessage: null, unreadCount: 1, updatedAt: "2026-10-01T12:00:00Z" };
    render(<MemoryRouter><ChatWindow conversation={conversation} meId="student" onRead={vi.fn()} onConversationChanged={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByText("An older request")).toBeTruthy();
    expect(screen.getByText("This account is no longer available. You can still read the conversation history.")).toBeTruthy();
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows durable event details and lets the student send a normal message", async () => {
    get.mockResolvedValue({ data: { messages: [], hasMore: false, nextCursor: null } });
    patch.mockResolvedValue({ data: {} });
    const send = vi.fn((_name, data, ack) => ack(null, { ok: true, message: { ...data, id: "m1", senderId: "student", attachments: [], createdAt: new Date().toISOString() } }));
    socket.timeout.mockReturnValue({ emit: send });
    const conversation: ConversationDto = {
      id: "c1", type: "DIRECT", name: "Organizer", status: "PENDING", isRequest: false, blockedByMe: false,
      studyGroupId: null, members: [{ id: "student", displayName: "Student", avatarUrl: null }, { id: "organizer", displayName: "Organizer", avatarUrl: null }],
      lastMessage: null, unreadCount: 0, updatedAt: new Date().toISOString(),
      event: { id: "e1", organizerId: "organizer", title: "Soccer League", description: "Bring your team", startsAt: "2099-01-01T18:00:00Z", endsAt: null, endDate: "2099-01-20", location: "BMO Centre", imageUrl: "data:image/png;base64,photo", status: "PUBLISHED", organizer: { id: "organizer", profile: { displayName: "Organizer" } } },
    };
    render(<MemoryRouter><ChatWindow conversation={conversation} meId="student" onRead={vi.fn()} onConversationChanged={vi.fn()} /></MemoryRouter>);
    const details = screen.getByRole("region", { name: "Event details" });
    expect(within(details).getByText("Soccer League")).toBeTruthy();
    expect(within(details).getByText("Location: BMO Centre")).toBeTruthy();
    expect(within(details).getByText("Bring your team")).toBeTruthy();
    expect(within(details).getByRole("img", { name: "Photo for Soccer League" })).toBeTruthy();
    await screen.findByText("No messages yet. Say hello!");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Can my team join?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(send).toHaveBeenCalledWith("message:send", expect.objectContaining({ conversationId: "c1", text: "Can my team join?" }), expect.any(Function)));
    expect(screen.getByText("Can my team join?")).toBeTruthy();
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });
});
