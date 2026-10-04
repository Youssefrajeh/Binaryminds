import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { PasswordChecklist } from "./PasswordChecklist";

const user = { id: "u1", email: "a@b.ca", role: "STUDENT" } as never;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderRoutes() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route path="/secret" element={<ProtectedRoute><div>Secret content</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects guests to /login", () => {
    renderRoutes();
    expect(screen.getByText("Login screen")).toBeTruthy();
    expect(screen.queryByText("Secret content")).toBeNull();
  });

  it("renders children for a logged-in user", () => {
    localStorage.setItem("campushub_token", "t");
    localStorage.setItem("campushub_user", JSON.stringify(user));
    renderRoutes();
    expect(screen.getByText("Secret content")).toBeTruthy();
  });

  it("logs out a token that has no stored user", () => {
    localStorage.setItem("campushub_token", "t");
    renderRoutes();
    expect(screen.getByText("Login screen")).toBeTruthy();
    expect(localStorage.getItem("campushub_token")).toBeNull();
  });
});

describe("AuthContext", () => {
  function Probe() {
    const { isAuthenticated, login, logout } = useAuth();
    return (
      <div>
        <span data-testid="state">{isAuthenticated ? "in" : "out"}</span>
        <button onClick={() => login("tok", user)}>login</button>
        <button onClick={logout}>logout</button>
      </div>
    );
  }

  it("login persists to localStorage and logout clears it", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("state").textContent).toBe("out");

    await ue.click(screen.getByText("login"));
    expect(screen.getByTestId("state").textContent).toBe("in");
    expect(localStorage.getItem("campushub_token")).toBe("tok");

    await ue.click(screen.getByText("logout"));
    expect(screen.getByTestId("state").textContent).toBe("out");
    expect(localStorage.getItem("campushub_token")).toBeNull();
  });

  it("useAuth throws outside the provider", () => {
    function Bad() {
      useAuth();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useAuth must be used inside AuthProvider");
  });
});

describe("PasswordChecklist", () => {
  it("marks unmet rules for an empty password", () => {
    render(<PasswordChecklist password="" />);
    expect(screen.getAllByText("(not met)", { exact: false })).toHaveLength(4);
  });

  it("marks every rule met for a strong password", () => {
    render(<PasswordChecklist password="Str0ng#Pass" />);
    expect(screen.getAllByText("(met)", { exact: false })).toHaveLength(4);
    expect(screen.queryAllByText("(not met)", { exact: false })).toHaveLength(0);
  });
});
