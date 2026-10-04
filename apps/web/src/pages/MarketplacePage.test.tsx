import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { get } }));

const listing = {
  id: "l1",
  title: "Calculus textbook",
  description: "Barely used",
  priceCents: 4550,
  condition: "LIKE_NEW",
  createdAt: "2026-09-01T00:00:00Z",
  category: { id: "c1", name: "Books", slug: "books" },
  images: [],
  seller: { id: "u1" },
};

function mockApi(listings: unknown[] = [listing]) {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/listings/categories" ? [{ id: "c1", name: "Books", slug: "books" }] : listings }),
  );
}

// MarketplacePage keeps a module-level cache, so load a fresh copy per test.
async function renderPage() {
  const { MarketplacePage } = await import("./MarketplacePage");
  render(<MemoryRouter><MarketplacePage /></MemoryRouter>);
}

beforeEach(() => vi.resetModules());
afterEach(cleanup);

describe("MarketplacePage", () => {
  it("renders listings with formatted price and condition", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText("Calculus textbook")).toBeTruthy();
    expect(screen.getByText("$45.50")).toBeTruthy();
    expect(screen.getByText("LIKE NEW")).toBeTruthy();
  });

  it("loads categories into the filter", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByRole("option", { name: "Books" })).toBeTruthy();
  });

  it("sends the condition filter to the API", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Calculus textbook");
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "GOOD" } });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/listings", { params: { condition: "GOOD" } }),
    );
  });

  it("shows an error when the request fails", async () => {
    get.mockImplementation((url: string) =>
      url === "/listings/categories"
        ? Promise.resolve({ data: [] })
        : Promise.reject({ response: { data: { error: "Boom" } } }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage();
    expect(await screen.findByText("Boom")).toBeTruthy();
  });
});
