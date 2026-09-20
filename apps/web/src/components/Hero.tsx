import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

const listings = [
  { title: "Calculus: Early Transcendentals, 9th ed.", price: "$45", meta: "Textbooks · Like new" },
  { title: "Dorm mini fridge, 3.2 cu ft", price: "$80", meta: "Home · Good" },
  { title: "TI-84 Plus graphing calculator", price: "$60", meta: "Electronics · Good" },
];

export function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-brand" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
          Verified Fanshawe students only
        </span>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:leading-[1.1]">
          The campus community, in one place.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
          Buy and sell textbooks, track down lost belongings, and find out what is happening on
          campus. Every member is a verified Fanshawe student.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <Link to="/profile" className="btn-primary px-5 py-3">
              Go to your profile
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary px-5 py-3">
                Create your account
              </Link>
              <Link to="/login" className="btn-secondary px-5 py-3">
                Log in
              </Link>
            </>
          )}
        </div>
        <p className="mt-4 text-sm text-muted">
          Sign up with your @fanshaweonline.ca address. Verification takes one email.
        </p>
      </div>

      <div aria-hidden="true" className="rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Marketplace</p>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            Sample listings
          </span>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {listings.map((item) => (
            <li key={item.title} className="flex items-center gap-4 py-3.5">
              <div className="h-12 w-12 shrink-0 rounded-lg bg-canvas" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted">{item.meta}</p>
              </div>
              <p className="text-sm font-semibold text-ink">{item.price}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
