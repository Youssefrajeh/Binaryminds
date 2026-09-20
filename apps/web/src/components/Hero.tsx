import { Link } from "react-router";
import { VerifiedStamp } from "./VerifiedStamp";
import { useAuth } from "../context/AuthContext";

export function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
      <div className="grid gap-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="font-display text-[clamp(2.75rem,5vw+1rem,4.5rem)] leading-[1.05] tracking-[-0.01em] text-ink">
            <span className="italic">Everything Fanshawe.</span>
            <br />
            Nothing else.
          </h1>
          <p className="mt-6 max-w-[42ch] font-body text-lg leading-relaxed text-ink-soft">
            A marketplace, a lost and found, and an events board — open only to people who
            actually go here.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            {isAuthenticated ? (
              <Link
                to="/profile"
                className="bg-pen px-6 py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark"
              >
                Go to your profile
              </Link>
            ) : (
              <Link
                to="/register"
                className="bg-pen px-6 py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark"
              >
                Join with your Fanshawe email
              </Link>
            )}
            <span className="font-mono text-xs tracking-[0.15em] text-muted">
              VERIFICATION TAKES ONE EMAIL, ONCE
            </span>
          </div>
        </div>
        <VerifiedStamp className="hidden md:flex" />
      </div>
    </section>
  );
}
