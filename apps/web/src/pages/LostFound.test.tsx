import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillForm() {
  fireEvent.click(screen.getByLabelText("I found something"));
  fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Wallet" } });
  fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Brown leather" } });
  fireEvent.change(screen.getByLabelText("Category *"), { target: { value: "OTHER" } });
  fireEvent.change(screen.getByLabelText("Date found *"), { target: { value: "2020-10-01" } });
  fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "Cafeteria" } });
}

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

  it("combines all filters and clears them back to the unfiltered first page", async () => {
    mockPosts([basePost]);
    renderList();
    await screen.findByText("Blue water bottle");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: " wallet " } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "FOUND" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "KEYS" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: " library " } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2020-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2020-10-02" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/lost-found", {
      params: { search: "wallet", kind: "FOUND", category: "KEYS", location: "library", from: "2020-10-01", to: "2020-10-02" },
    }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/lost-found", { params: {} }));
    expect((screen.getByLabelText("Location") as HTMLInputElement).value).toBe("");
  });

  it("shows the filtered empty state", async () => {
    mockPosts([]);
    renderList();
    await screen.findByText("No posts yet");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "KEYS" } });
    expect(await screen.findByText("No posts match your filters")).toBeTruthy();
  });

  it("retries a failed later page without skipping it or hiding existing posts", async () => {
    get.mockResolvedValueOnce({ data: [basePost], headers: { "x-has-more": "true" } });
    renderList();
    await screen.findByText("Blue water bottle");
    get.mockRejectedValueOnce({ response: { data: { error: "Try later" } } });
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText("Try later");
    expect(screen.getByText("Blue water bottle")).toBeTruthy();
    get.mockResolvedValueOnce({ data: [basePost, { ...basePost, id: "p2", title: "Keys" }], headers: { "x-has-more": "false" } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Keys");
    expect(get).toHaveBeenLastCalledWith("/lost-found", { params: { page: 2 } });
    expect(screen.getAllByText("Blue water bottle")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("starts again at page one when a filter changes after loading more", async () => {
    get.mockResolvedValueOnce({ data: [basePost], headers: { "x-has-more": "true" } });
    renderList();
    await screen.findByText("Blue water bottle");
    mockPosts([{ ...basePost, id: "p2", title: "Other item" }]);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Other item");
    mockPosts([{ ...basePost, id: "p3", title: "Matching keys", category: "KEYS" }]);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "KEYS" } });
    await screen.findByText("Matching keys");
    expect(get).toHaveBeenLastCalledWith("/lost-found", { params: { category: "KEYS" } });
    expect(screen.queryByText("Blue water bottle")).toBeNull();
    expect(screen.queryByText("Other item")).toBeNull();
  });

  it("ignores an older response after filters have changed", async () => {
    let finishOld!: (value: unknown) => void;
    get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    renderList();
    await waitFor(() => expect(finishOld).toBeTypeOf("function"));
    mockPosts([{ ...basePost, title: "Matching keys", category: "KEYS" }]);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "KEYS" } });
    await screen.findByText("Matching keys");
    await act(async () => finishOld({ data: [basePost], headers: {} }));
    expect(screen.getByText("Matching keys")).toBeTruthy();
    expect(screen.queryByText("Blue water bottle")).toBeNull();
  });

  it("offers contact only for another student's open report", async () => {
    mockPosts([basePost, { ...basePost, id: "p2", authorId: "other", title: "Another student's item" },
      { ...basePost, id: "p3", authorId: "other", title: "Resolved item", status: "RESOLVED" }]);
    renderList();
    await screen.findByText("Another student's item");
    post.mockResolvedValueOnce({ data: { id: "chat1" } });
    fireEvent.click(screen.getByRole("button", { name: "Message poster" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/conversations", { recipientId: "other" }));
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

  it("submits a selected photo as a data URL and resets the form after saving", async () => {
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:photo");
      static revokeObjectURL = vi.fn();
    });
    post.mockResolvedValueOnce({ data: basePost });
    renderForm();
    fillForm();
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    expect(screen.getByAltText("Selected item photo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    await screen.findByText(/Your post is live/);
    expect(post).toHaveBeenCalledWith("/lost-found", expect.objectContaining({ imageUrl: "data:image/png;base64,iVBORw0KGgo=" }));
    expect((screen.getByLabelText("Title *") as HTMLInputElement).value).toBe("");
    expect(screen.queryByAltText("Selected item photo")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it.each([
    ["unsupported type", new File(["text"], "notes.txt", { type: "text/plain" }), /Only JPG, PNG, and WebP/],
    ["oversized photo", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }), /smaller than 2 MB/],
  ])("blocks %s before posting", async (_name, file, message) => {
    renderForm();
    fillForm();
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    expect(screen.getByText(message)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("rejects future dates without sending a request", async () => {
    renderForm();
    fillForm();
    fireEvent.change(screen.getByLabelText("Date found *"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    expect(screen.getByText("Date cannot be in the future.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});
