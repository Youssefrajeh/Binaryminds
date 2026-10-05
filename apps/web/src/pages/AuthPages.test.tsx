import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const { post, login } = vi.hoisted(() => ({ post: vi.fn(), login: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { post } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login }) }));
vi.mock("../components/LoginMascot", () => ({ LoginMascot: () => null }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));

import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function field(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}
function type(id: string, value: string) {
  fireEvent.change(field(id), { target: { value } });
}
function submit() {
  fireEvent.submit(document.querySelector("form")!);
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + JSON.stringify(loc.state ?? {})}</div>;
}

function renderAt(path: string, element: React.ReactNode, initialEntries = [path]) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the server error and re-enables the button on failure", async () => {
    post.mockRejectedValue({ response: { data: { error: "Invalid email or password" } } });
    renderAt("/login", <LoginPage />);
    type("login-email", "a@fanshaweonline.ca");
    type("login-password", "x");
    submit();
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement).disabled).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });

  it("falls back to a generic error", async () => {
    post.mockRejectedValue(new Error("network"));
    renderAt("/login", <LoginPage />);
    submit();
    expect(await screen.findByText("Something went wrong")).toBeTruthy();
  });

  it("logs in and navigates home after success", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    post.mockResolvedValue({ data: { token: "tok", user: { id: "u1" } } });
    renderAt("/login", <LoginPage />);
    type("login-email", "a@fanshaweonline.ca");
    type("login-password", "Campus#2026");
    submit();

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/auth/login", { email: "a@fanshaweonline.ca", password: "Campus#2026" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(login).toHaveBeenCalledWith("tok", { id: "u1" });
    expect(screen.getByTestId("loc").textContent).toContain("/");
  });

  it("links to registration", () => {
    renderAt("/login", <LoginPage />);
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/register");
  });

  it("displays session expired alert if ?expired=true is present", () => {
    renderAt("/login", <LoginPage />, ["/login?expired=true"]);
    expect(screen.getByText(/session expired after 10 minutes/i)).toBeTruthy();
  });
});

describe("RegisterPage", () => {
  const good = { email: "a@fanshaweonline.ca", pw: "Campus#2026" };

  function fillValid() {
    type("register-email", good.email);
    type("register-password", good.pw);
    type("register-confirm", good.pw);
    fireEvent.click(field("register-terms"));
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects non-Fanshawe emails client-side", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    type("register-email", "a@gmail.com");
    submit();
    expect(screen.getByText(/Fanshawe student email/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects weak passwords", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    type("register-password", "weak");
    type("register-confirm", "weak");
    submit();
    expect(screen.getByText(/does not meet all the requirements/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords and shows the indicator", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    type("register-confirm", "Different#1");
    expect(screen.getByText("Passwords don't match yet")).toBeTruthy();
    submit();
    expect(screen.getByText("Passwords do not match")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a match indicator when passwords agree", () => {
    renderAt("/register", <RegisterPage />);
    type("register-password", good.pw);
    type("register-confirm", good.pw);
    expect(screen.getByText("Passwords match!")).toBeTruthy();
  });

  it("requires accepting the terms", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    fireEvent.click(field("register-terms"));
    submit();
    expect(screen.getByText(/accept the Terms and Conditions/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the registration and goes to /verify with the email", async () => {
    post.mockResolvedValue({ data: {} });
    renderAt("/register", <RegisterPage />);
    fillValid();
    submit();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/auth/register", {
        email: good.email,
        password: good.pw,
        acceptTerms: true,
      }),
    );
    expect((await screen.findByTestId("loc")).textContent).toContain("/verify");
    expect(screen.getByTestId("loc").textContent).toContain(good.email);
  });

  it("shows the server error", async () => {
    post.mockRejectedValue({ response: { data: { error: "An account with this email already exists" } } });
    renderAt("/register", <RegisterPage />);
    fillValid();
    submit();
    expect(await screen.findByText("An account with this email already exists")).toBeTruthy();
  });
});
