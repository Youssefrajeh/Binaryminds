import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MessageButton } from "./MessageButton";

const { post, navigate, auth } = vi.hoisted(() => ({
  post: vi.fn(),
  navigate: vi.fn(),
  auth: { user: { id: "buyer" } as { id: string } | null },
}));
vi.mock("../lib/api", () => ({ default: { post } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("react-router", async (orig) => ({ ...(await orig<typeof import("react-router")>()), useNavigate: () => navigate }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  auth.user = { id: "buyer" };
});

function renderButton(props: Partial<React.ComponentProps<typeof MessageButton>> = {}) {
  render(
    <MemoryRouter>
      <MessageButton recipientId="seller" label="Message Seller" {...props} />
    </MemoryRouter>,
  );
}

describe("MessageButton", () => {
  it("starts a conversation linked to the listing and opens it", async () => {
    post.mockResolvedValue({ data: { id: "c1" } });
    renderButton({ listingId: "l1" });
    fireEvent.click(screen.getByRole("button", { name: "Message Seller" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages/c1"));
    expect(post).toHaveBeenCalledWith("/conversations", { recipientId: "seller", listingId: "l1" });
  });

  it("omits listingId when none is given", async () => {
    post.mockResolvedValue({ data: { id: "c1" } });
    renderButton();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/conversations", { recipientId: "seller" }));
  });

  it("is hidden when you are the seller", () => {
    auth.user = { id: "seller" };
    renderButton();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the server error and stays on the page", async () => {
    post.mockRejectedValue({ response: { data: { error: "Nope" } } });
    renderButton();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Nope")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
