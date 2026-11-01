import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ListingChatContext } from "./ListingChatContext";

afterEach(cleanup);

describe("ad reference in chat", () => {
  it.each(["ACTIVE", "SOLD", "REMOVED"] as const)("keeps the ad reference visible when its status is %s", (status) => {
    render(<MemoryRouter><ListingChatContext listing={{ id: "book", title: "Textbook", description: "Almost new", priceCents: 2500, condition: "LIKE_NEW", status, imageUrl: "data:image/png;base64,photo", sellerName: "Sam" }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Textbook" })).toBeTruthy();
    expect(screen.getByText("$25.00")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Photo for Textbook" })).toBeTruthy();
    expect(screen.getByText(status === "ACTIVE" ? "Available" : status === "SOLD" ? "Sold" : "Removed")).toBeTruthy();
    if (status === "REMOVED") expect(screen.queryByRole("link", { name: "View listing" })).toBeNull();
    else expect(screen.getByRole("link", { name: "View listing" }).getAttribute("href")).toBe("/marketplace/book");
    fireEvent.click(screen.getByText("Ad details"));
    expect(screen.getByText("Almost new")).toBeTruthy();
  });
});
