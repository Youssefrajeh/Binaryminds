import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { FanshaweEmailInput } from "./FanshaweEmailInput";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { post } }));
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function Harness({ onEmail }: { onEmail: (email: string) => void }) {
  const [email, setEmail] = useState("");
  return <>
    <FanshaweEmailInput id="email" value={email} onChange={(next) => { setEmail(next); onEmail(next); }} />
    <button type="button" onClick={() => setEmail("")}>Clear</button>
  </>;
}
function setup() {
  const onEmail = vi.fn();
  render(<Harness onEmail={onEmail} />);
  const input = screen.getByLabelText("Fanshawe email") as HTMLInputElement;
  // A paste lands in the box as a change, the same way autofill does
  const enter = (value: string) => fireEvent.change(input, { target: { value } });
  return { input, enter, onEmail };
}

describe("FanshaweEmailInput", () => {
  it("shows a fixed @fanshaweonline.ca ending that screen readers hear with the field", () => {
    const { input } = setup();
    const suffix = document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0])!;
    expect(suffix.textContent).toBe("@fanshaweonline.ca");
    expect(suffix.tagName).toBe("SPAN");
    expect(input.placeholder).toBe("your ID, e.g. y_rajeh");
    expect(input.getAttribute("autocomplete")).toBe("username");
    expect(input.getAttribute("inputmode")).toBe("email");
  });

  it("returns the full email for a typed ID, trimmed and lowercased", () => {
    const { input, enter, onEmail } = setup();
    enter("  Y_Rajeh ");
    expect(input.value).toBe("y_rajeh");
    expect(onEmail).toHaveBeenLastCalledWith("y_rajeh@fanshaweonline.ca");
    enter("first.last-2");
    expect(onEmail).toHaveBeenLastCalledWith("first.last-2@fanshaweonline.ca");
  });

  it("keeps only the ID when a full Fanshawe email is pasted, in any case", () => {
    const { input, enter, onEmail } = setup();
    enter("Y_Rajeh@FanshaweOnline.CA");
    expect(input.value).toBe("y_rajeh");
    expect(onEmail).toHaveBeenLastCalledWith("y_rajeh@fanshaweonline.ca");
    expect(screen.queryByText(/Use your/)).toBeNull();
  });

  it("flags another domain without stripping it, and blocks the form", () => {
    const { input, enter, onEmail } = setup();
    enter("sam@gmail.com");
    expect(input.value).toBe("sam@gmail.com");
    expect(screen.getByText("Use your @fanshaweonline.ca email")).toBeTruthy();
    expect(onEmail).toHaveBeenLastCalledWith("");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.validationMessage).toBe("Use your @fanshaweonline.ca email");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByText("Use your @fanshaweonline.ca email").id);
  });

  it("explains which characters an ID may use", () => {
    const { input, enter, onEmail } = setup();
    enter("y rajeh!");
    expect(screen.getByText("Use only letters, numbers, dots, underscores and hyphens")).toBeTruthy();
    expect(onEmail).toHaveBeenLastCalledWith("");
    enter("y_rajeh");
    expect(screen.queryByText(/Use only/)).toBeNull();
    expect(input.validationMessage).toBe("");
  });

  it("empties when the form clears the email", () => {
    const { input, enter } = setup();
    enter("y_rajeh");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(input.value).toBe("");
  });
});

describe("forgot password", () => {
  it("requests a code for the full Fanshawe email", async () => {
    post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Fanshawe email"), { target: { value: "y_rajeh" } });
    fireEvent.submit(document.querySelector("form")!);
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith("/auth/forgot-password", { email: "y_rajeh@fanshaweonline.ca" }));
  });

  it("asks for an ID instead of sending a Gmail address", () => {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Fanshawe email"), { target: { value: "sam@gmail.com" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByText("Enter your Fanshawe ID, e.g. y_rajeh")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});
