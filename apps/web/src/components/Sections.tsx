import type { ReactNode } from "react";

interface Feature {
  title: string;
  copy: string;
  icon: ReactNode;
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-5 w-5",
};

const features: Feature[] = [
  {
    title: "Marketplace",
    copy: "Sell textbooks and dorm gear straight to another student in your program. No shipping, no strangers from off campus.",
    icon: (
      <svg {...iconProps}>
        <path d="M6 7h12l1 13H5L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    title: "Lost & Found",
    copy: "Post what you lost or found with a photo and where it turned up, then close the listing once it is back with its owner.",
    icon: (
      <svg {...iconProps}>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    ),
  },
  {
    title: "Campus Events",
    copy: "See what clubs and programs are running this week and RSVP so organizers know who is coming.",
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </svg>
    ),
  },
];

export function Sections() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Everything student life needs
          </h2>
          <p className="mt-3 text-ink-soft">
            Three tools that replace the scattered group chats and social feeds.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-line bg-canvas p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-base font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
