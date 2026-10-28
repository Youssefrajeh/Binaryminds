import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReportButton } from "./ReportButton";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { post } }));

afterEach(cleanup);

function openForm(contentType: "LISTING" | "MESSAGE" | "FILE" = "LISTING") {
  render(<ReportButton contentType={contentType} contentId="abc" />);
  fireEvent.click(screen.getByRole("button", { name: /Report this/ }));
  return screen.getByRole("dialog");
}

describe("ReportButton", () => {
  it("names the content type it reports", () => {
    const dialog = openForm("MESSAGE");
    expect(within(dialog).getByRole("heading", { name: "Report this message" })).toBeTruthy();
  });

  it("requires a reason", async () => {
    const dialog = openForm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await within(dialog).findByText("Choose a reason for your report.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("sends the content type, id, reason and details", async () => {
    post.mockResolvedValue({ data: { id: "r1" } });
    const dialog = openForm("FILE");
    fireEvent.change(within(dialog).getByLabelText("Reason *"), { target: { value: "SCAM" } });
    fireEvent.change(within(dialog).getByLabelText(/Details/), { target: { value: "  Fake link  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await within(dialog).findByText(/Your report was sent/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/reports", {
      targetType: "FILE",
      targetId: "abc",
      reason: "SCAM",
      details: "Fake link",
    });
  });

  it("leaves out empty details", async () => {
    post.mockResolvedValue({ data: { id: "r1" } });
    const dialog = openForm();
    fireEvent.change(within(dialog).getByLabelText("Reason *"), { target: { value: "SPAM" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    await within(dialog).findByText(/Your report was sent/);
    expect(post).toHaveBeenCalledWith("/reports", { targetType: "LISTING", targetId: "abc", reason: "SPAM" });
  });

  it("shows the API error and keeps the form", async () => {
    post.mockRejectedValue({ response: { data: { error: "Already reported" } } });
    const dialog = openForm();
    fireEvent.change(within(dialog).getByLabelText("Reason *"), { target: { value: "SPAM" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await within(dialog).findByText("Already reported")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Send report" })).toBeTruthy();
  });
});
