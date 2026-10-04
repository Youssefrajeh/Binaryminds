import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get } }));
vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("../components/MessageButton", () => ({
  MessageButton: ({ recipientId }: { recipientId: string }) => <button>Message {recipientId}</button>,
}));

import { MembersPage } from "./MembersPage";

const bob = { id: "b1", displayName: "Bob Builder", avatarUrl: null, program: "Computer Science" };

function renderPage() {
  render(
    <MemoryRouter>
      <MembersPage />
    </MemoryRouter>,
  );
}

const input = () => screen.getByLabelText("Search students by name");

async function typeAndWait(value: string) {
  fireEvent.change(input(), { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MembersPage", () => {
  it("does not search until 2 characters are typed", async () => {
    renderPage();
    await typeAndWait("b");
    expect(get).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 characters/)).toBeTruthy();
  });

  it("debounces and searches by name", async () => {
    get.mockResolvedValue({ data: [bob] });
    renderPage();
    fireEvent.change(input(), { target: { value: "bo" } });
    fireEvent.change(input(), { target: { value: "bob" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/profile/search", { params: { q: "bob" } });
  });

  it("links results to the profile and offers a message button", async () => {
    get.mockResolvedValue({ data: [bob] });
    renderPage();
    await typeAndWait("bob");
    const link = screen.getByRole("link", { name: /Bob Builder/ });
    expect(link.getAttribute("href")).toBe("/u/b1");
    expect(screen.getByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("Message b1")).toBeTruthy();
  });

  it("shows an empty state", async () => {
    get.mockResolvedValue({ data: [] });
    renderPage();
    await typeAndWait("zzz");
    expect(screen.getByText(/No students found/)).toBeTruthy();
  });

  it("shows the server error", async () => {
    get.mockRejectedValue({ response: { data: { error: "Boom" } } });
    renderPage();
    await typeAndWait("bob");
    expect(screen.getByText("Boom")).toBeTruthy();
  });
});
