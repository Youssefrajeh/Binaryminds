import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LostFoundPage } from "./LostFoundPage";
import { CreateLostFoundPage } from "./CreateLostFoundPage";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, post, patch } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

const basePost = {
  id: "p1",
  authorId: "me",
  kind: "LOST",
  title: "Blue water bottle",
  description: "Left it after class",
  category: "OTHER",
  location: "Library",
  occurredOn: "2026-10-01T00:00:00Z",
  imageUrl: null,
  status: "OPEN",
  createdAt: "2026-10-01T00:00:00Z",
};

function mockPosts(posts: unknown[]) {
  get.mockResolvedValue({ data: posts, headers: { "x-has-more": "false" } });
}

function renderList() {
  render(<MemoryRouter><LostFoundPage /></MemoryRouter>);
}

afterEach(cleanup);

describe("LostFoundPage", () => {
  it("shows Open and Resolved badges", async () => {
    mockPosts([basePost, { ...basePost, id: "p2", title: "Keys", status: "RESOLVED" }]);
    renderList();
    expect(await screen.findByText("Blue water bottle")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Resolved")).toBeTruthy();
  });

  it("shows Mark as Resolved only on the owner's open posts", async () => {
    mockPosts([
      basePost,
      { ...basePost, id: "p2", title: "Someone else's", authorId: "other" },
      { ...basePost, id: "p3", title: "Already resolved", status: "RESOLVED" },
    ]);
    renderList();
    await screen.findByText("Someone else's");
    expect(screen.getAllByRole("button", { name: "Mark as Resolved" })).toHaveLength(1);
  });

  it("marks a post as resolved", async () => {
    mockPosts([basePost]);
    patch.mockResolvedValue({ data: { ...basePost, status: "RESOLVED" } });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Mark as Resolved" }));
    expect(await screen.findByText("Resolved")).toBeTruthy();
    expect(patch).toHaveBeenCalledWith("/lost-found/p1/resolve");
    expect(screen.queryByRole("button", { name: "Mark as Resolved" })).toBeNull();
  });

  it("sends filters to the API as query params", async () => {
    mockPosts([basePost]);
    renderList();
    await screen.findByText("Blue water bottle");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "KEYS" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith("/lost-found", {
        params: { category: "KEYS", from: "2026-09-01" },
      }),
    );
  });

  it("rejects a date range that ends before it starts", async () => {
    mockPosts([basePost]);
    renderList();
    await screen.findByText("Blue water bottle");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    expect(await screen.findByText(/start date must be on or before/)).toBeTruthy();
  });

  it("shows a message when nothing matches", async () => {
    mockPosts([]);
    renderList();
    expect(await screen.findByText("No posts yet")).toBeTruthy();
  });

  it("shows the API error when loading fails", async () => {
    get.mockRejectedValue({ response: { data: { error: "Boom" } } });
    renderList();
    expect(await screen.findByText("Boom")).toBeTruthy();
  });
});

describe("CreateLostFoundPage", () => {
  function renderForm() {
    render(<MemoryRouter><CreateLostFoundPage /></MemoryRouter>);
  }

  it("shows field errors and does not submit an empty form", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    expect(await screen.findByText("Title is required.")).toBeTruthy();
    expect(screen.getByText("Location is required.")).toBeTruthy();
    expect(screen.getByText("Select a category.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts a valid form and shows success", async () => {
    post.mockResolvedValue({ data: basePost });
    renderForm();
    fireEvent.click(screen.getByLabelText("I found something"));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Wallet" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Brown leather" } });
    fireEvent.change(screen.getByLabelText("Category *"), { target: { value: "OTHER" } });
    fireEvent.change(screen.getByLabelText("Date found *"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "Cafeteria" } });
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));

    expect(await screen.findByText(/Your post is live/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/lost-found", {
      kind: "FOUND",
      title: "Wallet",
      description: "Brown leather",
      category: "OTHER",
      location: "Cafeteria",
      occurredOn: "2026-10-01",
      imageUrl: null,
    });
  });

  it("shows the API error when posting fails", async () => {
    post.mockRejectedValue({ response: { data: { error: "Server says no" } } });
    renderForm();
    fireEvent.click(screen.getByLabelText("I lost something"));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Wallet" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Brown" } });
    fireEvent.change(screen.getByLabelText("Category *"), { target: { value: "OTHER" } });
    fireEvent.change(screen.getByLabelText("Date lost *"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "Gym" } });
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    expect(await screen.findByText("Server says no")).toBeTruthy();
  });
});
