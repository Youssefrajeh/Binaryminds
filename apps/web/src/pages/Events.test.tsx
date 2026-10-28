import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { EventsPage } from "./EventsPage";
import { EventFormPage } from "./EventFormPage";

vi.mock("../components/Nav", () => ({ Nav: () => <nav /> }));
const { get, post, put, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));
vi.mock("../lib/api", () => ({ default: { get, post, put, patch } }));
const auth = vi.hoisted(() => ({
  user: { id: "org", role: "ORGANIZER", email: "o@x.ca", profile: { displayName: "Events Club" } },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

const DAY = 86_400_000;
function event(id: string, offsetDays: number, extra: object = {}) {
  const start = new Date(Date.now() + offsetDays * DAY);
  return {
    id,
    organizerId: "org",
    title: `Event ${id}`,
    description: "Fun",
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    location: "Student Union",
    imageUrl: null,
    status: "PUBLISHED",
    organizer: { id: "org", profile: { displayName: "Events Club" } },
    ...extra,
  };
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/new" element={<EventFormPage />} />
        <Route path="/events/:id/edit" element={<EventFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  auth.user.role = "ORGANIZER";
  auth.user.id = "org";
});

describe("EventsPage", () => {
  it("shows only upcoming, non-cancelled events, soonest first", async () => {
    get.mockResolvedValue({
      data: [
        event("later", 5),
        event("past", -3),
        event("cancelled", 2, { status: "CANCELLED" }),
        event("soon", 1),
      ],
    });
    renderAt("/events");
    await screen.findByText("Event soon");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Event soon", "Event later"]);
    expect(screen.getAllByText("Events Club")).toHaveLength(2);
  });

  it("shows an empty state", async () => {
    get.mockResolvedValue({ data: [] });
    renderAt("/events");
    expect(await screen.findByText("No upcoming events")).toBeTruthy();
  });

  it("shows an error with a retry", async () => {
    get.mockRejectedValueOnce({ response: { data: { error: "Down" } } });
    get.mockResolvedValueOnce({ data: [event("a", 1)] });
    renderAt("/events");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Event a")).toBeTruthy();
  });

  it("hides Create event from students", async () => {
    auth.user.role = "STUDENT";
    get.mockResolvedValue({ data: [event("a", 1)] });
    renderAt("/events");
    await screen.findByText("Event a");
    expect(screen.queryByRole("link", { name: /Create event/ })).toBeNull();
  });
});

describe("EventFormPage", () => {
  it("validates that the end time is after the start time", async () => {
    renderAt("/events/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Games night" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Board games" } });
    fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Start time *"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("End time *"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "SU" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(await screen.findByText("End time must be after the start time.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("creates an event and returns to the list", async () => {
    post.mockResolvedValue({ data: event("new", 1) });
    get.mockResolvedValue({ data: [] });
    renderAt("/events/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Games night" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Board games" } });
    fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Start time *"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("End time *"), { target: { value: "20:00" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "SU" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByText("Event created.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/events", {
      title: "Games night",
      description: "Board games",
      startsAt: new Date("2099-01-01T18:00").toISOString(),
      endsAt: new Date("2099-01-01T20:00").toISOString(),
      location: "SU",
    });
  });

  it("prefills the form when editing and saves with PUT", async () => {
    get.mockResolvedValue({ data: event("e1", 3) });
    put.mockResolvedValue({ data: event("e1", 3) });
    renderAt("/events/e1/edit");
    const title = (await screen.findByLabelText("Title *")) as HTMLInputElement;
    expect(title.value).toBe("Event e1");
    fireEvent.change(title, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/events/e1", expect.objectContaining({ title: "Renamed" })),
    );
  });

  it("blocks editing by someone other than the organizer", async () => {
    auth.user.id = "someone-else";
    get.mockResolvedValue({ data: event("e1", 3) });
    renderAt("/events/e1/edit");
    expect(await screen.findByText("Only the event's organizer can edit it.")).toBeTruthy();
    expect(screen.queryByLabelText("Title *")).toBeNull();
  });

  it("cancels an event only after confirming", async () => {
    get.mockResolvedValueOnce({ data: event("e1", 3) });
    get.mockResolvedValue({ data: [] });
    patch.mockResolvedValue({ data: event("e1", 3, { status: "CANCELLED" }) });
    renderAt("/events/e1/edit");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel event" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep event" }));
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel event" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel event" }));
    expect(await screen.findByText("Event cancelled.")).toBeTruthy();
    expect(patch).toHaveBeenCalledWith("/events/e1/cancel");
  });
});
