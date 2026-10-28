import api from "../lib/api";

// All event endpoint URLs live here so they change in one place
const BASE = "/events";

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type CampusEvent = {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  imageUrl: string | null;
  status: EventStatus;
  organizer?: {
    id: string;
    profile?: { displayName: string; avatarUrl?: string | null } | null;
  };
};

/** Who may create events; the API must enforce the same rule */
export function canOrganizeEvents(role: string | undefined) {
  return role === "ORGANIZER" || role === "ADMINISTRATOR";
}

export type EventInput = {
  title: string;
  description: string;
  /** ISO 8601 date-times */
  startsAt: string;
  endsAt: string;
  location: string;
};

/**
 * Upcoming, non-cancelled events, soonest first. The API is expected to do
 * this already; repeating it here keeps the page correct either way.
 */
export async function listUpcomingEvents() {
  const response = await api.get<CampusEvent[]>(BASE);
  const now = Date.now();
  return response.data
    .filter((event) => event.status !== "CANCELLED" && new Date(event.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function getEvent(id: string) {
  const response = await api.get<CampusEvent>(`${BASE}/${id}`);
  return response.data;
}

export async function createEvent(input: EventInput) {
  const response = await api.post<CampusEvent>(BASE, input);
  return response.data;
}

export async function updateEvent(id: string, input: EventInput) {
  const response = await api.put<CampusEvent>(`${BASE}/${id}`, input);
  return response.data;
}

export async function cancelEvent(id: string) {
  const response = await api.patch<CampusEvent>(`${BASE}/${id}/cancel`);
  return response.data;
}
