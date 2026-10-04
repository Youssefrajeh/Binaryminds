import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Nav } from "../components/Nav";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";

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
  profile?: {
    displayName: string;
    avatarUrl?: string | null;
  } | null;
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

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadListing() {
      if (!id) {
        setError("Listing not found.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<Listing>(`/listings/${id}`);
        setListing(response.data);
      } catch (err: any) {
        console.error("Failed to load listing:", err);

        setError(err.response?.data?.error || "Failed to load listing.");
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id]);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        <Link to="/marketplace" className="link text-sm">
          ← Back to Marketplace
        </Link>

        {loading && (
          <p className="mt-8 text-sm text-ink-soft">Loading listing...</p>
        )}

        {error && <div className="alert-error mt-8">{error}</div>}

        {!loading && !error && listing && (
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              {listing.images.length > 0 ? (
                <img
                  src={listing.images[0].url}
                  alt={listing.title}
                  className="aspect-square w-full rounded-2xl border border-line object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-surface text-sm text-muted">
                  No image available
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {listing.category.name}
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
                {listing.title}
              </h1>

              <p className="mt-4 text-2xl font-semibold text-ink">
                ${(listing.priceCents / 100).toFixed(2)}
              </p>

              <div className="mt-4">
                <span className="rounded-full bg-canvas px-3 py-1 text-sm text-ink-soft">
                  {listing.condition.replace("_", " ")}
                </span>
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-semibold text-ink">Description</h2>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                  {listing.description}
                </p>
              </div>

              <div className="mt-8 border-t border-line pt-6">
                <p className="text-sm font-semibold text-ink">Seller</p>

                <Link
                  to={`/u/${listing.seller.id}`}
                  className="mt-3 flex w-fit items-center gap-3 hover:opacity-90"
                >
                  <Avatar
                    name={listing.seller.profile?.displayName || "CampusHub seller"}
                    src={listing.seller.profile?.avatarUrl}
                  />

                  <span className="text-sm text-ink hover:underline">
                    {listing.seller.profile?.displayName || "CampusHub seller"}
                  </span>
                </Link>
              </div>

              <div className="mt-8">
                <p className="text-xs text-muted">
                  Listed {new Date(listing.createdAt).toLocaleDateString()}
                </p>
              </div>

              {user?.id !== listing.seller.id && (
                <div className="mt-6">
                  <MessageButton
                    recipientId={listing.seller.id}
                    label="Message Seller"
                    className="btn-primary inline-flex w-full justify-center px-6 py-3"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
