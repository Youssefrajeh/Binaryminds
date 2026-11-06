import { useCallback, useEffect, useState } from "react";
import { useContentRemoval } from "../lib/useContentRemoval";
import { Link } from "react-router";
import { Nav } from "../components/Nav";
import { ListingGridSkeleton } from "../components/Skeletons";
import api from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  getCachedFirstPage,
  setCachedFirstPage,
  type Category,
  type Listing,
} from "../services/listingService";

export function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [condition, setCondition] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const [mine, setMine] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetching, setLoading] = useState(() => getCachedFirstPage() === null);
  const [loadError, setError] = useState("");
  const removeListing = useCallback((id: string) => setListings((current) => current.filter((listing) => listing.id !== id)), []);
  useContentRemoval("LISTING", removeListing);

  const priceInvalid =
    minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice);
  // An invalid price range is shown straight from the inputs; nothing is fetched
  const error = priceInvalid
    ? "Minimum price cannot be higher than maximum price."
    : loadError;
  const loading = !priceInvalid && fetching;

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await api.get<Category[]>("/listings/categories");
        setCategories(response.data);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }

    loadCategories();
  }, []);

  // A filter change goes back to the first page in the same render batch,
  // so the load effect never fetches a stale page number with new filters.
  function onFilter(setter: (value: string) => void) {
    return (e: { target: { value: string } }) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  useEffect(() => {
    const trimmedSearch = search.trim();
    const unfiltered =
      !trimmedSearch && !categoryId && !condition && !minPrice && !maxPrice && !mine;

    if (priceInvalid) return;
    let stale = false;

    // If there is no filter and we already have the first page cached,
    // show it immediately without making another API request.
    const marketplaceCache = getCachedFirstPage();
    if (unfiltered && page === 1 && marketplaceCache) {
      // Showing the cache synchronously is the point: no loading flash
      // oxlint-disable-next-line react/set-state-in-effect
      setListings(marketplaceCache.listings);
      setHasMore(marketplaceCache.hasMore);
      setLoading(false);
      setError("");
      return;
    }

    async function loadListings() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get<Listing[]>("/listings", {
          params: {
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(condition ? { condition } : {}),
            ...(minPrice ? { minPrice } : {}),
            ...(maxPrice ? { maxPrice } : {}),
            ...(page > 1 ? { page } : {}),
            ...(mine ? { mine: "true" } : {}),
          },
        });

        if (stale) return;
        const more = response.headers?.["x-has-more"] === "true";
        setHasMore(more);
        setListings((current) =>
          page > 1 ? [...current, ...response.data] : response.data,
        );

        // Only cache the first page of the unfiltered marketplace.
        if (unfiltered && page === 1) {
          setCachedFirstPage({ listings: response.data, hasMore: more });
        }
      } catch (err: any) {
        if (stale) return;
        console.error("Failed to load listings:", err);

        setError(
          err.response?.data?.error || "Failed to load marketplace listings.",
        );
      } finally {
        if (!stale) setLoading(false);
      }
    }

    // Typing waits 300ms so we don't send a request for every keystroke.
    if (trimmedSearch || minPrice || maxPrice) {
      const timer = setTimeout(() => {
        loadListings();
      }, 300);

      return () => { stale = true; clearTimeout(timer); };
    }

    // Initial Marketplace load happens immediately.
    loadListings();
    return () => { stale = true; };
  }, [search, categoryId, condition, minPrice, maxPrice, page, priceInvalid, mine]);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-col gap-6">
          <div>
            <h1 className="text-4xl font-bold">Marketplace</h1>
            <p className="mt-2 text-lg text-muted">
              Buy and sell items with other Fanshawe students.
            </p>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm font-medium text-ink"><input type="checkbox" className="h-4 w-4 accent-brand" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />My listings</label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_7rem_7rem]">
            <input
              type="text"
              aria-label="Search listings"
              value={search}
              onChange={onFilter(setSearch)}
              placeholder="Search listings..."
              className="field-input min-w-0"
            />

            <select
              aria-label="Category"
              value={categoryId}
              onChange={onFilter(setCategoryId)}
              className="field-input min-w-0"
            >
              <option value="">All categories</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Condition"
              value={condition}
              onChange={onFilter(setCondition)}
              className="field-input min-w-0"
            >
              <option value="">All conditions</option>
              <option value="NEW">New</option>
              <option value="LIKE_NEW">Like New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={minPrice}
              onChange={onFilter(setMinPrice)}
              placeholder="Min $"
              aria-label="Minimum price"
              className="field-input min-w-0"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={maxPrice}
              onChange={onFilter(setMaxPrice)}
              placeholder="Max $"
              aria-label="Maximum price"
              className="field-input min-w-0"
            />
          </div>

          <Link
            to="/marketplace/new"
            className="btn-primary w-fit whitespace-nowrap px-6"
          >
            + Post a Listing
          </Link>
        </div>

        {error && <div className="alert-error mt-8">{error}</div>}

        {loading && (listings.length === 0
          ? <ListingGridSkeleton />
          : <p role="status" className="mt-8 text-sm text-ink-soft">Updating listings...</p>)}

        {!loading && !error && listings.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ink">No listings found</h2>

            <p className="mt-2 text-sm text-ink-soft">
              Try changing your search or filters, or post something yourself.
            </p>

            <Link
              to="/marketplace/new"
              className="btn-primary mt-5 inline-flex px-5"
            >
              Post a Listing
            </Link>
          </div>
        )}

        {!error && listings.length > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                to={`/marketplace/${listing.id}`}
                className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                {listing.images.length > 0 && (
                  <img
                    src={listing.images[0].url}
                    alt={listing.title}
                    className={`aspect-[4/3] w-full object-contain p-8 ${listing.status === "SOLD" ? "opacity-60" : ""}`}
                  />
                )}

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {listing.category.name}
                    </p>
                    {listing.status === "SOLD" && <StatusBadge tone="danger">Sold</StatusBadge>}
                    {listing.seller.id === user?.id && (
                      <StatusBadge tone="neutral">Your listing</StatusBadge>
                    )}
                  </div>

                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {listing.title}
                  </h2>

                  <p className="mt-2 text-sm text-ink-soft line-clamp-2">
                    {listing.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-semibold text-ink">
                      ${(listing.priceCents / 100).toFixed(2)}
                    </span>

                    <span className="rounded-full bg-canvas px-3 py-1 text-xs text-ink-soft">
                      {listing.condition.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && !error && hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary px-6"
            >
              Load more
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
