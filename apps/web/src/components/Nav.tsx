import { useState } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const navLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const name =
    user?.profile?.displayName || user?.email?.split("@")[0] || "Profile";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadTotal, requestCount } = useSocket();
  const badge = unreadTotal + requestCount;
  const badgeEl =
    badge > 0 ? (
      <span
        className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
        aria-label={`${badge} unread`}
      >
        {badge > 99 ? "99+" : badge}
      </span>
    ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <Link to="/about" className={navLink}>
            About
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/study-groups" className={navLink}>
                Study groups
              </Link>
              <Link
                to="/messages"
                className={`${navLink} flex items-center gap-1.5`}
              >
                Messages
                {badgeEl}
              </Link>
              <Link to="/marketplace" className={navLink}>
                Marketplace
              </Link>
              <Link
                to="/profile"
                className={`${navLink} flex items-center gap-2`}
              >
                <Avatar
                  name={name}
                  src={user?.profile?.avatarUrl}
                  className="h-7 w-7 text-xs"
                />
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
            aria-label={
              badge > 0
                ? `Toggle menu, ${badge} unread messages`
                : "Toggle menu"
            }
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
          >
            {isAuthenticated && badge > 0 && !mobileOpen && (
              <span
                className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface"
                aria-hidden="true"
              />
            )}
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
            >
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
            <Link
              to="/about"
              className={navLink}
              onClick={() => setMobileOpen(false)}
            >
              About
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  to="/messages"
                  className={`${navLink} flex items-center gap-1.5`}
                  onClick={() => setMobileOpen(false)}
                >
                  Messages
                  {badgeEl}
                </Link>
                <Link
                  to="/study-groups"
                  className={navLink}
                  onClick={() => setMobileOpen(false)}
                >
                  Study groups
                </Link>
                <Link
                  to="/profile"
                  className={`${navLink} flex items-center gap-2`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Avatar
                    name={name}
                    src={user?.profile?.avatarUrl}
                    className="h-7 w-7 text-xs"
                  />
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="btn-secondary mt-1 w-full"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={navLink}
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary mt-1 w-full"
                  onClick={() => setMobileOpen(false)}
                >
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
