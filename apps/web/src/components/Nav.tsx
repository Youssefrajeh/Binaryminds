import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-mono text-sm font-bold tracking-[0.12em] text-ink">
          CAMPUSHUB
        </Link>

        <nav className="flex items-center gap-5">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="font-body text-sm text-ink-soft underline-offset-4 transition-colors hover:text-pen hover:underline"
              >
                {user?.profile?.displayName || user?.email?.split("@")[0] || "Profile"}
              </Link>
              <button
                onClick={logout}
                className="font-body text-sm text-ink-soft underline-offset-4 transition-colors hover:text-pen hover:underline"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="font-body text-sm text-ink-soft underline-offset-4 transition-colors hover:text-pen hover:underline"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="bg-pen px-4 py-2 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
