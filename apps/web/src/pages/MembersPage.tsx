import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { StudentSearchResultDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";
import { apiErrorMessage } from "../lib/errors";
import api from "../lib/api";

const emptyFilters = { q: "", program: "", course: "", interest: "" };

export function MembersPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; results: StudentSearchResultDto[]; hasMore: boolean; error: string } | null>(null);
  const q = filters.q.trim();
  const program = filters.program.trim();
  const course = filters.course.trim();
  const interest = filters.interest.trim();
  const tooShort = q.length === 1;
  const canSearch = !tooShort && Boolean(q || program || course || interest);
  const key = JSON.stringify([q, program, course, interest, page, retry]);
  const loading = canSearch && response?.key !== key;
  const current = !loading && canSearch ? response : null;

  function changeFilter(field: keyof typeof emptyFilters, value: string) {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  }

  useEffect(() => {
    if (!canSearch) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = { ...(q ? { q } : {}), ...(program ? { program } : {}), ...(course ? { course } : {}), ...(interest ? { interest } : {}), ...(page > 1 ? { page } : {}) };
        const result = await api.get<StudentSearchResultDto[]>("/profile/search", { params });
        if (!cancelled) setResponse({ key, results: result.data, hasMore: result.headers?.["x-has-more"] === "true", error: "" });
      } catch (err) {
        if (!cancelled) setResponse({ key, results: [], hasMore: false, error: apiErrorMessage(err, "Could not search for students") });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [canSearch, q, program, course, interest, page, key]);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-4xl font-bold">Find students</h1>
        <p className="mt-2 text-ink-soft">Find classmates by name, program, course, or interest. Combine filters to narrow your search.</p>
        <fieldset className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <legend className="px-2 text-sm font-semibold text-ink">Search filters</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="member-search" className="field-label">Search students by name</label>
              <input id="member-search" type="search" autoFocus maxLength={100} value={filters.q} onChange={(e) => changeFilter("q", e.target.value)} placeholder="e.g. Alex" className="field-input" />
            </div>
            <div>
              <label htmlFor="member-program" className="field-label">Program</label>
              <input id="member-program" type="search" maxLength={100} value={filters.program} onChange={(e) => changeFilter("program", e.target.value)} placeholder="e.g. Computer Programming" className="field-input" />
            </div>
            <div>
              <label htmlFor="member-course" className="field-label">Course</label>
              <input id="member-course" type="search" maxLength={30} value={filters.course} onChange={(e) => changeFilter("course", e.target.value)} placeholder="e.g. INFO-5103" className="field-input" aria-describedby="member-course-help" />
              <p id="member-course-help" className="mt-1 text-xs text-muted">Full course code; spaces, hyphens and case do not matter.</p>
            </div>
            <div>
              <label htmlFor="member-interest" className="field-label">Interest</label>
              <input id="member-interest" type="search" maxLength={30} value={filters.interest} onChange={(e) => changeFilter("interest", e.target.value)} placeholder="e.g. chess" className="field-input" aria-describedby="member-interest-help" />
              <p id="member-interest-help" className="mt-1 text-xs text-muted">Enter a full interest tag, regardless of case.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link to="/profile/edit" className="link text-sm">Update your program, courses and interests</Link>
            <button type="button" className="btn-secondary" onClick={() => { setFilters(emptyFilters); setPage(1); }} disabled={!Object.values(filters).some(Boolean)}>Clear filters</button>
          </div>
        </fieldset>

        {tooShort && <p className="mt-6 text-sm text-ink-soft">Type at least 2 characters to search by name.</p>}
        {!canSearch && !tooShort && <p className="mt-6 text-sm text-muted">Enter a name or at least one filter to find other students.</p>}
        {loading && <p role="status" className="mt-6 text-sm text-ink-soft">Searching...</p>}
        {current?.error && <div role="alert" className="alert-error mt-6 flex flex-wrap items-center justify-between gap-3">
          <span>{current.error}</span>
          <button type="button" className="btn-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>}
        {current && !current.error && current.results.length === 0 && <p role="status" className="mt-6 text-sm text-ink-soft">No students found. Try different filters.</p>}
        {current && current.results.length > 0 && <ul className="mt-6 space-y-3" aria-label="Search results">
          {current.results.map((member) => <li key={member.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
            <Link to={`/u/${member.id}`} className="flex min-w-0 items-start gap-3 hover:opacity-90">
              <Avatar name={member.displayName} src={member.avatarUrl} className="h-11 w-11 shrink-0 text-sm" />
              <span className="min-w-0">
                <span className="block break-words font-medium text-ink">{member.displayName}</span>
                {member.program && <span className="block break-words text-sm text-ink-soft">{member.program}</span>}
                {!!member.courses?.length && <span className="mt-1 block break-words text-xs text-muted">Courses: {member.courses.join(", ")}</span>}
                {!!member.interests?.length && <span className="mt-2 flex flex-wrap gap-1.5">{member.interests.map((tag) => <span key={tag} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">{tag}</span>)}</span>}
              </span>
            </Link>
            <MessageButton recipientId={member.id} className="btn-secondary shrink-0" />
          </li>)}
        </ul>}
        {canSearch && !current?.error && (page > 1 || current?.hasMore) && <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span className="text-sm text-muted">Page {page}</span>
          <button type="button" className="btn-secondary" disabled={loading || !current?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>}
      </main>
    </div>
  );
}
