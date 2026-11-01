import type { ReactNode } from "react";
import type { UserRole } from "@campushub/shared";
import { Link, Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Nav } from "./Nav";

export function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return (
    <div className="min-h-screen bg-canvas"><Nav />
      <main className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="text-2xl font-semibold text-ink">Access restricted</h1>
        <p className="mt-3 text-ink-soft">Your current role does not have access to this page.</p>
        <Link to="/events" className="btn-secondary mt-6">Browse campus events</Link>
      </main>
    </div>
  );
  return <>{children}</>;
}
