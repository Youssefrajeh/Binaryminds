import { Link } from "react-router";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";

const heading = "text-xs font-semibold tracking-wide text-muted uppercase";
const linkClass = "text-sm text-ink-soft transition hover:text-ink";

export function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-3 md:grid-cols-12 md:gap-8">
          <div className="sm:col-span-3 md:col-span-6">
            <Logo size="sm" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              A student-built platform for the Fanshawe College community.
              Not affiliated with or endorsed by Fanshawe College.
            </p>
          </div>

          <nav aria-label="Explore" className="md:col-span-2">
            <p className={heading}>Explore</p>
            <ul className="mt-3 space-y-2">
              <li><Link to="/" className={linkClass}>Home</Link></li>
              <li><Link to="/study-groups" className={linkClass}>Study groups</Link></li>
              <li><Link to="/messages" className={linkClass}>Messages</Link></li>
            </ul>
          </nav>

          <nav aria-label="Account" className="md:col-span-2">
            <p className={heading}>Account</p>
            <ul className="mt-3 space-y-2">
              {isAuthenticated ? (
                <>
                  <li><Link to="/profile" className={linkClass}>Your profile</Link></li>
                  <li><Link to="/profile/edit" className={linkClass}>Edit profile</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/register" className={linkClass}>Sign up</Link></li>
                  <li><Link to="/login" className={linkClass}>Log in</Link></li>
                </>
              )}
            </ul>
          </nav>

          <nav aria-label="About" className="md:col-span-2">
            <p className={heading}>About</p>
            <ul className="mt-3 space-y-2">
              <li><Link to="/about" className={linkClass}>About campus-hub</Link></li>
              <li><Link to="/terms" className={linkClass}>Terms &amp; Conditions</Link></li>
              <li>
                <a
                  href="https://www.fanshawec.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} inline-flex items-center gap-1`}
                >
                  Fanshawe College
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17L17 7M8 7h9v9" />
                  </svg>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} CampusHub. All rights reserved.</p>
          <p>
            Crafted by <span className="font-medium text-ink-soft">Binary Minds</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
