import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Nav } from "../components/Nav";
import api from "../lib/api";

type ListingImage = {
  id: string;
  url: string;
  sortOrder: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Seller = {
  id: string;
};

type Listing = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  condition: string;
  createdAt: string;
  category: Category;
  images: ListingImage[];
  seller: Seller;
};

let marketplaceCache: Listing[] | null = null;

export function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [condition, setCondition] = useState("");
  const [loading, setLoading] = useState(marketplaceCache === null);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const trimmedSearch = search.trim();

    // If there is no search and we already have listings cached,
    // show them immediately without making another API request.
    if (!trimmedSearch && !categoryId && !condition && marketplaceCache) {
      setListings(marketplaceCache);
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
          },
        });

        setListings(response.data);

        // Only cache the complete marketplace list.
        // Do not replace the cache with search results.
        if (!trimmedSearch && !categoryId && !condition) {
          marketplaceCache = response.data;
        }
      } catch (err: any) {
        console.error("Failed to load listings:", err);

        setError(
          err.response?.data?.error || "Failed to load marketplace listings.",
        );
      } finally {
        setLoading(false);
      }
    }

    // Search waits 300ms so we don't send a request for every keystroke.
    if (trimmedSearch) {
      const timer = setTimeout(() => {
        loadListings();
      }, 300);

      return () => clearTimeout(timer);
    }

    // Initial Marketplace load happens immediately.
    loadListings();
  }, [search, categoryId, condition]);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold">Marketplace</h1>
            <p className="mt-2 text-lg text-muted">
              Buy and sell items with other Fanshawe students.
            </p>
          </div>

          <div className="flex flex-1 justify-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings..."
              className="w-full max-w-md rounded-lg border border-line bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
            />

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All categories</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="rounded-lg border border-line bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All conditions</option>
              <option value="NEW">New</option>
              <option value="LIKE_NEW">Like New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </div>

          <Link
            to="/marketplace/new"
            className="btn-primary whitespace-nowrap px-6"
          >
            + Post a Listing
          </Link>
        </div>

        {error && <div className="alert-error mt-8">{error}</div>}

        {loading && (
          <div className="mt-8 text-sm text-ink-soft">Loading listings...</div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ink">No listings yet</h2>

            <p className="mt-2 text-sm text-ink-soft">
              Be the first student to post something!
            </p>

            <Link
              to="/marketplace/new"
              className="btn-primary mt-5 inline-flex px-5"
            >
              Post a Listing
            </Link>
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
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
                    className="aspect-[4/3] w-full object-cover"
                  />
                )}

                <div className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {listing.category.name}
                  </p>

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
      </main>
    </div>
  );
}
