import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { pageTitle } from "../lib/pageTitle";
import { PageTitle } from "./PageTitle";
import { SkipLink } from "./SkipLink";
import { Hero } from "./Hero";
import { Footer } from "./Footer";
import { Nav } from "./Nav";
import { NotFoundPage } from "../pages/NotFoundPage";

const { auth } = vi.hoisted(() => ({
  auth: { isAuthenticated: false, user: null as null | { id: string; email: string; role: string; profile: null }, logout: () => {} },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/SocketContext", () => ({ useSocket: () => ({ unreadTotal: 2, requestCount: 1 }) }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./Logo", () => ({ Logo: () => <span>campus-hub</span> }));

function signIn(role = "STUDENT") {
  auth.isAuthenticated = true;
  auth.user = { id: "u1", email: "sam@fanshaweonline.ca", role, profile: null };
}
afterEach(() => {
  cleanup();
  auth.isAuthenticated = false;
  auth.user = null;
});

describe("tab titles", () => {
  it.each([
    ["/", "Home · campus-hub"],
    ["/marketplace", "Marketplace · campus-hub"],
    ["/marketplace/new", "Sell an item · campus-hub"],
    ["/marketplace/abc123", "Listing · campus-hub"],
    ["/marketplace/abc123/edit", "Edit listing · campus-hub"],
    ["/admin/reports", "Admin · Reports · campus-hub"],
    ["/dashboard", "Page not found · campus-hub"],
  ])("names %s as %j", (path, title) => {
    expect(pageTitle(path)).toBe(title);
  });

  it("updates document.title as the route changes", () => {
    render(<MemoryRouter initialEntries={["/lost-found"]}><PageTitle /></MemoryRouter>);
    expect(document.title).toBe("Lost & Found · campus-hub");
  });
});

describe("catch-all 404", () => {
  it.each(["/dashboard", "/settings", "/no/such/page"])("renders %s inside the normal layout with a way back", (path) => {
    render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/marketplace" element={<p>Market</p>} /><Route path="*" element={<NotFoundPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("main").id).toBe("main");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
  });

  it("sends signed-in students back into the app", () => {
    signIn();
    render(<MemoryRouter initialEntries={["/settings"]}><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Go to Marketplace" }).getAttribute("href")).toBe("/marketplace");
  });
});

describe("skip link", () => {
  it("moves focus to the page's main region", () => {
    render(<><SkipLink /><nav><a href="/x">Header link</a></nav><main id="main">Content</main></>);
    const link = screen.getByRole("link", { name: "Skip to content" });
    fireEvent.click(link);
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
  });
});

describe("signed-in home page", () => {
  it("shows the sign-up reassurance to guests only", () => {
    render(<MemoryRouter><Hero /></MemoryRouter>);
    expect(screen.getByText(/Free to join/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Quick links" })).toBeNull();
  });

  it("replaces it with quick links once signed in", () => {
    signIn();
    render(<MemoryRouter><Hero /></MemoryRouter>);
    expect(screen.queryByText(/Free to join/)).toBeNull();
    const links = within(screen.getByRole("navigation", { name: "Quick links" })).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/marketplace", "/messages", "/study-groups", "/lost-found", "/events", "/files"]);
  });
});

describe("footer", () => {
  it("lists every Explore destination", () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const explore = within(screen.getByRole("navigation", { name: "Explore" }));
    for (const name of ["Marketplace", "Lost & Found", "Events", "Course files", "Find students"]) expect(explore.getByRole("link", { name })).toBeTruthy();
    expect(screen.getByText(/© \d{4} campus-hub\./)).toBeTruthy();
  });

  it("hides Sign up and Log in when signed in", () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Sign up" })).toBeTruthy();
    cleanup();
    signIn();
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });
});

describe("header", () => {
  it("shows a single Admin link to administrators only", () => {
    signIn("STUDENT");
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    cleanup();
    signIn("ADMINISTRATOR");
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin/reports");
  });

  it("badges Messages with unread messages plus pending requests", () => {
    signIn();
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Messages/ }).textContent).toContain("3");
    expect(screen.getByLabelText("3 unread")).toBeTruthy();
  });
});
