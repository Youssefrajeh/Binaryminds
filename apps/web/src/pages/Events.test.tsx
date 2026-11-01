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
  vi.clearAllMocks();
  auth.user.role = "ORGANIZER";
  auth.user.id = "org";
});

describe("EventsPage", () => {
  it("shows an optional photo and a DM button for another organizer", async () => {
    auth.user.id = "student";
    auth.user.role = "STUDENT";
    get.mockResolvedValue({ data: [event("soccer", 1, { endsAt: null, endDate: "2099-01-20", imageUrl: "data:image/png;base64,photo" })] });
    renderAt("/events");
    expect(await screen.findByRole("img", { name: "Photo for Event soccer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message organizer" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Edit Event soccer" })).toBeNull();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });
  it("shows only upcoming, non-cancelled events, soonest first", async () => {
    get.mockResolvedValue({
      data: [
        event("later", 5),
        event("past", -3),
        event("cancelled", 2, { status: "CANCELLED" }),
        event("draft", 2, { status: "DRAFT" }),
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
  function fillRequired() {
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Soccer" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Bring your team" } });
    fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Start time *"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "BMO Centre" } });
  }

  it.each(["", "2099-01-20"])("saves without an end time and with optional end date %s", async (endDate) => {
    post.mockResolvedValue({ data: event("new", 1) });
    get.mockResolvedValue({ data: [] });
    renderAt("/events/new");
    fillRequired();
    if (endDate) fireEvent.change(screen.getByLabelText("End date (optional)"), { target: { value: endDate } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/events", expect.objectContaining({ endsAt: null, endDate: endDate || null })));
  });

  it("accepts an earlier clock time on a later end date", async () => {
    post.mockResolvedValue({ data: event("new", 1) });
    get.mockResolvedValue({ data: [] });
    renderAt("/events/new");
    fillRequired();
    fireEvent.change(screen.getByLabelText("End date (optional)"), { target: { value: "2099-01-20" } });
    fireEvent.change(screen.getByLabelText("End time (optional)"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(new Date(post.mock.calls[0][1].endsAt).getTime()).toBe(new Date("2099-01-20T10:00").getTime());
  });

  it("rejects an end date before the start date", () => {
    renderAt("/events/new");
    fillRequired();
    fireEvent.change(screen.getByLabelText("End date (optional)"), { target: { value: "2098-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("End date cannot be before the start date.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("uploads, previews, and saves an optional photo", async () => {
    post.mockResolvedValue({ data: event("new", 1) });
    get.mockResolvedValue({ data: [] });
    renderAt("/events/new");
    fillRequired();
    const photo = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "event.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Event photo (optional)"), { target: { files: [photo] } });
    await screen.findByRole("img", { name: "Event photo preview" });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/events", expect.objectContaining({ imageUrl: expect.stringMatching(/^data:image\/png;base64,/) })));
  });

  it("rejects unsupported photos and lets the organizer remove the selection", () => {
    renderAt("/events/new");
    const photo = new File(["svg"], "event.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByLabelText("Event photo (optional)"), { target: { files: [photo] } });
    expect(screen.getByText("Only JPG, PNG, and WebP images are allowed.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create event" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByText("Only JPG, PNG, and WebP images are allowed.")).toBeNull();
  });

  it("loads empty end fields safely and removes an existing photo on edit", async () => {
    get.mockResolvedValue({ data: event("e1", 3, { endsAt: null, endDate: null, imageUrl: "data:image/png;base64,photo" }) });
    put.mockResolvedValue({ data: event("e1", 3) });
    renderAt("/events/e1/edit");
    await screen.findByLabelText("Title *");
    expect((screen.getByLabelText("End date (optional)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("End time (optional)") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith("/events/e1", expect.objectContaining({ endsAt: null, endDate: null, imageUrl: null })));
  });
  it("validates that the end time is after the start time", async () => {
    renderAt("/events/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Games night" } });
    fireEvent.change(screen.getByLabelText("Description *"), { target: { value: "Board games" } });
    fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Start time *"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("End time (optional)"), { target: { value: "17:00" } });
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
    fireEvent.change(screen.getByLabelText("End time (optional)"), { target: { value: "20:00" } });
    fireEvent.change(screen.getByLabelText("Location *"), { target: { value: "SU" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByText("Event created.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/events", expect.objectContaining({
      title: "Games night",
      description: "Board games",
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      endDate: null,
      imageUrl: null,
      location: "SU",
    }));
    expect(new Date(post.mock.calls[0][1].startsAt).getTime()).toBe(new Date("2099-01-01T18:00").getTime());
    expect(new Date(post.mock.calls[0][1].endsAt).getTime()).toBe(new Date("2099-01-01T20:00").getTime());
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
