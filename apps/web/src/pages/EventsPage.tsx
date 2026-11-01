import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Nav } from "../components/Nav";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import { EventCard } from "../components/EventCard";
import { canOrganizeEvents, listSavedEvents, listUpcomingEvents, type CampusEvent } from "../services/eventService";

export function EventsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const saved = params.get("view") === "saved";
  const requestedPage = Number(params.get("page") || 1);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;
  // The form sends a short confirmation here after saving or cancelling
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState("");

  function changePage(value: number) {
    setNotice("");
    setParams({ ...(saved ? { view: "saved" } : {}), ...(value > 1 ? { page: String(value) } : {}) });
  }

  function onRsvpChange(id: string, isRsvped: boolean) {
    setNotice(isRsvped ? "RSVP saved. You can find this event in Saved Events." : "Your RSVP has been cancelled.");
    if (saved && !isRsvped) {
      setEvents((current) => current.filter((event) => event.id !== id));
      if (events.length === 1 && page > 1) changePage(page - 1);
      else setReloadKey((key) => key + 1);
    } else {
      setEvents((current) => current.map((event) => event.id === id ? { ...event, isRsvped } : event));
    }
  }

  useEffect(() => {
    let stale = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await (saved ? listSavedEvents(page) : listUpcomingEvents(page));
        if (!stale) { setEvents(result.events); setHasMore(result.hasMore); }
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
  }, [reloadKey, page, saved]);

  const canCreate = canOrganizeEvents(user?.role);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{saved ? "Saved Events" : "Campus Events"}</h1>
            <p className="mt-2 text-ink-soft">{saved ? "Events you have RSVP'd to, including past and cancelled events." : "What's coming up around Fanshawe."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {saved ? (
              <Link to="/events" onClick={() => setNotice("")} className="btn-secondary">Back to events</Link>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => { setNotice(""); setParams({ view: "saved" }); }}>Saved Events</button>
            )}
            {canCreate && <>
              <Link to="/events/manage" className="btn-secondary">Event Management</Link>
              <Link to="/events/new" className="btn-primary whitespace-nowrap px-6">
                + Create event
              </Link>
            </>}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Dates and times are shown in your local timezone.</p>

        {flash && (
          <div role="status" className="alert-success mt-8">
            {flash}
          </div>
        )}

          <section aria-label={saved ? "Saved Events" : "Upcoming events"} className="mt-8 min-w-0">
            {notice && <p role="status" className="alert-success mt-4">{notice}</p>}
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
                <h3 className="text-lg font-semibold text-ink">{saved ? "No saved events" : "No upcoming events"}</h3>
                <p className="mt-2 text-sm text-ink-soft">{saved ? "RSVP to an upcoming event and it will appear here." : "Check back soon for new campus events."}</p>
                {saved && <Link to="/events" className="btn-primary mt-5">Browse events</Link>}
                {!saved && canCreate && (
                  <Link to="/events/new" className="btn-primary mt-5 inline-flex px-5">
                    Create an event
                  </Link>
                )}
              </div>
            )}

            {!loading && !error && events.length > 0 && (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => <EventCard key={`${saved}:${event.id}`} event={event} onRsvpChange={onRsvpChange} />)}
              </ul>
            )}
            {!error && (page > 1 || hasMore) && (
              <div className="mt-8 flex items-center justify-between gap-3">
                <button className="btn-secondary" disabled={loading || page === 1} onClick={() => changePage(page - 1)}>Previous</button>
                <span className="text-sm text-muted">Page {page}</span>
                <button className="btn-secondary" disabled={loading || !hasMore} onClick={() => changePage(page + 1)}>Next</button>
              </div>
            )}
          </section>
      </main>
    </div>
  );
}
