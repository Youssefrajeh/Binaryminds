import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { post } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock("../components/LoginMascot", () => ({ LoginMascot: () => null }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));

import { VerifyPage } from "./VerifyPage";

const email = "a_student@fanshaweonline.ca";

function renderPage() {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/verify", state: { email } }]}>
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const resendButton = () => screen.getByRole("button", { name: /resend code|sending/i });

async function tick(seconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  post.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VerifyPage", () => {
  it("tells students the email can take a few minutes", () => {
    renderPage();
    expect(screen.getByText(/can take a few minutes to arrive — check Junk too/)).toBeTruthy();
    expect(screen.getByText(new RegExp(email))).toBeTruthy();
  });

  it("starts with the resend button disabled and counting down", async () => {
    renderPage();
    expect((resendButton() as HTMLButtonElement).disabled).toBe(true);
    expect(resendButton().textContent).toBe("Resend code in 60s");
    await tick(10);
    expect(resendButton().textContent).toBe("Resend code in 50s");
  });

  it("enables the button after 60 seconds", async () => {
    renderPage();
    await tick(60);
    expect((resendButton() as HTMLButtonElement).disabled).toBe(false);
    expect(resendButton().textContent).toBe("Resend code");
  });

  it("resends, confirms, and restarts the cooldown", async () => {
    post.mockResolvedValue({ data: {} });
    renderPage();
    await tick(60);
    await act(async () => {
      fireEvent.click(resendButton());
    });
    expect(post).toHaveBeenCalledWith("/auth/resend-verification", { email });
    expect(screen.getByRole("status").textContent).toMatch(/new code is on its way/);
    expect(resendButton().textContent).toBe("Resend code in 60s");
    expect((resendButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the API error when resending fails", async () => {
    post.mockRejectedValue({ response: { data: { error: "Too many attempts." } } });
    renderPage();
    await tick(60);
    await act(async () => {
      fireEvent.click(resendButton());
    });
    expect(screen.getByText("Too many attempts.")).toBeTruthy();
  });
});
