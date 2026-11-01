import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { CampusEvent } from "../services/eventService";
import { canOrganizeEvents, cancelRsvp, rsvpToEvent } from "../services/eventService";
import { apiErrorMessage } from "../lib/errors";
import { useAuth } from "../context/AuthContext";
import { formatEventDateRange, formatTimeRange } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { MessageButton } from "./MessageButton";

export function EventCard({ event, management = false, onRsvpChange }: { event: CampusEvent; management?: boolean; onRsvpChange?: (id: string, saved: boolean) => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewedAt] = useState(Date.now);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const ended = new Date(event.startsAt).getTime() <= viewedAt;
  async function toggleRsvp() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (event.isRsvped) await cancelRsvp(event.id);
      else await rsvpToEvent(event.id);
      if (mounted.current) onRsvpChange?.(event.id, !event.isRsvped);
    } catch (err) {
      if (mounted.current) setError(apiErrorMessage(err, "Could not update your RSVP. Please try again."));
    } finally { if (mounted.current) setSaving(false); }
  }
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
      {management && <div className="mb-3"><StatusBadge tone={event.status === "CANCELLED" ? "danger" : event.status === "PUBLISHED" ? "success" : "neutral"}>{event.status === "CANCELLED" ? "Cancelled" : event.status === "DRAFT" ? "Draft" : "Published"}</StatusBadge></div>}
      {!management && event.status === "CANCELLED" && <div className="mb-3"><StatusBadge tone="danger">Cancelled</StatusBadge></div>}
      {!management && ended && event.status !== "CANCELLED" && <div className="mb-3"><StatusBadge tone="neutral">Started / past event</StatusBadge></div>}
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
        {onRsvpChange && (event.isRsvped || (event.status === "PUBLISHED" && !ended)) && (
          <button type="button" className={event.isRsvped ? "btn-secondary" : "btn-primary"} disabled={saving} aria-label={`${event.isRsvped ? "Cancel RSVP for" : "RSVP to"} ${event.title}`} onClick={toggleRsvp}>
            {saving ? "Saving..." : event.isRsvped ? "Cancel RSVP" : "RSVP"}
          </button>
        )}
        {onRsvpChange && event.isRsvped && <span className="self-center text-sm font-medium text-success">RSVP saved</span>}
        {user?.id === event.organizerId && canOrganizeEvents(user.role) && event.status !== "CANCELLED" && (
          <Link to={`/events/${event.id}/edit`} className="btn-secondary" aria-label={`Edit ${event.title}`}>Edit</Link>
        )}
        {event.status === "PUBLISHED" && <MessageButton recipientId={event.organizerId} eventId={event.id} label="Message organizer" />}
      </div>
      {error && <p role="alert" className="alert-error mt-3">{error}</p>}
    </li>
  );
}
