import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FileCourseDto, SharedFileDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { ReportButton } from "../components/ReportButton";
import { SharedFileLink } from "../components/SharedFileLink";
import api from "../lib/api";
import { apiErrorMessage } from "../lib/errors";
import { formatFileSize } from "../lib/files";
import { formatListTime } from "../lib/format";

export function FileLibraryPage() {
  const [params, setParams] = useSearchParams();
  const course = params.get("course") ?? "";
  const [courses, setCourses] = useState<FileCourseDto[]>([]);
  const [files, setFiles] = useState<SharedFileDto[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.get<FileCourseDto[]>("/files/courses").then((res) => setCourses(res.data)).catch(() => setCourses([]));
  }, [reload]);

  useEffect(() => {
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const res = await api.get<SharedFileDto[]>("/files", { params: {
          ...(course ? { course } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(page > 1 ? { page } : {}),
        } });
        if (!stale) { setFiles(res.data); setHasMore(res.headers?.["x-has-more"] === "true"); }
      } catch (err) { if (!stale) setError(apiErrorMessage(err, "Could not load files.")); }
      finally { if (!stale) setLoading(false); }
    }, search.trim() ? 300 : 0);
    return () => { stale = true; clearTimeout(timer); };
  }, [course, search, page, reload]);

  function chooseCourse(code: string) {
    setPage(1);
    setParams(code ? { course: code } : {});
  }

  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-soft hover:border-brand"}`;

  return (
    <div className="min-h-screen bg-canvas"><Nav />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Study material</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Course files</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">Notes and documents shared in study groups, organized by course. To add a file, open your <Link to="/study-groups" className="link">study group</Link> chat and attach it there.</p>

        <section aria-label="Find files" className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <label htmlFor="file-search" className="field-label">File name</label>
          <input id="file-search" type="search" maxLength={100} className="field-input" placeholder="Find a file..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          {courses.length > 0 && <div role="group" aria-label="Filter by course" className="mt-4 flex flex-wrap gap-2">
            <button type="button" aria-pressed={!course} className={chip(!course)} onClick={() => chooseCourse("")}>All courses</button>
            {courses.map((item) => <button key={item.courseCode} type="button" aria-pressed={course === item.courseCode} className={chip(course === item.courseCode)} onClick={() => chooseCourse(item.courseCode)}>{item.courseCode} ({item.fileCount})</button>)}
          </div>}
        </section>

        {error && <div role="alert" className="alert-error mt-6 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" className="btn-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>}
        {loading && <p role="status" className="mt-8 text-sm text-muted">Loading files...</p>}
        {!loading && !error && files.length === 0 && <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-muted">{search.trim() || course ? "No files match this search." : "No files have been shared yet."}</p>}
        {!loading && files.length > 0 && <ul aria-label="Files" className="mt-6 space-y-3">{files.map((file) => (
          <li key={file.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <SharedFileLink url={`/api/files/${file.id}/download`} name={file.name} />
                <p className="mt-1 text-muted">{[file.courseCode, formatFileSize(file.size), `Shared by ${file.uploader.displayName}`, formatListTime(file.createdAt)].join(" · ")}</p>
              </div>
              <ReportButton targetType="FILE" targetId={file.messageId} ownerId={file.uploader.id} attachmentIndex={0} label={`Report file: ${file.name}`} />
            </div>
          </li>
        ))}</ul>}
        {(page > 1 || hasMore) && <div className="mt-8 flex items-center justify-between gap-3"><button type="button" className="btn-secondary" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="text-sm text-muted">Page {page}</span><button type="button" className="btn-secondary" disabled={loading || !hasMore} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
      </main>
    </div>
  );
}
