import { Link } from "react-router";
import type { CampusEvent } from "../services/eventService";
import { canOrganizeEvents } from "../services/eventService";
import { useAuth } from "../context/AuthContext";
import { formatEventDateRange, formatTimeRange } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { MessageButton } from "./MessageButton";

export function EventCard({ event, management = false }: { event: CampusEvent; management?: boolean }) {
  const { user } = useAuth();
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
      {management && <div className="mb-3"><StatusBadge tone={event.status === "CANCELLED" ? "danger" : event.status === "PUBLISHED" ? "success" : "neutral"}>{event.status === "CANCELLED" ? "Cancelled" : event.status === "DRAFT" ? "Draft" : "Published"}</StatusBadge></div>}
      {event.imageUrl && <img src={event.imageUrl} alt={`Photo for ${event.title}`} loading="lazy" className="mb-4 max-h-64 w-full rounded-xl object-contain" />}
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">{formatEventDateRange(event.startsAt, event.endDate, event.endsAt)}</p>
      <h2 className="mt-2 break-words text-lg font-semibold text-ink">{event.title}</h2>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{event.description}</p>
      <dl className="mt-4 space-y-1 text-sm text-ink-soft">
        <div className="flex gap-1.5"><dt className="font-medium text-ink">Time:</dt><dd className="min-w-0">{formatTimeRange(event.startsAt, event.endsAt)}</dd></div>
        <div className="flex gap-1.5"><dt className="font-medium text-ink">Where:</dt><dd className="min-w-0 break-words">{event.location}</dd></div>
        <div className="flex gap-1.5"><dt className="font-medium text-ink">Organizer:</dt><dd className="min-w-0 break-words">{event.organizer?.profile?.displayName || "CampusHub organizer"}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-3 pt-5">
        {user?.id === event.organizerId && canOrganizeEvents(user.role) && event.status !== "CANCELLED" && (
          <Link to={`/events/${event.id}/edit`} className="btn-secondary" aria-label={`Edit ${event.title}`}>Edit</Link>
        )}
        {event.status === "PUBLISHED" && <MessageButton recipientId={event.organizerId} eventId={event.id} label="Message organizer" />}
      </div>
    </li>
  );
}
