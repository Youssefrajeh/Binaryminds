import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportButton } from "./ReportButton";

const { post, auth } = vi.hoisted(() => ({ post: vi.fn(), auth: { user: { id: "student" } as { id: string } | null } }));
vi.mock("../lib/api", () => ({ default: { post } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); vi.resetAllMocks(); auth.user = { id: "student" }; });
function show(extra: Partial<React.ComponentProps<typeof ReportButton>> = {}) {
  render(<ReportButton targetType="LISTING" targetId="listing" ownerId="other" label="Report listing: Textbook" {...extra} />);
}
describe("report form", () => {
  it("opens a small dialog, requires a reason, and saves an optional note", async () => {
    post.mockResolvedValue({ data: { id: "r1" } });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Report listing: Textbook" }));
    expect(screen.getByRole("dialog", { name: "Report listing: Textbook" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByText("Choose a reason for this report.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason *"), { target: { value: "SCAM" } });
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "  Suspicious payment request  " } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByText("Report sent. An administrator will review it.");
    expect(post).toHaveBeenCalledWith("/reports", { targetType: "LISTING", targetId: "listing", reason: "SCAM", note: "Suspicious payment request" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("supports file-specific reporting without a note", async () => {
    post.mockResolvedValue({ data: {} });
    show({ targetType: "FILE", targetId: "message", attachmentIndex: 1 });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByLabelText("Reason *"), { target: { value: "OTHER" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/reports", { targetType: "FILE", targetId: "message", attachmentIndex: 1, reason: "OTHER" }));
  });
  it("keeps a failed report open and lets the student retry", async () => {
    post.mockRejectedValueOnce({ response: { data: { error: "Try later" } } }).mockResolvedValueOnce({ data: { alreadyReported: true } });
    show(); fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByLabelText("Reason *"), { target: { value: "HARASSMENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByText("Try later");
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByText("Already reported. An administrator will review it.");
  });
  it("can cancel without saving", () => {
    show(); fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
  it("hides the control for the content owner", () => { show({ ownerId: "student" }); expect(screen.queryByRole("button")).toBeNull(); });
  it("hides the control when signed out", () => { auth.user = null; show(); expect(screen.queryByRole("button")).toBeNull(); });
});
