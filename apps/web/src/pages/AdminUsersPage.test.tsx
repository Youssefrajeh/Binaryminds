import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AdminUsersPage } from "./AdminUsersPage";
import { RoleRoute } from "../components/RoleRoute";
import { EventManagementPage } from "./EventManagementPage";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, patch } }));
const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { id: "admin", role: "ADMINISTRATOR" } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
const student = { id: "s1", email: "sam@fanshaweonline.ca", role: "STUDENT", status: "ACTIVE", emailVerifiedAt: "2026-10-01", profile: { displayName: "Sam Student", avatarUrl: null } };
function showUsers() { render(<MemoryRouter><AdminUsersPage /></MemoryRouter>); }
afterEach(() => { cleanup(); auth.user.role = "ADMINISTRATOR"; });

describe("Admin users page", () => {
  it("offers and saves Administrator for an active verified member", async () => {
    get.mockResolvedValue({ data: [student], headers: {} });
    patch.mockResolvedValue({ data: { ...student, role: "ADMINISTRATOR" } });
    showUsers();
    const select = await screen.findByLabelText("Role for Sam Student");
    fireEvent.change(select, { target: { value: "ADMINISTRATOR" } });
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save role for Sam Student" }));
    await screen.findByText("Sam Student is now an Administrator.");
    expect(patch).toHaveBeenCalledWith("/admin/users/s1/role", { role: "ADMINISTRATOR" });
  });
  it("disables elevated roles for unverified members", async () => {
    get.mockResolvedValue({ data: [{ ...student, emailVerifiedAt: null }], headers: {} });
    showUsers();
    const select = await screen.findByLabelText("Role for Sam Student") as HTMLSelectElement;
    expect(Array.from(select.options).filter((option) => option.disabled).map((option) => option.value)).toEqual(["ORGANIZER", "ADMINISTRATOR"]);
  });
  it("shows accounts and searches by name or email", async () => {
    get.mockResolvedValue({ data: [student], headers: {} });
    showUsers();
    await screen.findByText("Sam Student");
    fireEvent.change(screen.getByLabelText("Name or email"), { target: { value: "sam" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/admin/users", { params: { search: "sam" } }));
  });
  it("promotes a student after the admin explicitly saves the role", async () => {
    get.mockResolvedValue({ data: [student], headers: {} });
    patch.mockResolvedValue({ data: { ...student, role: "ORGANIZER" } });
    showUsers();
    const select = await screen.findByLabelText("Role for Sam Student");
    fireEvent.change(select, { target: { value: "ORGANIZER" } });
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save role for Sam Student" }));
    await screen.findByText("Sam Student is now an Organizer.");
    expect(patch).toHaveBeenCalledWith("/admin/users/s1/role", { role: "ORGANIZER" });
  });
  it("removes organizer access by saving Student", async () => {
    get.mockResolvedValue({ data: [{ ...student, role: "ORGANIZER" }], headers: {} });
    patch.mockResolvedValue({ data: student });
    showUsers();
    fireEvent.change(await screen.findByLabelText("Role for Sam Student"), { target: { value: "STUDENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role for Sam Student" }));
    await screen.findByText("Sam Student is now a Student.");
    expect(patch).toHaveBeenCalledWith("/admin/users/s1/role", { role: "STUDENT" });
  });
  it("protects administrator accounts and reports failed saves", async () => {
    get.mockResolvedValue({ data: [{ ...student, id: "admin", role: "ADMINISTRATOR", profile: { displayName: "Admin" } }, student], headers: {} });
    patch.mockRejectedValue({ response: { data: { error: "Not permitted" } } });
    showUsers();
    await screen.findByText("Protected administrator account");
    expect(screen.queryByLabelText("Role for Admin")).toBeNull();
    fireEvent.change(screen.getByLabelText("Role for Sam Student"), { target: { value: "ORGANIZER" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role for Sam Student" }));
    await screen.findByText("Not permitted");
  });
  it("blocks students from opening the admin route directly", () => {
    auth.user.role = "STUDENT";
    render(<MemoryRouter><RoleRoute roles={["ADMINISTRATOR"]}><AdminUsersPage /></RoleRoute></MemoryRouter>);
    expect(screen.getByText("Access restricted")).toBeTruthy();
    expect(screen.queryByLabelText("Name or email")).toBeNull();
  });
});

describe("Event Management", () => {
  it("shows cancelled own events and provides a create-event link", async () => {
    auth.user.role = "ORGANIZER";
    get.mockResolvedValue({ data: [{ id: "e1", organizerId: "admin", title: "Cancelled workshop", description: "Workshop", startsAt: "2099-01-01T18:00:00Z", endsAt: "2099-01-01T20:00:00Z", location: "Hall", status: "CANCELLED" }], headers: {} });
    render(<MemoryRouter><EventManagementPage /></MemoryRouter>);
    await screen.findByText("Cancelled workshop");
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Create event/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
    expect(get).toHaveBeenCalledWith("/events/mine", { params: {} });
  });
});
