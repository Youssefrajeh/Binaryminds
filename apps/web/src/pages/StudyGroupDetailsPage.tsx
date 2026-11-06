import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { StudyGroupDetailsDto, StudyGroupMemberDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { apiErrorMessage, isNotFound } from "../lib/errors";
import { NotFoundState } from "../components/NotFoundState";
import api from "../lib/api";

type DetailsResult = { key: string; group: StudyGroupDetailsDto; members: StudyGroupMemberDto[]; hasMore: boolean };

export function StudyGroupDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<DetailsResult | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string; notFound: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const key = JSON.stringify([id, page, reload]);
  const current = result?.key === key ? result : null;
  const error = failure?.key === key ? failure.message : "";
  const notFound = failure?.key === key && failure.notFound;
  const loading = !current && !error;

  useEffect(() => {
    let stale = false;
    Promise.all([
      api.get<StudyGroupDetailsDto>(`/study-groups/${id}`),
      api.get<StudyGroupMemberDto[]>(`/study-groups/${id}/members`, { params: page > 1 ? { page } : {} }),
    ]).then(([group, members]) => {
      if (!stale) setResult({ key, group: group.data, members: members.data, hasMore: members.headers?.["x-has-more"] === "true" });
    }).catch((err) => {
      if (!stale) setFailure({ key, message: apiErrorMessage(err, "Could not load this study group."), notFound: isNotFound(err) });
    });
    return () => { stale = true; };
  }, [id, page, key]);

  async function changeMembership(action: "join" | "leave") {
    if (busy || !current) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const response = await api.post<{ deleted?: boolean }>(`/study-groups/${id}/${action}`);
      if (!mounted.current) return;
      setConfirmLeave(false);
      if (action === "leave" && response.data.deleted) {
        navigate("/study-groups");
        return;
      }
      setNotice(action === "join" ? "You joined the study group. Its chat is now available." : "You left the study group and its chat.");
      setPage(1);
      setReload((value) => value + 1);
    } catch (err) { if (mounted.current) setActionError(apiErrorMessage(err, `Could not ${action} the study group.`)); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <div className="min-h-screen bg-canvas">
    <Nav />
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      {!notFound && <Link to="/study-groups" className="link text-sm">Back to study groups</Link>}
      {notFound && <NotFoundState title="Study group not found" message="This study group doesn't exist. It may have been deleted when its last member left." backTo="/study-groups" backLabel="Back to study groups" />}
      {loading && <p role="status" className="mt-8 text-sm text-muted">Loading study group...</p>}
      {error && !notFound && <div role="alert" className="alert-error mt-6 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" className="btn-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>}
      {notice && <p role="status" className="alert-success mt-6">{notice}</p>}
      {actionError && !confirmLeave && <p role="alert" className="alert-error mt-6">{actionError}</p>}
      {current && <>
        <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{current.group.courseCode}</p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-ink">{current.group.name}</h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-soft">{current.group.description || <span className="italic text-muted">No description added.</span>}</p>
          <p className="mt-3 text-sm text-muted">{current.group.memberCount} member{current.group.memberCount === 1 ? "" : "s"}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {current.group.isMember ? <>
              {current.group.conversationId && <Link to={`/messages/${current.group.conversationId}`} className="btn-primary">Open chat</Link>}
              <Link to={`/files?course=${encodeURIComponent(current.group.courseCode)}`} className="btn-secondary">Course files</Link>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setActionError(""); setConfirmLeave(true); }}>Leave group</button>
            </> : <button type="button" className="btn-primary" disabled={busy} onClick={() => changeMembership("join")}>{busy ? "Joining..." : "Join group"}</button>}
          </div>
        </section>
        <section aria-label="Group members" className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-ink">Members</h2><button type="button" className="btn-secondary" disabled={busy} onClick={() => setReload((value) => value + 1)}>Refresh members</button></div>
          {current.members.length === 0 ? <p className="mt-4 text-sm text-muted">No active members on this page.</p> : <ul className="mt-4 divide-y divide-line">
            {current.members.map((member) => <li key={member.id} className="py-3">
              <Link to={`/u/${member.id}`} className="flex min-w-0 items-center gap-3 rounded-lg hover:bg-canvas">
                <Avatar name={member.displayName} src={member.avatarUrl} className="h-10 w-10 shrink-0 text-sm" />
                <div className="min-w-0"><p className="break-words font-medium text-ink">{member.displayName}{member.isCreator && <span className="ml-2 text-xs text-brand">Creator</span>}</p><p className="break-words text-sm text-ink-soft">{[member.program, member.yearOfStudy ? `Year ${member.yearOfStudy}` : null].filter(Boolean).join(" · ")}</p></div>
              </Link>
            </li>)}
          </ul>}
          {(page > 1 || current.hasMore) && <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" className="btn-secondary" disabled={busy || page === 1} onClick={() => setPage((value) => value - 1)}>Previous members</button>
            <span className="text-sm text-muted">Page {page}</span>
            <button type="button" className="btn-secondary" disabled={busy || !current.hasMore} onClick={() => setPage((value) => value + 1)}>Next members</button>
          </div>}
        </section>
      </>}
    </main>
    <ConfirmDialog open={confirmLeave} title="Leave study group?" confirmLabel="Leave group" cancelLabel="Stay in group" busy={busy} error={actionError} onCancel={() => { setConfirmLeave(false); setActionError(""); }} onConfirm={() => changeMembership("leave")}>
      {current?.group.memberCount === 1 ? "You are the last member. Leaving will delete this group and its chat." : "Leaving removes you from this group and its chat. If you are the last member, the group and chat are deleted."}
    </ConfirmDialog>
  </div>;
}
