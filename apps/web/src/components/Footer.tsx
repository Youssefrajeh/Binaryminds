import { Link } from "react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo size="sm" showFanshawe={false} />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A student-built platform for the Fanshawe College community.
              Not affiliated with or endorsed by Fanshawe College.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li><Link to="/" className="transition hover:text-ink">Home</Link></li>
                <li><Link to="/register" className="transition hover:text-ink">Sign up</Link></li>
                <li><Link to="/login" className="transition hover:text-ink">Log in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                About
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li><span className="cursor-default">Built by Binary Minds</span></li>
                <li><span className="cursor-default">Fanshawe College</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} CampusHub. All rights reserved.</p>
          <p>Crafted by <span className="font-medium text-ink-soft">Binary Minds</span></p>
        </div>
      </div>
    </footer>
  );
}
