import { Link } from "react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

const navLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const name = user?.profile?.displayName || user?.email?.split("@")[0] || "Profile";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <nav className="flex items-center gap-2 sm:gap-3">
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
      </div>
    </header>
  );
}
