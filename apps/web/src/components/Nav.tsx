import { useState } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

const navLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const name = user?.profile?.displayName || user?.email?.split("@")[0] || "Profile";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link to="/profile" className={navLink}>
                {name}
              </Link>
              <button onClick={logout} className="btn-secondary">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLink}>
                Log in
              </Link>
              <Link to="/register" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              {mobileOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-line bg-surface px-6 pb-4 pt-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {isAuthenticated ? (
              <>
                <Link to="/profile" className={navLink} onClick={() => setMobileOpen(false)}>
                  {name}
                </Link>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="btn-secondary mt-1 w-full"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={navLink} onClick={() => setMobileOpen(false)}>
                  Log in
                </Link>
                <Link to="/register" className="btn-primary mt-1 w-full" onClick={() => setMobileOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
