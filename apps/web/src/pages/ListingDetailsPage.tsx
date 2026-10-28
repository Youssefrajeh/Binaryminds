import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Nav } from "../components/Nav";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";
import { StatusBadge } from "../components/StatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ReportButton } from "../components/ReportButton";
import { apiErrorMessage } from "../lib/errors";
import {
  deleteListing,
  getListing,
  markListingSold,
  type Listing,
} from "../services/listingService";

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The edit form sends a short confirmation here after saving
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionError, setActionError] = useState("");
  const [markingSold, setMarkingSold] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadListing() {
      setLoading(true);
      setError("");
      setListing(null);

      if (!id) {
        setError("Listing not found.");
        setLoading(false);
        return;
      }

      try {
        setListing(await getListing(id));
      } catch (err) {
        console.error("Failed to load listing:", err);

        setError(apiErrorMessage(err, "Failed to load listing."));
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id]);

  async function handleMarkSold() {
    if (!listing) return;
    setActionError("");
    setMarkingSold(true);
    try {
      const updated = await markListingSold(listing.id);
      setListing((current) => current && { ...current, status: updated?.status ?? "SOLD" });
    } catch (err) {
      setActionError(apiErrorMessage(err, "Failed to mark the listing as sold."));
    } finally {
      setMarkingSold(false);
    }
  }

  async function handleDelete() {
    if (!listing) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteListing(listing.id);
      navigate("/marketplace", { replace: true });
    } catch (err) {
      setDeleteError(apiErrorMessage(err, "Failed to delete the listing."));
      setDeleting(false);
    }
  }

  const isOwner = !!listing && user?.id === listing.seller.id;
  const sold = listing?.status === "SOLD";
  const busy = markingSold || deleting;

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        <Link to="/marketplace" className="link text-sm">
          ← Back to Marketplace
        </Link>

        {flash && (
          <div role="status" className="alert-success mt-6">
            {flash}
          </div>
        )}

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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {listing.category.name}
                </p>
                {sold && <StatusBadge tone="danger">Sold</StatusBadge>}
              </div>

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

              {isOwner ? (
                <section aria-label="Manage your listing" className="mt-6 space-y-3">
                  {actionError && (
                    <div role="alert" className="alert-error">
                      {actionError}
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Link to={`/marketplace/${listing.id}/edit`} className="btn-secondary">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleMarkSold}
                      disabled={sold || busy}
                    >
                      {markingSold ? "Saving..." : sold ? "Sold" : "Mark as Sold"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary border-danger/40 text-danger hover:bg-danger-soft"
                      onClick={() => {
                        setDeleteError("");
                        setConfirmDelete(true);
                      }}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </section>
              ) : (
                <div className="mt-6 space-y-3">
                  {!sold && (
                    <MessageButton
                      recipientId={listing.seller.id}
                      listingId={listing.id}
                      label="Message Seller"
                      className="btn-primary inline-flex w-full justify-center px-6 py-3"
                    />
                  )}
                  <ReportButton contentType="LISTING" contentId={listing.id} className="w-full" />
                </div>
              )}
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmDelete}
          title="Delete this listing?"
          confirmLabel="Delete listing"
          cancelLabel="Keep listing"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        >
          <strong className="text-ink">{listing?.title}</strong> will be removed from the marketplace.
          This can't be undone.
        </ConfirmDialog>
      </main>
    </div>
  );
}
