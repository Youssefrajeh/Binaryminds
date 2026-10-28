import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Nav } from "../components/Nav";
import { StatusBadge } from "../components/StatusBadge";
import { ReportButton } from "../components/ReportButton";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import {
  categoryLabel,
  listLostFoundPosts,
  LOST_FOUND_CATEGORIES,
  resolveLostFoundPost,
  type LostFoundKind,
  type LostFoundPost,
} from "../services/lostFoundService";

// occurredOn is a calendar date, so show it in UTC to avoid an off-by-one day
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LostFoundPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<LostFoundPost[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<LostFoundKind | "">("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const rangeInvalid = from !== "" && to !== "" && from > to;
  // An invalid date range is shown straight from the inputs; nothing is fetched
  const error = rangeInvalid ? "The start date must be on or before the end date." : loadError;
  const loading = !rangeInvalid && fetching;
  const hasFilters = !!(search.trim() || kind || category || location.trim() || from || to);

  // A filter change goes back to the first page in the same render batch
  function onFilter<T extends string>(setter: (value: T) => void) {
    return (e: { target: { value: string } }) => {
      setter(e.target.value as T);
      setPage(1);
    };
  }

  function clearFilters() {
    setSearch("");
    setKind("");
    setCategory("");
    setLocation("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  useEffect(() => {
    if (rangeInvalid) return;

    // Ignore responses from filters the user has already moved past
    let stale = false;
    const trimmedSearch = search.trim();
    const trimmedLocation = location.trim();

    async function load() {
      setFetching(true);
      setLoadError("");
      try {
        const result = await listLostFoundPosts({
          search: trimmedSearch,
          kind,
          category,
          location: trimmedLocation,
          from,
          to,
          page,
        });
        if (stale) return;
        setHasMore(result.hasMore);
        setPosts((current) => (page > 1 ? [...current, ...result.posts] : result.posts));
      } catch (err) {
        if (!stale) setLoadError(apiErrorMessage(err, "Failed to load lost & found posts."));
      } finally {
        if (!stale) setFetching(false);
      }
    }

    // Typing waits 300ms so we don't send a request for every keystroke
    const timer = setTimeout(load, trimmedSearch || trimmedLocation ? 300 : 0);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [search, kind, category, location, from, to, page, rangeInvalid]);

  async function handleResolve(id: string) {
    setActionError("");
    setResolvingId(id);
    try {
      const updated = await resolveLostFoundPost(id);
      setPosts((current) =>
        current.map((post) => (post.id === id ? { ...post, status: updated.status ?? "RESOLVED" } : post)),
      );
    } catch (err) {
      setActionError(apiErrorMessage(err, "Failed to mark the post as resolved."));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Lost &amp; Found</h1>
            <p className="mt-2 text-ink-soft">
              Lost something on campus, or found something that isn't yours?
            </p>
          </div>
          <Link to="/lost-found/new" className="btn-primary whitespace-nowrap px-6">
            + Report an item
          </Link>
        </div>

        <section
          aria-label="Search and filter posts"
          className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="lf-search" className="field-label">
                Search
              </label>
              <input
                id="lf-search"
                type="search"
                placeholder="Keywords, e.g. wallet"
                className="field-input"
                value={search}
                onChange={onFilter(setSearch)}
              />
            </div>

            <div>
              <label htmlFor="lf-filter-kind" className="field-label">
                Type
              </label>
              <select id="lf-filter-kind" className="field-input" value={kind} onChange={onFilter<LostFoundKind | "">(setKind)}>
                <option value="">All types</option>
                <option value="LOST">Lost</option>
                <option value="FOUND">Found</option>
              </select>
            </div>

            <div>
              <label htmlFor="lf-filter-category" className="field-label">
                Category
              </label>
              <select
                id="lf-filter-category"
                className="field-input"
                value={category}
                onChange={onFilter(setCategory)}
              >
                <option value="">All categories</option>
                {LOST_FOUND_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="lf-filter-location" className="field-label">
                Location
              </label>
              <input
                id="lf-filter-location"
                type="text"
                placeholder="e.g. Library"
                className="field-input"
                value={location}
                onChange={onFilter(setLocation)}
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="lf-filter-from" className="field-label">
                From
              </label>
              <input
                id="lf-filter-from"
                type="date"
                className="field-input"
                value={from}
                max={to || undefined}
                onChange={onFilter(setFrom)}
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="lf-filter-to" className="field-label">
                To
              </label>
              <input
                id="lf-filter-to"
                type="date"
                className="field-input"
                value={to}
                min={from || undefined}
                onChange={onFilter(setTo)}
              />
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="alert-error mt-8">
            {error}
          </div>
        )}
        {actionError && (
          <div role="alert" className="alert-error mt-8">
            {actionError}
          </div>
        )}

        {loading && page === 1 && (
          <p role="status" className="mt-8 text-sm text-ink-soft">
            Loading posts...
          </p>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ink">
              {hasFilters ? "No posts match your filters" : "No posts yet"}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {hasFilters
                ? "Try a different keyword, or widen the date range."
                : "Be the first to report a lost or found item."}
            </p>
            {hasFilters && (
              <button type="button" className="btn-secondary mt-5 px-5" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {!error && posts.length > 0 && !(loading && page === 1) && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const isOwner = user?.id === post.authorId;
              const resolved = post.status === "RESOLVED";
              return (
                <li
                  key={post.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className={`aspect-[4/3] w-full object-contain p-4 ${resolved ? "opacity-60" : ""}`}
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-canvas text-sm text-muted">
                      No photo
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={post.kind === "LOST" ? "brand" : "neutral"}>
                        {post.kind === "LOST" ? "Lost" : "Found"}
                      </StatusBadge>
                      <StatusBadge tone={resolved ? "success" : "neutral"}>
                        {resolved ? "Resolved" : "Open"}
                      </StatusBadge>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-ink">{post.title}</h2>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {categoryLabel(post.category)}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{post.description}</p>

                    <dl className="mt-4 space-y-1 text-sm text-ink-soft">
                      <div className="flex gap-1.5">
                        <dt className="font-medium text-ink">Where:</dt>
                        <dd>{post.location}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-medium text-ink">When:</dt>
                        <dd>{formatDate(post.occurredOn)}</dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                      {isOwner && !resolved && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleResolve(post.id)}
                          disabled={resolvingId === post.id}
                        >
                          {resolvingId === post.id ? "Saving..." : "Mark as Resolved"}
                        </button>
                      )}
                      {!isOwner && <ReportButton contentType="LOST_FOUND_POST" contentId={post.id} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!error && hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary px-6"
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
