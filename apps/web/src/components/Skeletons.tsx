// Placeholder shapes shown while content loads. The visual blocks are hidden from
// screen readers; the status text is what assistive technology announces.
const block = "rounded bg-line/80 motion-safe:animate-pulse";

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" className="mt-8">
      <span className="sr-only">Loading listings...</span>
      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="aspect-[4/3] w-full bg-line/60 motion-safe:animate-pulse" />
            <div className="space-y-3 p-5">
              <div className={`${block} h-4 w-3/4`} />
              <div className={`${block} h-5 w-1/3`} />
              <div className={`${block} h-3 w-1/2`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Alternating sides and widths so the placeholder reads as a conversation
const bubbles = [
  { mine: false, width: "w-2/5" },
  { mine: true, width: "w-1/3" },
  { mine: false, width: "w-3/5" },
  { mine: false, width: "w-1/4" },
  { mine: true, width: "w-1/2" },
  { mine: true, width: "w-1/5" },
];

export function MessageThreadSkeleton({ label = "Loading messages…" }: { label?: string }) {
  return (
    <div role="status" className="py-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        {bubbles.map((bubble, index) => (
          <div key={index} className={`flex ${bubble.mine ? "justify-end" : "justify-start"}`}>
            <div className={`h-9 ${bubble.width} rounded-2xl ${bubble.mine ? "bg-brand/15" : "bg-line/80"} motion-safe:animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}
