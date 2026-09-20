import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

const sampleActivities = [
  {
    title: "Calculus: Early Transcendentals, 9th ed.",
    tag: "Marketplace",
    price: "$45",
    time: "2m ago",
    badge: "Textbook",
  },
  {
    title: "Carpool to St. Thomas Campus (Mon–Thu)",
    tag: "Rideshare",
    price: "Free / Split Gas",
    time: "15m ago",
    badge: "Carpool",
  },
  {
    title: "TI-84 Plus Graphing Calculator",
    tag: "Marketplace",
    price: "$60",
    time: "1h ago",
    badge: "Electronics",
  },
];

export function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-full max-w-7xl -translate-x-1/2 opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 16, 46, 0.25) 0%, rgba(179, 18, 46, 0.08) 50%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-12 pb-16 md:pt-16 md:pb-24 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Column: Headline & CTA */}
        <div>
          {/* Prominent Fanshawe College Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-brand/25 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-xs backdrop-blur">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                <path d="M12 2L14 8H10L12 2Z" />
                <path d="M12 22L10 16H14L12 22Z" />
                <path d="M22 12L16 14V10L22 12Z" />
                <path d="M2 12L8 10V14L2 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </span>
            <span className="text-brand font-bold uppercase tracking-wider text-[11px]">
              Fanshawe College
            </span>
            <span className="text-muted">·</span>
            <span className="text-ink-soft">Verified Students Portal</span>
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance text-ink sm:text-5xl lg:text-[52px] lg:leading-[1.12]">
            The Fanshawe campus community, <span className="text-brand">in one place.</span>
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
            Buy and sell course textbooks, arrange reliable campus carpools, find lost gear, and
            connect with classmates. Exclusively verified for{" "}
            <span className="font-semibold text-ink">@fanshaweonline.ca</span>.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <Link to="/profile" className="btn-primary px-6 py-3 text-base shadow-md">
                Go to your profile
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-6 py-3 text-base shadow-md">
                  Join CampusHub
                </Link>
                <Link to="/login" className="btn-secondary px-6 py-3 text-base">
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs font-medium text-muted">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-600" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
            Instant verification with Fanshawe College student email
          </p>
        </div>

        {/* Right Column: Prominent Logo Presentation & Live Activity Card */}
        <div className="relative">
          {/* Main Showcase Card */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
            {/* Header Brand Banner with Official Logo Visual */}
            <div className="relative border-b border-line bg-gradient-to-br from-[#181a20] via-[#20222b] to-[#121316] p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  {/* High-Resolution Emblem with Glow */}
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c8102e] via-[#b3122e] to-[#800b1e] p-2.5 shadow-lg shadow-[#c8102e]/40 ring-2 ring-white/20">
                    <img
                      src="/logo.svg"
                      alt="Fanshawe College CampusHub Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold tracking-tight text-white">CampusHub</span>
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Fanshawe
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-zinc-300">
                      Official Campus Student Network
                    </p>
                  </div>
                </div>

                <div className="hidden sm:block text-right">
                  <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                    ● Live Network
                  </span>
                </div>
              </div>

              {/* Campus pill highlights */}
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-300">
                <span className="rounded-md bg-white/10 px-2 py-0.5">London Main Campus</span>
                <span className="rounded-md bg-white/10 px-2 py-0.5">Downtown</span>
                <span className="rounded-md bg-white/10 px-2 py-0.5">St. Thomas</span>
                <span className="rounded-md bg-white/10 px-2 py-0.5">Woodstock</span>
              </div>
            </div>

            {/* Live Feed / Marketplace Preview */}
            <div className="p-5">
              <div className="flex items-center justify-between pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Recent Campus Activity
                </p>
                <span className="text-xs font-medium text-brand hover:underline cursor-pointer">
                  View all listings →
                </span>
              </div>

              <ul className="divide-y divide-line">
                {sampleActivities.map((item) => (
                  <li key={item.title} className="flex items-center justify-between py-3">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                          {item.badge}
                        </span>
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{item.time}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-ink">{item.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* College Identity Trust Strip */}
      <div className="border-y border-line bg-surface/60 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 2L14 8H10L12 2Z" />
                <path d="M12 22L10 16H14L12 22Z" />
                <path d="M22 12L16 14V10L22 12Z" />
                <path d="M2 12L8 10V14L2 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-ink leading-tight">
                Designed for Fanshawe College
              </p>
              <p className="text-xs text-muted">
                London · Elgin · Oxford · Norfolk · Downtown Campuses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium text-ink-soft">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>100% Verified Fanshawe Emails</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span>Zero Off-Campus Strangers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Safe In-Person Exchanges</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
