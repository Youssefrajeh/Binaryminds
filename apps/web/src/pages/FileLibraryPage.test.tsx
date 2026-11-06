import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { FileLibraryPage } from "./FileLibraryPage";

// Role queries get slow when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 5000 });

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "student" } }) }));

const file = { id: "f1", name: "week1-notes.pdf", mimeType: "application/pdf", size: 2048, courseCode: "INFO5103", messageId: "m1", uploader: { id: "other", displayName: "Sam Student" }, createdAt: "2026-11-01T12:00:00Z" };

function respond(files: unknown[]) {
  get.mockImplementation(async (url: string) => url === "/files/courses" ? { data: [{ courseCode: "INFO5103", fileCount: 1 }] } : { data: files, headers: {} });
}
function show(path = "/files") { render(<MemoryRouter initialEntries={[path]}><FileLibraryPage /></MemoryRouter>); }

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Course files page", () => {
  it("lists files with their course, size and uploader", async () => {
    respond([file]);
    show();
    expect(await screen.findByRole("button", { name: "week1-notes.pdf" })).toBeTruthy();
    expect(screen.getByText(/INFO5103 · 2 KB · Shared by Sam Student/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report file: week1-notes.pdf" })).toBeTruthy();
  });
  it("filters by course", async () => {
    respond([file]);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "INFO5103 (1)" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/files", { params: { course: "INFO5103" } }));
  });
  it("opens on the course in the link", async () => {
    respond([file]);
    show("/files?course=INFO5103");
    await waitFor(() => expect(get).toHaveBeenCalledWith("/files", { params: { course: "INFO5103" } }));
  });
  it("searches by file name", async () => {
    respond([file]);
    show();
    await screen.findByRole("button", { name: "week1-notes.pdf" });
    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "week1" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/files", { params: { search: "week1" } }));
  });
  it("hides the report action on your own files", async () => {
    respond([{ ...file, uploader: { id: "student", displayName: "Me" } }]);
    show();
    await screen.findByRole("button", { name: "week1-notes.pdf" });
    expect(screen.queryByRole("button", { name: /Report file/ })).toBeNull();
  });
  it("shows an empty state and recovers from errors", async () => {
    respond([]);
    show();
    expect(await screen.findByText("No files have been shared yet.")).toBeTruthy();
    cleanup();
    get.mockRejectedValue({ response: { data: { error: "Could not load files" } } });
    show();
    expect(await screen.findByText("Could not load files")).toBeTruthy();
    respond([file]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "week1-notes.pdf" })).toBeTruthy();
  });
});
