import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Nav } from "../components/Nav";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import { formatEventDate, formatTimeRange } from "../lib/format";
import { canOrganizeEvents, listUpcomingEvents, type CampusEvent } from "../services/eventService";

export function EventsPage() {
  const { user } = useAuth();
  const location = useLocation();
  // The form sends a short confirmation here after saving or cancelling
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let stale = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const upcoming = await listUpcomingEvents();
        if (!stale) setEvents(upcoming);
      } catch (err) {
        if (!stale) setError(apiErrorMessage(err, "Failed to load events."));
      } finally {
        if (!stale) setLoading(false);
      }
    }

    load();
    return () => {
      stale = true;
    };
  }, [reloadKey]);

  const canCreate = canOrganizeEvents(user?.role);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Campus Events</h1>
            <p className="mt-2 text-ink-soft">What's coming up around Fanshawe.</p>
          </div>
          {canCreate && (
            <Link to="/events/new" className="btn-primary whitespace-nowrap px-6">
              + Create event
            </Link>
          )}
        </div>

        {flash && (
          <div role="status" className="alert-success mt-8">
            {flash}
          </div>
        )}

        {loading && (
          <p role="status" className="mt-8 text-sm text-ink-soft">
            Loading events...
          </p>
        )}

        {!loading && error && (
          <div role="alert" className="alert-error mt-8 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" className="btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ink">No upcoming events</h2>
            <p className="mt-2 text-sm text-ink-soft">Check back soon for new campus events.</p>
            {canCreate && (
              <Link to="/events/new" className="btn-primary mt-5 inline-flex px-5">
                Create an event
              </Link>
            )}
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                  {formatEventDate(event.startsAt)}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-ink">{event.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{event.description}</p>

                <dl className="mt-4 space-y-1 text-sm text-ink-soft">
                  <div className="flex gap-1.5">
                    <dt className="font-medium text-ink">Time:</dt>
                    <dd>{formatTimeRange(event.startsAt, event.endsAt)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-medium text-ink">Where:</dt>
                    <dd>{event.location}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-medium text-ink">Organizer:</dt>
                    <dd>{event.organizer?.profile?.displayName || "CampusHub organizer"}</dd>
                  </div>
                </dl>

                {user?.id === event.organizerId && (
                  <div className="mt-auto pt-5">
                    <Link
                      to={`/events/${event.id}/edit`}
                      className="btn-secondary"
                      aria-label={`Edit ${event.title}`}
                    >
                      Edit
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
