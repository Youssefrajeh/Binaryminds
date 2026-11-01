import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { StudyGroupsPage } from "./StudyGroupsPage";
import { StudyGroupDetailsPage } from "./StudyGroupDetailsPage";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, post } }));
vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));

const group = { id: "group-1", name: "Exam revision", courseCode: "INFO5103", description: "Review together", memberCount: 1, isMember: true, conversationId: "chat-1", createdAt: "2026-11-01T12:00:00Z" };
const member = { id: "student-1", displayName: "Student One", avatarUrl: null, program: "Computing", yearOfStudy: 2, joinedAt: "2026-11-01T12:00:00Z", isCreator: true };
function renderDetails() {
  render(<MemoryRouter initialEntries={["/study-groups/group-1"]}><Routes>
    <Route path="/study-groups/:id" element={<StudyGroupDetailsPage />} />
    <Route path="/study-groups" element={<p>All study groups</p>} />
  </Routes></MemoryRouter>);
}
function mockDetails(isMember = true, memberCount = 1) {
  get.mockImplementation(async (url: string) => ({ data: url.endsWith("/members") ? [member] : { ...group, createdById: member.id, isMember, memberCount, conversationId: isMember ? "chat-1" : null } }));
}
function renderPage() { render(<MemoryRouter><StudyGroupsPage /></MemoryRouter>); }
async function openForm() {
  await waitFor(() => expect((screen.getByRole("button", { name: "New group" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "New group" }));
}
function fillForm() {
  fireEvent.change(screen.getByLabelText("Group name *"), { target: { value: " Exam revision " } });
  fireEvent.change(screen.getByLabelText("Course code *"), { target: { value: " info-5103 " } });
  fireEvent.change(screen.getByLabelText("Description *"), { target: { value: " Review together " } });
}

beforeEach(() => { get.mockReset(); post.mockReset(); get.mockResolvedValue({ data: [] }); });
afterEach(cleanup);

describe("study-group creation", () => {
  it("creates a group with name, course and description and shows its ready-to-use chat", async () => {
    post.mockResolvedValue({ data: group });
    renderPage();
    await openForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByText("Study group created. You are its first member and the group chat is ready.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/study-groups", { name: "Exam revision", courseCode: "info-5103", description: "Review together" });
    expect(screen.getByRole("heading", { name: "Exam revision" })).toBeTruthy();
    expect(screen.getByText("INFO5103")).toBeTruthy();
    expect(screen.getByText("Review together")).toBeTruthy();
    expect(screen.getByText("1 member")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open chat" }).getAttribute("href")).toBe("/messages/chat-1");
    expect(screen.queryByRole("form", { name: "Create study group" })).toBeNull();
    cleanup();
    get.mockResolvedValueOnce({ data: [group] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Exam revision" })).toBeTruthy();
  });

  it("rejects whitespace-only required fields before sending a request", async () => {
    renderPage();
    await openForm();
    fillForm();
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Group name, course code and description are required.");
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps the draft on a server error and allows retry", async () => {
    post.mockRejectedValueOnce({ response: { data: { error: "Please try again" } } });
    renderPage();
    await openForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Please try again");
    expect((screen.getByLabelText("Group name *") as HTMLInputElement).value).toBe(" Exam revision ");
    post.mockResolvedValueOnce({ data: group });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByRole("heading", { name: "Exam revision" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("prevents repeated submissions and cancellation while the group is saving", async () => {
    let finish!: (value: object) => void;
    post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    await openForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Create study group" }));
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ data: group }); });
    expect(screen.getByRole("heading", { name: "Exam revision" })).toBeTruthy();
  });

  it("cancels a draft without saving and retries an initial loading error", async () => {
    get.mockRejectedValueOnce(new Error("Offline"));
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toContain("Failed to load study groups");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("No study groups yet. Create the first one for your course.");
    await openForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Create study group" })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("paginates groups and returns to the newest page after creating from a later page", async () => {
    get.mockResolvedValueOnce({ data: [group], headers: { "x-has-more": "true" } });
    renderPage();
    await screen.findByRole("heading", { name: "Exam revision" });
    get.mockResolvedValueOnce({ data: [{ ...group, id: "older", name: "Older group" }] });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Older group" });
    expect(get).toHaveBeenLastCalledWith("/study-groups", { params: { page: 2 } });
    await openForm();
    fillForm();
    post.mockResolvedValueOnce({ data: group });
    get.mockResolvedValueOnce({ data: [group] });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByRole("heading", { name: "Exam revision" })).toBeTruthy();
    expect(get).toHaveBeenLastCalledWith("/study-groups", { params: {} });
    expect(screen.queryByRole("heading", { name: "Older group" })).toBeNull();
    expect(screen.queryByText("Page 2")).toBeNull();
  });
});

describe("study-group discovery and members", () => {
  it("links discovered groups to their details and member lists", async () => {
    get.mockResolvedValue({ data: [group] });
    renderPage();
    const link = await screen.findByRole("link", { name: "View details & members" });
    expect(link.getAttribute("href")).toBe("/study-groups/group-1");
    expect(screen.getByRole("link", { name: "Exam revision" }).getAttribute("href")).toBe("/study-groups/group-1");
  });

  it("shows group details and public member profiles before joining", async () => {
    mockDetails(false);
    renderDetails();
    expect(await screen.findByRole("heading", { name: "Exam revision" })).toBeTruthy();
    expect(screen.getByText("Review together")).toBeTruthy();
    expect(screen.getByText("INFO5103")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Student One/ }).getAttribute("href")).toBe("/u/student-1");
    expect(screen.getByText("Computing · Year 2")).toBeTruthy();
    expect(screen.getByText("Creator")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join group" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open chat" })).toBeNull();
  });

  it("joins and refreshes membership controls and chat access", async () => {
    mockDetails(false);
    renderDetails();
    const join = await screen.findByRole("button", { name: "Join group" });
    mockDetails(true, 2);
    post.mockResolvedValue({ data: { conversationId: "chat-1" } });
    fireEvent.click(join);
    expect(await screen.findByRole("link", { name: "Open chat" })).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/study-groups/group-1/join");
    expect(screen.getByRole("button", { name: "Leave group" })).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join group" })).toBeNull();
  });

  it("confirms leaving, removes chat controls, and permits rejoining", async () => {
    mockDetails(true, 2);
    renderDetails();
    fireEvent.click(await screen.findByRole("button", { name: "Leave group" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Stay in group" }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));
    mockDetails(false);
    post.mockResolvedValue({ data: { deleted: false } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave group" }));
    expect(await screen.findByRole("button", { name: "Join group" })).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/study-groups/group-1/leave");
    expect(screen.queryByRole("link", { name: "Open chat" })).toBeNull();
  });

  it("warns the last member and returns to discovery after closing the group", async () => {
    mockDetails();
    renderDetails();
    fireEvent.click(await screen.findByRole("button", { name: "Leave group" }));
    expect(screen.getByText("You are the last member. Leaving will delete this group and its chat.")).toBeTruthy();
    post.mockResolvedValue({ data: { deleted: true } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave group" }));
    expect(await screen.findByText("All study groups")).toBeTruthy();
  });

  it("paginates members and keeps the group context", async () => {
    get.mockImplementation(async (url: string, options?: { params?: { page?: number } }) => {
      if (!url.endsWith("/members")) return { data: { ...group, createdById: member.id } };
      return options?.params?.page === 2
        ? { data: [{ ...member, id: "next", displayName: "Next Member" }] }
        : { data: [member], headers: { "x-has-more": "true" } };
    });
    renderDetails();
    await screen.findByRole("link", { name: /Student One/ });
    fireEvent.click(screen.getByRole("button", { name: "Next members" }));
    expect(await screen.findByRole("link", { name: /Next Member/ })).toBeTruthy();
    expect(get).toHaveBeenLastCalledWith("/study-groups/group-1/members", { params: { page: 2 } });
    expect(screen.getByRole("heading", { name: "Exam revision" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Student One/ })).toBeNull();
  });

  it("shows recoverable errors without changing membership", async () => {
    get.mockRejectedValueOnce({ response: { data: { error: "Study group not found" } } });
    get.mockResolvedValueOnce({ data: [] });
    renderDetails();
    expect((await screen.findByRole("alert")).textContent).toContain("Study group not found");
    mockDetails(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const join = await screen.findByRole("button", { name: "Join group" });
    post.mockRejectedValueOnce({ response: { data: { error: "Please retry joining" } } });
    fireEvent.click(join);
    expect((await screen.findByRole("alert")).textContent).toContain("Please retry joining");
    expect(screen.getByRole("button", { name: "Join group" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
  });

  it("uses confirmation and refreshes the discovery list after leaving", async () => {
    get.mockResolvedValueOnce({ data: [{ ...group, memberCount: 2 }] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));
    get.mockResolvedValueOnce({ data: [{ ...group, isMember: false, conversationId: null, memberCount: 1 }] });
    post.mockResolvedValueOnce({ data: { deleted: false } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave group" }));
    expect(await screen.findByRole("button", { name: "Join" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave" })).toBeNull();
  });
});
