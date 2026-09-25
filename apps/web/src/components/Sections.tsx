import type { ReactNode } from "react";

interface Feature {
  title: string;
  description: string;
  detail: string;
  icon: ReactNode;
}

const features: Feature[] = [
  {
    title: "Marketplace",
    description: "Sell textbooks and dorm gear to students in your program.",
    detail: "Post a listing in 30 seconds. No shipping — meet on campus.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 7h12l1 13H5L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    title: "Lost & Found",
    description: "Post what you lost or found with a photo and location.",
    detail: "Close the listing once it's reunited with its owner.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    ),
  },
  {
    title: "Campus Events",
    description: "See what clubs and programs are running this week.",
    detail: "RSVP so organizers know who's coming.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </svg>
    ),
  },
];

export function Sections() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="fade-up max-w-xl">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">
            Features
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Everything student life needs
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Three tools that replace the scattered group chats and social‑media
            posts you're currently juggling.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col bg-surface p-8 transition-colors hover:bg-canvas"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand transition-transform group-hover:scale-105">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-base font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {feature.description}
              </p>
              <p className="mt-1 text-sm text-muted">
                {feature.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
