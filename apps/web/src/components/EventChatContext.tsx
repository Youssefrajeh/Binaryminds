import type { CampusEventDto } from "@campushub/shared";
import { formatEventDateRange, formatTimeRange } from "../lib/format";

export function EventChatContext({ event }: { event: CampusEventDto }) {
  return (
    <section aria-label="Event details" className="max-h-[35dvh] shrink-0 overflow-y-auto border-b border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">About this event{event.status === "CANCELLED" ? " · Cancelled" : ""}</p>
      <h2 className="mt-1 break-words font-semibold text-ink">{event.title}</h2>
      <p className="mt-1">{formatEventDateRange(event.startsAt, event.endDate, event.endsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}</p>
      <p className="break-words">Location: {event.location}</p>
      <p className="break-words">Organizer: {event.organizer?.profile?.displayName || "CampusHub organizer"}</p>
      <details open className="mt-2">
        <summary className="cursor-pointer font-medium text-brand">Description and photo</summary>
        <p className="mt-2 whitespace-pre-wrap break-words">{event.description}</p>
        {event.imageUrl && <img src={event.imageUrl} alt={`Photo for ${event.title}`} className="mt-2 max-h-40 w-full rounded-lg object-contain" />}
      </details>
    </section>
  );
}
