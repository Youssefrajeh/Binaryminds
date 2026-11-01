import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./AuthContext";
afterEach(() => { cleanup(); localStorage.clear(); });
function Session() { return <span>{useAuth().isAuthenticated ? "Signed in" : "Signed out"}</span>; }
it("recovers from corrupt saved login data without crashing", () => {
  localStorage.setItem("campushub_token", "old-token");
  localStorage.setItem("campushub_user", "{broken-json");
  render(<AuthProvider><Session /></AuthProvider>);
  expect(screen.getByText("Signed out")).toBeTruthy();
  expect(localStorage.getItem("campushub_token")).toBeNull();
});
