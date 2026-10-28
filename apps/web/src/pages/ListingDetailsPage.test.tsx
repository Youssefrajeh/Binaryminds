import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ListingDetailsPage } from "./ListingDetailsPage";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("../components/MessageButton", () => ({
  MessageButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
const { get, patch, del } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get, patch, delete: del } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

const listing = {
  id: "l1",
  title: "Calculus textbook",
  description: "Barely used",
  priceCents: 4550,
  condition: "LIKE_NEW",
  status: "ACTIVE",
  createdAt: "2026-09-01T00:00:00Z",
  category: { id: "c1", name: "Books", slug: "books" },
  images: [],
  seller: { id: "me", profile: { displayName: "Me" } },
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/marketplace/l1"]}>
      <Routes>
        <Route path="/marketplace/:id" element={<ListingDetailsPage />} />
        <Route path="/marketplace" element={<p>Marketplace home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("ListingDetailsPage owner controls", () => {
  it("shows Edit, Mark as Sold and Delete to the owner", async () => {
    get.mockResolvedValue({ data: listing });
    renderPage();
    expect(await screen.findByRole("link", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark as Sold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Message Seller" })).toBeNull();
  });

  it("never shows owner controls to other students", async () => {
    get.mockResolvedValue({ data: { ...listing, seller: { id: "someone" } } });
    renderPage();
    expect(await screen.findByRole("button", { name: "Message Seller" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as Sold" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("marks the listing as sold and shows the Sold badge", async () => {
    get.mockResolvedValue({ data: listing });
    patch.mockResolvedValue({ data: { ...listing, status: "SOLD" } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mark as Sold" }));
    expect(await screen.findByRole("button", { name: "Sold" })).toBeTruthy();
    expect(patch).toHaveBeenCalledWith("/listings/l1/sold");
    expect(screen.getAllByText("Sold").length).toBeGreaterThan(1);
  });

  it("deletes only after confirming", async () => {
    get.mockResolvedValue({ data: listing });
    del.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep listing" }));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete listing" }));
    expect(await screen.findByText("Marketplace home")).toBeTruthy();
    expect(del).toHaveBeenCalledWith("/listings/l1");
  });

  it("keeps the dialog open with an error when delete fails", async () => {
    get.mockResolvedValue({ data: listing });
    del.mockRejectedValue({ response: { data: { error: "Not allowed" } } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete listing" }));
    expect(await within(screen.getByRole("dialog")).findByText("Not allowed")).toBeTruthy();
  });
});
