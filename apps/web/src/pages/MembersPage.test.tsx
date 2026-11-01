import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { get, put, updateUser } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), updateUser: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, put } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "self", email: "self@fanshaweonline.ca" }, updateUser }) }));
vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("../components/MessageButton", () => ({
  MessageButton: ({ recipientId }: { recipientId: string }) => <button>Message {recipientId}</button>,
}));

import { MembersPage } from "./MembersPage";
import { EditProfilePage } from "./EditProfilePage";

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
  get.mockReset();
  put.mockReset();
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

  it.each([["Program", "Computer", "program"], ["Course", "info-5103", "course"], ["Interest", "CHESS", "interest"]])("searches by %s without requiring a name", async (label, value, parameter) => {
    get.mockResolvedValue({ data: [{ ...bob, courses: ["INFO5103"], interests: ["chess"] }] });
    renderPage();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(get).toHaveBeenCalledWith("/profile/search", { params: { [parameter]: value } });
    expect(screen.getByText("Bob Builder")).toBeTruthy();
    expect(screen.getByText("Courses: INFO5103")).toBeTruthy();
    expect(screen.getByText("chess")).toBeTruthy();
  });

  it("combines filters and clears them without leaving old results or errors", async () => {
    get.mockResolvedValue({ data: [bob] });
    renderPage();
    fireEvent.change(screen.getByLabelText("Program"), { target: { value: "Computing" } });
    fireEvent.change(screen.getByLabelText("Course"), { target: { value: "INFO5103" } });
    fireEvent.change(screen.getByLabelText("Interest"), { target: { value: "chess" } });
    await typeAndWait("bob");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/profile/search", { params: { q: "bob", program: "Computing", course: "INFO5103", interest: "chess" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("Bob Builder")).toBeNull();
    expect((input() as HTMLInputElement).value).toBe("");
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("paginates filtered results and resets pagination when a filter changes", async () => {
    get.mockResolvedValueOnce({ data: [bob], headers: { "x-has-more": "true" } });
    renderPage();
    fireEvent.change(screen.getByLabelText("Interest"), { target: { value: "chess" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    get.mockResolvedValueOnce({ data: [{ ...bob, id: "next", displayName: "Next Student" }] });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByText("Bob Builder")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(get).toHaveBeenLastCalledWith("/profile/search", { params: { interest: "chess", page: 2 } });
    expect(screen.getByText("Page 2")).toBeTruthy();
    get.mockResolvedValueOnce({ data: [] });
    fireEvent.change(screen.getByLabelText("Program"), { target: { value: "Business" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(get).toHaveBeenLastCalledWith("/profile/search", { params: { interest: "chess", program: "Business" } });
    expect(screen.queryByText("Page 2")).toBeNull();
  });

  it("discards late responses for old filters", async () => {
    let finish!: (value: object) => void;
    get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    await typeAndWait("bob");
    get.mockResolvedValueOnce({ data: [{ ...bob, displayName: "New Match" }] });
    fireEvent.change(screen.getByLabelText("Program"), { target: { value: "Computing" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    await act(async () => { finish({ data: [bob] }); });
    expect(screen.getByText("New Match")).toBeTruthy();
    expect(screen.queryByText("Bob Builder")).toBeNull();
  });

  it("retries a failed search and clears errors immediately when filters are cleared", async () => {
    get.mockRejectedValueOnce({ response: { data: { error: "Try later" } } });
    renderPage();
    await typeAndWait("bob");
    expect(screen.getByRole("alert").textContent).toContain("Try later");
    get.mockResolvedValueOnce({ data: [bob] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.getByText("Bob Builder")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Bob Builder")).toBeNull();
  });
});

describe("editable profile courses", () => {
  it("loads profile details and submits courses, program name, year and interests", async () => {
    get.mockResolvedValueOnce({ data: { profile: { displayName: "Self", program: "Computing", yearOfStudy: 2, courses: ["INFO5103"], interests: ["chess"] } } });
    await act(async () => { render(<MemoryRouter><EditProfilePage /></MemoryRouter>); });
    const courses = screen.getByLabelText("Courses (optional)") as HTMLInputElement;
    expect(courses.value).toBe("INFO5103");
    expect((screen.getByLabelText("Program") as HTMLInputElement).value).toBe("Computing");
    expect((screen.getByLabelText("Year of study") as HTMLSelectElement).value).toBe("2");
    fireEvent.change(screen.getByLabelText("Program"), { target: { value: "Computer Programming" } });
    fireEvent.change(screen.getByLabelText("Year of study"), { target: { value: "3" } });
    fireEvent.change(courses, { target: { value: "INFO-5103, INFO-5104" } });
    put.mockResolvedValue({ data: {} });
    get.mockResolvedValueOnce({ data: { id: "self", profile: { courses: ["INFO5103", "INFO5104"] } } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save profile" })); });
    expect(put).toHaveBeenCalledWith("/profile/me", expect.objectContaining({ courses: ["INFO-5103", "INFO-5104"], program: "Computer Programming", yearOfStudy: 3, interests: ["chess"] }));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ profile: { courses: ["INFO5103", "INFO5104"] } }));
  });
});
