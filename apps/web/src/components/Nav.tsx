import { useState } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const navLink =
  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const name =
    user?.profile?.displayName || user?.email?.split("@")[0] || "Profile";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadTotal, requestCount } = useSocket();
  // The signed-in link row needs far more width than the guest one, and
  // organizers and administrators get extra links on top of that
  const staffLinks = user?.role === "ORGANIZER" || user?.role === "ADMINISTRATOR";
  const desktopNav = !isAuthenticated ? "hidden sm:flex" : staffLinks ? "hidden 2xl:flex" : "hidden xl:flex";
  const mobileOnly = !isAuthenticated ? "sm:hidden" : staffLinks ? "2xl:hidden" : "xl:hidden";
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
      <div className={`mx-auto flex min-h-16 ${staffLinks ? "max-w-[96rem]" : "max-w-7xl"} items-center justify-between gap-4 px-4 py-2 sm:px-6`}>
        <div className="shrink-0">
          <Logo animated />
        </div>

        {/* Desktop nav */}
        <nav className={`${desktopNav} min-w-0 flex-wrap items-center justify-end gap-1`}>
          <ThemeToggle />
          <Link to="/about" className={navLink}>
            About
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/study-groups" className={navLink}>
                Study groups
              </Link>
              <Link to="/files" className={navLink}>
                Course files
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
              <Link to="/lost-found" className={navLink}>
                Lost &amp; Found
              </Link>
              <Link to="/events" className={navLink}>
                Events
              </Link>
              {(user?.role === "ORGANIZER" || user?.role === "ADMINISTRATOR") && <Link to="/events/manage" className={navLink}>Event Management</Link>}
              {user?.role === "ADMINISTRATOR" && <Link to="/admin/reports" className={navLink}>Admin</Link>}
              <Link to="/members" className={navLink}>
                Students
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
              <button onClick={logout} className="btn-secondary whitespace-nowrap">
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
        <div className={`flex items-center gap-1 ${mobileOnly}`}>
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
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
        <div id="mobile-nav" className={`max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-line bg-surface px-6 pb-4 pt-2 ${mobileOnly}`}>
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
                <Link to="/marketplace" className={navLink} onClick={() => setMobileOpen(false)}>Marketplace</Link>
                {(user?.role === "ORGANIZER" || user?.role === "ADMINISTRATOR") && <Link to="/events/manage" className={navLink} onClick={() => setMobileOpen(false)}>Event Management</Link>}
                {user?.role === "ADMINISTRATOR" && <Link to="/admin/reports" className={navLink} onClick={() => setMobileOpen(false)}>Admin</Link>}
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
                <Link to="/files" className={navLink} onClick={() => setMobileOpen(false)}>Course files</Link>
                <Link
                  to="/lost-found"
                  className={navLink}
                  onClick={() => setMobileOpen(false)}
                >
                  Lost &amp; Found
                </Link>
                <Link
                  to="/events"
                  className={navLink}
                  onClick={() => setMobileOpen(false)}
                >
                  Events
                </Link>
                <Link
                  to="/members"
                  className={navLink}
                  onClick={() => setMobileOpen(false)}
                >
                  Students
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
