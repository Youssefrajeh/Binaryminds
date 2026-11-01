import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AdminUserDto, AssignableRole } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { StatusBadge } from "../components/StatusBadge";
import api from "../lib/api";
import { apiErrorMessage } from "../lib/errors";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AssignableRole>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await api.get<AdminUserDto[]>("/admin/users", { params: {
          ...(search.trim() ? { search: search.trim() } : {}), ...(role ? { role } : {}), ...(page > 1 ? { page } : {}),
        } });
        if (!stale) { setUsers(result.data); setHasMore(result.headers?.["x-has-more"] === "true"); setDrafts({}); }
      } catch (err) { if (!stale) setError(apiErrorMessage(err, "Could not load users.")); }
      finally { if (!stale) setLoading(false); }
    }, search.trim() ? 300 : 0);
    return () => { stale = true; clearTimeout(timer); };
  }, [search, role, page, reloadKey]);

  async function saveRole(user: AdminUserDto) {
    const nextRole = drafts[user.id];
    if (!nextRole || nextRole === user.role || saving) return;
    setSaving(user.id); setError(""); setSuccess("");
    try {
      await api.patch<AdminUserDto>(`/admin/users/${user.id}/role`, { role: nextRole });
      const roleName = nextRole === "ADMINISTRATOR" ? "an Administrator" : nextRole === "ORGANIZER" ? "an Organizer" : "a Student";
      setSuccess(`${user.profile?.displayName || user.email} is now ${roleName}.`);
      setReloadKey((key) => key + 1);
    } catch (err) { setError(apiErrorMessage(err, "Could not update the role.")); }
    finally { setSaving(null); }
  }
  return (
    <div className="min-h-screen bg-canvas"><Nav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Administration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Manage users</h1>
        <Link to="/admin/reports" className="btn-secondary mt-4 inline-flex">Review reports</Link>
        <p className="mt-2 max-w-2xl text-ink-soft">Everyone joins as a Student. Assign Organizer for event planning, Administrator for user and role management, or Student to remove organizer access. Elevated roles require an active, verified account.</p>
        <section aria-label="Search users" className="mt-8 grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_14rem]">
          <div><label htmlFor="admin-search" className="field-label">Name or email</label><input id="admin-search" type="search" maxLength={100} className="field-input" value={search} placeholder="Find a student..." onChange={(e) => { setSearch(e.target.value); setPage(1); setLoading(true); }} /></div>
          <div><label htmlFor="admin-role-filter" className="field-label">Role</label><select id="admin-role-filter" className="field-input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); setLoading(true); }}><option value="">All roles</option><option value="STUDENT">Students</option><option value="ORGANIZER">Organizers</option><option value="ADMINISTRATOR">Administrators</option></select></div>
        </section>
        {success && <div role="status" className="alert-success mt-6">{success}</div>}
        {error && <div role="alert" className="alert-error mt-6">{error}<button className="btn-secondary ml-3" onClick={() => setReloadKey((key) => key + 1)}>Refresh users</button></div>}
        {loading && <p role="status" className="mt-8 text-sm text-muted">Loading users...</p>}
        {!loading && !error && users.length === 0 && <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-muted">No users match this search.</p>}
        {!loading && <ul aria-label="Users" className="mt-6 space-y-3">{users.map((user) => (
          <li key={user.id} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={user.profile?.displayName || user.email} src={user.profile?.avatarUrl} /><div className="min-w-0"><h2 className="break-words font-semibold text-ink">{user.profile?.displayName || "Student"}</h2><p className="break-all text-sm text-ink-soft">{user.email}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge tone={user.role === "ORGANIZER" ? "brand" : "neutral"}>{user.role === "ADMINISTRATOR" ? "Administrator" : user.role === "ORGANIZER" ? "Organizer" : "Student"}</StatusBadge><StatusBadge tone={user.status === "ACTIVE" && user.emailVerifiedAt ? "success" : "neutral"}>{user.status === "ACTIVE" && user.emailVerifiedAt ? "Verified" : user.status === "SUSPENDED" ? "Suspended" : "Unverified"}</StatusBadge></div></div></div>
            {user.role === "ADMINISTRATOR" ? <p className="text-sm text-muted">Protected administrator account</p> : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div><label htmlFor={`role-${user.id}`} className="field-label">Role for {user.profile?.displayName || user.email}</label><select id={`role-${user.id}`} className="field-input" disabled={saving !== null} value={drafts[user.id] ?? user.role} onChange={(e) => setDrafts((current) => ({ ...current, [user.id]: e.target.value as AssignableRole }))}><option value="STUDENT">Student</option><option value="ORGANIZER" disabled={user.status !== "ACTIVE" || !user.emailVerifiedAt}>Organizer</option><option value="ADMINISTRATOR" disabled={user.status !== "ACTIVE" || !user.emailVerifiedAt}>Administrator</option></select></div>
                <button className="btn-primary shrink-0" aria-label={`Save role for ${user.profile?.displayName || user.email}`} disabled={saving !== null || !drafts[user.id] || drafts[user.id] === user.role} onClick={() => saveRole(user)}>{saving === user.id ? "Saving..." : "Save role"}</button>
              </div>
            )}
          </li>
        ))}</ul>}
        <div className="mt-8 flex items-center justify-between gap-3"><button className="btn-secondary" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="text-sm text-muted">Page {page}</span><button className="btn-secondary" disabled={loading || !hasMore} onClick={() => setPage((value) => value + 1)}>Next</button></div>
      </main>
    </div>
  );
}
