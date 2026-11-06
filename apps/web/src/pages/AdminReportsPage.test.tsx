import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AdminReportDto } from "@campushub/shared";
import { AdminReportsPage } from "./AdminReportsPage";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, post } }));
vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const report: AdminReportDto = { id: "r1", targetType: "LISTING", targetId: "listing", reason: "SCAM", note: "Please investigate", status: "OPEN", createdAt: "2026-10-30T12:00:00Z", reporter: { name: "Sam Student", email: "sam@fanshaweonline.ca" }, snapshot: { title: "Textbook", text: "Original listing description", authorId: "other", href: "/marketplace/listing" }, actions: [] };
function show() { render(<MemoryRouter><AdminReportsPage /></MemoryRouter>); }

describe("administrator reports page", () => {
  it("loads open reports with reporter, type, reason, note, date, status and a content preview", async () => {
    get.mockResolvedValue({ data: [report], headers: {} }); show();
    await screen.findByText("Textbook");
    expect(get).toHaveBeenCalledWith("/admin/reports", { params: { status: "OPEN" } });
    expect(screen.getByText("Sam Student")).toBeTruthy();
    expect(screen.getByText("sam@fanshaweonline.ca")).toBeTruthy();
    expect(screen.getByText("Scam or fraud")).toBeTruthy();
    expect(screen.getByText("Please investigate")).toBeTruthy();
    // A short preview sits on the card; the full snapshot opens on request
    expect(screen.getByText("Original listing description")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open content" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByRole("link", { name: "Open content" }).getAttribute("href")).toBe("/marketplace/listing");
  });
  it("filters status and content type", async () => {
    get.mockResolvedValue({ data: [], headers: {} }); show();
    await screen.findByText("No reports match these filters.");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "DISMISSED" } });
    fireEvent.change(screen.getByLabelText("Content type"), { target: { value: "MESSAGE" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/admin/reports", { params: { status: "DISMISSED", type: "MESSAGE" } }));
  });
  it.each([["Remove content", "REMOVE_CONTENT", "Content removed and report resolved."], ["Resolve report", "RESOLVE", "Report resolved."], ["Dismiss report", "DISMISS", "Report dismissed."]])("confirms and saves %s with a review note", async (label, action, success) => {
    get.mockResolvedValueOnce({ data: [report], headers: {} }).mockResolvedValue({ data: [], headers: {} });
    post.mockResolvedValue({ data: { id: "r1" } }); show();
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(post).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Review note (optional)"), { target: { value: "Reviewed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: label }));
    await screen.findByText(success);
    expect(post).toHaveBeenCalledWith("/admin/reports/r1/actions", { action, note: "Reviewed" });
  });
  it("preserves the dialog and explains failed moderation actions", async () => {
    get.mockResolvedValue({ data: [report], headers: {} });
    post.mockRejectedValue({ response: { data: { error: "Already reviewed" } } }); show();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss report" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Dismiss report" }));
    await screen.findByText("Already reviewed");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("filters to reports whose content was removed", async () => {
    get.mockResolvedValue({ data: [], headers: {} }); show();
    await screen.findByText("No reports match these filters.");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "REMOVED" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/admin/reports", { params: { status: "REMOVED" } }));
  });
  it("shows which administrator acted and when", async () => {
    get.mockResolvedValue({ data: [{ ...report, status: "REMOVED", actions: [{ action: "REMOVE_CONTENT", note: "Scam listing", createdAt: "2026-10-31T09:30:00Z", admin: "Alex Admin" }] }], headers: {} }); show();
    await screen.findByText("Textbook");
    expect(screen.getAllByText("Content removed").length).toBeGreaterThan(0);
    const audit = screen.getByText((_, element) => element?.tagName === "P" && /by Alex Admin on/.test(element.textContent ?? ""));
    expect(audit.textContent).toContain("Scam listing");
    expect(audit.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-31T09:30:00Z");
  });
  it("does not show moderation controls on closed reports", async () => {
    get.mockResolvedValue({ data: [{ ...report, status: "RESOLVED" }], headers: {} }); show();
    await screen.findByText("Textbook");
    expect(screen.queryByRole("button", { name: "Remove content" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss report" })).toBeNull();
  });
});
