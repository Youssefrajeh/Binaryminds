import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

export function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative overflow-hidden">
      {/* Subtle ambient glow — not a gradient banner */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[480px] w-[720px] -translate-x-1/2 opacity-20 blur-[100px]"
        style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="fade-up max-w-2xl">
          {/* Simple label — no fake badges */}
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">
            Fanshawe College
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl sm:leading-[1.15]">
            Your campus community,{" "}
            <span className="text-brand">in one place.</span>
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
            Buy and sell textbooks, find lost gear, and discover campus events.
            Exclusively for verified{" "}
            <span className="font-medium text-ink">@fanshaweonline.ca</span>{" "}
            students.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <Link to="/profile" className="btn-primary px-6 py-3 text-base">
                Go to your profile
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-6 py-3 text-base">
                  Get started
                </Link>
                <Link to="/login" className="btn-secondary px-6 py-3 text-base">
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-success" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.78 5.28-4.5 5a.75.75 0 0 1-1.06.02l-2-2a.75.75 0 1 1 1.06-1.06l1.46 1.46 3.97-4.42a.75.75 0 0 1 1.07 1Z" />
            </svg>
            Free to join · No setup required · Verified in seconds
          </p>
        </div>
      </div>
    </section>
  );
}
