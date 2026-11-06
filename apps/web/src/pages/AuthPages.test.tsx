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
    type("login-email", "a");
    type("login-password", "Campus#2026");
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
    type("register-first-name", "Jane");
    type("register-last-name", "Doe");
    type("register-email", good.email);
    type("register-password", good.pw);
    type("register-confirm", good.pw);
    fireEvent.click(field("register-terms"));
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("requires a first and last name", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    type("register-last-name", "  ");
    submit();
    expect(screen.getByText("Please enter your first and last name")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects non-Fanshawe emails client-side", () => {
    renderAt("/register", <RegisterPage />);
    fillValid();
    type("register-email", "a@gmail.com");
    expect(screen.getByText("Use your @fanshaweonline.ca email")).toBeTruthy();
    submit();
    expect(screen.getByText("Enter your Fanshawe ID, e.g. y_rajeh")).toBeTruthy();
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
        firstName: "Jane",
        lastName: "Doe",
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

describe("sign-in form details", () => {
  it("uses the autocomplete tokens password managers expect", () => {
    renderAt("/login", <LoginPage />);
    expect(field("login-email").getAttribute("autocomplete")).toBe("username");
    expect(field("login-email").getAttribute("inputmode")).toBe("email");
    expect(field("login-password").getAttribute("autocomplete")).toBe("current-password");
    cleanup();
    renderAt("/register", <RegisterPage />);
    expect(field("register-email").getAttribute("autocomplete")).toBe("username");
  });

  it("sends the full Fanshawe email when students type only their ID", async () => {
    post.mockResolvedValue({ data: {} });
    renderAt("/login", <LoginPage />);
    type("login-email", " Y_Rajeh ");
    type("login-password", "Campus#2026");
    submit();
    await waitFor(() => expect(post).toHaveBeenCalledWith("/auth/login", { email: "y_rajeh@fanshaweonline.ca", password: "Campus#2026" }));
    cleanup(); post.mockReset(); post.mockResolvedValue({ data: {} });
    renderAt("/register", <RegisterPage />);
    type("register-first-name", "Jane");
    type("register-last-name", "Doe");
    type("register-email", "y_rajeh");
    type("register-password", "Campus#2026");
    type("register-confirm", "Campus#2026");
    fireEvent.click(field("register-terms"));
    submit();
    await waitFor(() => expect(post).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ email: "y_rajeh@fanshaweonline.ca" })));
  });

  it("does not submit an ID with characters Fanshawe IDs never use", () => {
    renderAt("/login", <LoginPage />);
    type("login-email", "y rajeh!");
    type("login-password", "Campus#2026");
    submit();
    expect(screen.getByText("Use only letters, numbers, dots, underscores and hyphens")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("names the two show-password buttons on the register form differently", () => {
    renderAt("/register", <RegisterPage />);
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show confirm password" })).toBeTruthy();
  });

  it("explains a suspension, with the administrator's reason, instead of a generic error", async () => {
    post.mockRejectedValue({ response: { status: 403, data: { error: "Your account is suspended", code: "ACCOUNT_SUSPENDED", reason: "Spam listings" } } });
    renderAt("/login", <LoginPage />);
    type("login-email", "sam@fanshaweonline.ca");
    type("login-password", "Password1!");
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your account is suspended.");
    expect(alert.textContent).toContain("Reason: Spam listings. Contact");
  });

  it("tells a student whose session ended because of a suspension", () => {
    renderAt("/login", <LoginPage />, ["/login?suspended=true"]);
    expect(screen.getByRole("alert").textContent).toContain("Your account is suspended");
    expect(screen.queryByText(/session expired/)).toBeNull();
  });
});
