import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EditProfilePage } from "./EditProfilePage";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, put } }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", email: "a_student@fanshaweonline.ca" }, updateUser: vi.fn() }),
}));

const profile = {
  id: "me", email: "a_student@fanshaweonline.ca", role: "STUDENT", status: "ACTIVE",
  emailVerifiedAt: null, createdAt: "2026-09-01T00:00:00Z",
  profile: { displayName: "Alex Student", program: "Computer Programming", yearOfStudy: 2, bio: "Hi", avatarUrl: null, interests: ["chess"], courses: ["INFO5103"] },
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("EditProfilePage", () => {
  it("offers no form to save when the profile could not be loaded, so nothing gets blanked", async () => {
    get.mockRejectedValue(new Error("Network Error"));
    render(<MemoryRouter><EditProfilePage /></MemoryRouter>);

    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load your profile");
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it("loads the form after a successful retry", async () => {
    get.mockRejectedValueOnce(new Error("Network Error")).mockResolvedValue({ data: profile });
    render(<MemoryRouter><EditProfilePage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByDisplayValue("Alex Student")).toBeTruthy();
    expect(screen.getByDisplayValue("Computer Programming")).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
