import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { StudyGroupDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import api from "../lib/api";

export function StudyGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudyGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadGroups() {
    try {
      const res = await api.get<StudyGroupDto[]>("/study-groups");
      setGroups(res.data);
      setError("");
    } catch {
      setError("Failed to load study groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await api.post<StudyGroupDto>("/study-groups", {
        name: name.trim(),
        courseCode: courseCode.trim(),
        description: description.trim() || null,
      });
      setGroups((list) => [res.data, ...list]);
      setName("");
      setCourseCode("");
      setDescription("");
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create study group");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(group: StudyGroupDto) {
    setBusyId(group.id);
    setError("");
    try {
      const res = await api.post<{ conversationId: string }>(`/study-groups/${group.id}/join`);
      navigate(`/messages/${res.data.conversationId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to join study group");
      setBusyId(null);
    }
  }

  async function handleLeave(group: StudyGroupDto) {
    const last = group.memberCount === 1;
    const prompt = last
      ? `You're the last member of ${group.name}. Leaving deletes the group and its chat. Continue?`
      : `Leave ${group.name}? You'll also leave its group chat.`;
    if (!window.confirm(prompt)) return;

    setBusyId(group.id);
    setError("");
    try {
      await api.post(`/study-groups/${group.id}/leave`);
      await loadGroups();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to leave study group");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Study groups</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Join a group for your course. Every group has its own chat.
            </p>
          </div>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary shrink-0">
            {showForm ? "Cancel" : "New group"}
          </button>
        </div>

        {error && <div className="alert-error mt-6">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="group-course" className="field-label">
                  Course code *
                </label>
                <input
                  id="group-course"
                  required
                  maxLength={20}
                  placeholder="e.g. INFO5103"
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
                Description
              </label>
              <textarea
                id="group-description"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-input resize-none"
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary px-6">
              {creating ? "Creating…" : "Create group"}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading study groups…</p>
          ) : groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
              No study groups yet. Create the first one for your course.
            </p>
          ) : (
            groups.map((group) => (
              <article key={group.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">{group.courseCode}</p>
                    <h2 className="mt-0.5 truncate text-base font-semibold text-ink">{group.name}</h2>
                    {group.description && <p className="mt-1 text-sm text-ink-soft">{group.description}</p>}
                    <p className="mt-1 text-xs text-muted">
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {group.isMember ? (
                      <>
                        {group.conversationId && (
                          <Link to={`/messages/${group.conversationId}`} className="btn-primary">
                            Open chat
                          </Link>
                        )}
                        <button type="button" onClick={() => handleLeave(group)} disabled={busyId === group.id} className="btn-secondary">
                          Leave
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => handleJoin(group)} disabled={busyId === group.id} className="btn-primary">
                        {busyId === group.id ? "Joining…" : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
