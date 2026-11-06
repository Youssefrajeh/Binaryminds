import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Nav } from "../components/Nav";
import { EventCard } from "../components/EventCard";
import { listManagedEvents, type CampusEvent } from "../services/eventService";
import { apiErrorMessage } from "../lib/errors";

export function EventManagementPage() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let stale = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const result = await listManagedEvents(page);
        if (!stale) { setEvents(result.events); setHasMore(result.hasMore); }
      } catch (err) { if (!stale) setError(apiErrorMessage(err, "Could not load your events.")); }
      finally { if (!stale) setLoading(false); }
    }
    load();
    return () => { stale = true; };
  }, [page, reloadKey]);
  return (
    <div className="min-h-screen bg-canvas"><Nav />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <Link to="/events" className="link text-sm">← Browse campus events</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight text-ink">Event Management</h1><p className="mt-2 text-ink-soft">Create events and manage your published, draft, and cancelled activities.</p></div>
          <Link to="/events/new" className="btn-primary shrink-0">+ Create event</Link>
        </div>
        <p className="mt-3 text-xs text-muted">Dates and times are shown in your local timezone.</p>
        {flash && <div role="status" className="alert-success mt-6">{flash}</div>}
        {loading && <p role="status" className="mt-8 text-sm text-muted">Loading your events...</p>}
        {error && <div role="alert" className="alert-error mt-6">{error}<button className="btn-secondary ml-3" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
        {!loading && !error && events.length === 0 && <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center"><h2 className="font-semibold text-ink">No events on this page</h2><p className="mt-2 text-sm text-ink-soft">Create your first campus event using the button above.</p></div>}
        {!loading && !error && <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} management />)}</ul>}
        <div className="mt-8 flex justify-between gap-3">
          <button className="btn-secondary" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span className="self-center text-sm text-muted">Page {page}</span>
          <button className="btn-secondary" disabled={loading || !hasMore} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </main>
    </div>
  );
}
