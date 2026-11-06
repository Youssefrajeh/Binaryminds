import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { COURSE_CODE_HINT, COURSE_CODE_PATTERN, type CreateStudyGroupInput, type StudyGroupDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import api from "../lib/api";
import { apiErrorMessage } from "../lib/errors";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function StudyGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudyGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<StudyGroupDto | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const loadVersion = useRef(0);

  const loadGroups = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const res = await api.get<StudyGroupDto[]>("/study-groups", { params: page > 1 ? { page } : {} });
      if (version !== loadVersion.current) return;
      if (res.data.length === 0 && page > 1) {
        setPage((value) => value - 1);
        return;
      }
      setGroups(res.data);
      setHasMore(res.headers?.["x-has-more"] === "true");
      setError("");
    } catch {
      if (version === loadVersion.current) setError("Failed to load study groups");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // Start a new fetch on initial mount or when the selected page changes.
    // oxlint-disable-next-line react/set-state-in-effect
    loadGroups();
    return () => { loadVersion.current += 1; };
  }, [loadGroups]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError("");
    const input: CreateStudyGroupInput = { name: name.trim(), courseCode: courseCode.trim(), description: description.trim() };
    if (!input.name || !input.courseCode || !input.description) {
      setFormError("Group name, course code and description are required.");
      return;
    }
    if (!COURSE_CODE_PATTERN.test(input.courseCode)) {
      setFormError(`${COURSE_CODE_HINT}.`);
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<StudyGroupDto>("/study-groups", input);
      if (page === 1) {
        setGroups((list) => [res.data, ...list].slice(0, 20));
        if (groups.length >= 20) setHasMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }
      setError("");
      setNotice("Study group created. You are its first member and the group chat is ready.");
      setName("");
      setCourseCode("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to create study group"));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(group: StudyGroupDto) {
    if (busyId !== null) return;
    setBusyId(group.id);
    setError("");
    try {
      await api.post(`/study-groups/${group.id}/join`);
      navigate(`/study-groups/${group.id}`);
    } catch (err) { setError(apiErrorMessage(err, "Failed to join study group")); }
    finally { setBusyId(null); }
  }

  async function handleLeave(group: StudyGroupDto) {
    if (busyId !== null) return;
    setBusyId(group.id);
    setError("");
    try {
      await api.post(`/study-groups/${group.id}/leave`);
      setLeaving(null);
      setNotice("You left the study group and its chat.");
      await loadGroups();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to leave study group"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Study groups</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Join a group for your course. Every group has its own chat.
            </p>
          </div>
          <button type="button" onClick={() => { setShowForm((v) => !v); setFormError(""); setNotice(""); }} disabled={creating || loading || busyId !== null} aria-expanded={showForm} aria-controls="create-study-group" className="btn-primary shrink-0">
            {showForm ? "Cancel" : "New group"}
          </button>
        </div>

        {notice && <div role="status" className="alert-success mt-6">{notice}</div>}
        {error && !leaving && <div role="alert" className="alert-error mt-6 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => { setLoading(true); loadGroups(); }}>Try again</button>
        </div>}

        {showForm && (
          <form id="create-study-group" aria-label="Create study group" onSubmit={handleCreate} className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <fieldset disabled={creating} className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Create study group</h2>
            {formError && <p role="alert" className="alert-error">{formError}</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="group-course" className="field-label">
                  Course code *
                </label>
                <input
                  id="group-course"
                  required
                  maxLength={30}
                  pattern={COURSE_CODE_PATTERN.source}
                  title={COURSE_CODE_HINT}
                  placeholder="e.g. INFO-5103"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="field-input uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="group-name" className="field-label">
                  Group name *
                </label>
                <input
                  id="group-name"
                  required
                  maxLength={80}
                  placeholder="e.g. Midterm prep"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
            <div>
              <label htmlFor="group-description" className="field-label">
                Description *
              </label>
              <textarea
                id="group-description"
                required
                rows={2}
                maxLength={300}
                placeholder="What will your group study, and who should join?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-input resize-none"
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary px-6">
              {creating ? "Creating…" : "Create group"}
            </button>
            </fieldset>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading study groups…</p>
          ) : groups.length === 0 && !error ? (
            <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
              No study groups yet. Create the first one for your course.
            </p>
          ) : (
            groups.map((group) => (
              <article key={group.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">{group.courseCode}</p>
                    <h2 className="mt-0.5 break-words text-base font-semibold text-ink"><Link to={`/study-groups/${group.id}`} className="hover:text-brand hover:underline">{group.name}</Link></h2>
                    {group.description ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{group.description}</p> : <p className="mt-1 text-sm italic text-muted">No description added.</p>}
                    <p className="mt-1 text-xs text-muted">
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link to={`/study-groups/${group.id}`} className="btn-secondary">View details &amp; members</Link>
                    {group.isMember ? (
                      <>
                        {group.conversationId && (
                          <Link to={`/messages/${group.conversationId}`} className="btn-primary">
                            Open chat
                          </Link>
                        )}
                        <button type="button" onClick={() => { setError(""); setLeaving(group); }} disabled={busyId !== null || creating} className="btn-secondary">
                          Leave
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => handleJoin(group)} disabled={busyId !== null || creating} className="btn-primary">
                        {busyId === group.id ? "Joining…" : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
        {!error && (page > 1 || hasMore) && <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" disabled={loading || creating || busyId !== null || page === 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Previous</button>
          <span className="text-sm text-muted">Page {page}</span>
          <button type="button" className="btn-secondary" disabled={loading || creating || busyId !== null || !hasMore} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Next</button>
        </div>}
      </main>
      <ConfirmDialog open={leaving !== null} title="Leave study group?" confirmLabel="Leave group" cancelLabel="Stay in group" busy={busyId !== null} error={error} onCancel={() => { setLeaving(null); setError(""); }} onConfirm={() => { if (leaving) handleLeave(leaving); }}>
        {leaving?.memberCount === 1 ? "You are the last member. Leaving will delete this group and its chat." : "Leaving removes you from this group and its chat. If you are the last member, the group and chat are deleted."}
      </ConfirmDialog>
    </div>
  );
}
