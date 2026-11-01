import { Link } from "react-router";
import type { ListingChatReferenceDto } from "@campushub/shared";
import { StatusBadge } from "./StatusBadge";

export function ListingChatContext({ listing }: { listing: ListingChatReferenceDto }) {
  return (
    <section aria-label="Listing reference" className="max-h-[30dvh] shrink-0 overflow-y-auto border-b border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">About this ad</p>
      <div className="mt-2 flex min-w-0 gap-3">
        {listing.imageUrl && <img src={listing.imageUrl} alt={`Photo for ${listing.title}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-semibold text-ink">{listing.title}</h2>
          <p className="mt-1 font-semibold text-ink">${(listing.priceCents / 100).toFixed(2)}</p>
          <p className="break-words">Seller: {listing.sellerName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge tone={listing.status === "ACTIVE" ? "success" : "neutral"}>{listing.status === "REMOVED" ? "Removed" : listing.status === "SOLD" ? "Sold" : "Available"}</StatusBadge>
            {listing.status !== "REMOVED" && <Link to={`/marketplace/${listing.id}`} className="link">View listing</Link>}
          </div>
        </div>
      </div>
      <details className="mt-2"><summary className="cursor-pointer font-medium text-brand">Ad details</summary><p className="mt-2">Condition: {listing.condition.replaceAll("_", " ")}</p><p className="mt-1 whitespace-pre-wrap break-words">{listing.description}</p></details>
    </section>
  );
}
