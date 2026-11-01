import api from "../lib/api";
import type { CampusEventDto, EventInput } from "@campushub/shared";
export type { EventStatus, EventInput } from "@campushub/shared";
export type CampusEvent = CampusEventDto;

// All event endpoint URLs live here so they change in one place
const BASE = "/events";

/** Who may create events; the API must enforce the same rule */
export function canOrganizeEvents(role: string | undefined) {
  return role === "ORGANIZER" || role === "ADMINISTRATOR";
}

/**
 * Upcoming, non-cancelled events, soonest first. The API is expected to do
 * this already; repeating it here keeps the page correct either way.
 */
export async function listUpcomingEvents(page = 1) {
  const response = await api.get<CampusEvent[]>(BASE, { params: page > 1 ? { page } : {} });
  const now = Date.now();
  return {
    events: response.data
      .filter((event) => event.status === "PUBLISHED" && new Date(event.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    hasMore: response.headers?.["x-has-more"] === "true",
  };
}

export async function listManagedEvents(page = 1) {
  const response = await api.get<CampusEvent[]>(`${BASE}/mine`, { params: page > 1 ? { page } : {} });
  return { events: response.data, hasMore: response.headers?.["x-has-more"] === "true" };
}

export async function listSavedEvents(page = 1) {
  const response = await api.get<CampusEvent[]>(`${BASE}/saved`, { params: page > 1 ? { page } : {} });
  return { events: response.data, hasMore: response.headers?.["x-has-more"] === "true" };
}

export async function rsvpToEvent(id: string) {
  await api.post(`${BASE}/${id}/rsvp`);
}

export async function cancelRsvp(id: string) {
  await api.delete(`${BASE}/${id}/rsvp`);
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
