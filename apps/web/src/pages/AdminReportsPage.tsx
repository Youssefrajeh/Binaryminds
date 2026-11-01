import { useEffect, useState } from "react";
import { Link } from "react-router";
import { REPORT_REASONS, REPORT_TARGET_LABELS, safeAttachmentUrl, type AdminReportDto, type ReportAction, type ReportTarget } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { StatusBadge } from "../components/StatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { apiErrorMessage } from "../lib/errors";
import api from "../lib/api";

const reasons = new Map<string, string>(REPORT_REASONS.map((reason) => [reason.value, reason.label]));
function typeName(type: string) { return REPORT_TARGET_LABELS[type as ReportTarget] || type; }
function actionName(action: ReportAction) { return action === "REMOVE_CONTENT" ? "Remove content" : action === "DISMISS" ? "Dismiss report" : "Resolve report"; }

export function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReportDto[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ report: AdminReportDto; action: ReportAction } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let stale = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await api.get<AdminReportDto[]>("/admin/reports", { params: { status, ...(type ? { type } : {}), ...(page > 1 ? { page } : {}) } });
        if (!stale) { setReports(response.data); setHasMore(response.headers?.["x-has-more"] === "true"); }
      } catch (err) { if (!stale) setError(apiErrorMessage(err, "Could not load reports.")); }
      finally { if (!stale) setLoading(false); }
    }
    load(); return () => { stale = true; };
  }, [status, type, page, reload]);

  function choose(report: AdminReportDto, action: ReportAction) {
    setDecision({ report, action }); setNote(""); setActionError("");
  }
  async function moderate() {
    if (!decision || busy) return;
    setBusy(true); setActionError("");
    try {
      await api.post(`/admin/reports/${decision.report.id}/actions`, { action: decision.action, ...(note.trim() ? { note: note.trim() } : {}) });
      setSuccess(decision.action === "REMOVE_CONTENT" ? "Content removed and report resolved." : decision.action === "DISMISS" ? "Report dismissed." : "Report resolved.");
      setDecision(null); setReload((value) => value + 1);
    } catch (err) { setActionError(apiErrorMessage(err, "Could not update the report. Refresh and try again.")); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-canvas"><Nav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Administration</p><h1 className="mt-2 text-3xl font-bold text-ink">Reports</h1><p className="mt-2 text-ink-soft">Review reported content and record your decision.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh reports</button><Link to="/admin/users" className="btn-secondary">Manage users</Link></div>
        </div>
        <section aria-label="Filter reports" className="mt-8 grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
          <div><label htmlFor="report-status" className="field-label">Status</label><select id="report-status" value={status} className="field-input" onChange={(e) => { setStatus(e.target.value); setPage(1); setExpanded(null); }}><option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option><option value="ALL">All statuses</option></select></div>
          <div><label htmlFor="report-type" className="field-label">Content type</label><select id="report-type" value={type} className="field-input" onChange={(e) => { setType(e.target.value); setPage(1); setExpanded(null); }}><option value="">All types</option>{Object.entries(REPORT_TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </section>
        {success && <p role="status" className="alert-success mt-6">{success}</p>}
        {error && <div role="alert" className="alert-error mt-6">{error}<button type="button" onClick={() => setReload((value) => value + 1)} className="btn-secondary ml-3">Try again</button></div>}
        {loading && <p role="status" className="mt-8 text-muted">Loading reports...</p>}
        {!loading && !error && reports.length === 0 && <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-muted">No reports match these filters.</p>}
        {!loading && !error && <ul aria-label="Reports" className="mt-6 space-y-4">{reports.map((report) => (
          <li key={report.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-brand">{typeName(report.targetType)}</p><h2 className="mt-1 break-words text-lg font-semibold text-ink">{report.snapshot?.title || "Reported content"}</h2></div><StatusBadge tone={report.status === "OPEN" ? "brand" : report.status === "RESOLVED" ? "success" : "neutral"}>{report.status === "OPEN" ? "Open" : report.status === "RESOLVED" ? "Resolved" : "Dismissed"}</StatusBadge></div>
            <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2"><div><dt className="font-medium text-ink">Reported by</dt><dd className="break-words text-ink-soft">{report.reporter.name}</dd>{report.reporter.email && <dd className="break-all text-xs text-muted">{report.reporter.email}</dd>}</div><div><dt className="font-medium text-ink">Reason</dt><dd className="text-ink-soft">{reasons.get(report.reason) || report.reason}</dd></div><div><dt className="font-medium text-ink">Date</dt><dd className="text-ink-soft"><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time></dd></div>{report.note && <div><dt className="font-medium text-ink">Student note</dt><dd className="whitespace-pre-wrap break-words text-ink-soft">{report.note}</dd></div>}</dl>
            <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="btn-secondary" aria-expanded={expanded === report.id} onClick={() => setExpanded(expanded === report.id ? null : report.id)}>{expanded === report.id ? "Hide preview" : "View"}</button>{report.status === "OPEN" && <>{REPORT_TARGET_LABELS[report.targetType as ReportTarget] && <button type="button" className="btn-secondary border-danger/40 text-danger" onClick={() => choose(report, "REMOVE_CONTENT")}>Remove content</button>}<button type="button" className="btn-secondary" onClick={() => choose(report, "RESOLVE")}>Resolve report</button><button type="button" className="btn-secondary" onClick={() => choose(report, "DISMISS")}>Dismiss report</button></>}</div>
            {expanded === report.id && <section aria-label="Reported content preview" className="mt-5 rounded-xl border border-line bg-canvas p-4 text-sm text-ink-soft"><p className="text-xs text-muted">Snapshot captured when the report was submitted.</p>{report.snapshot ? <><p className="mt-3 whitespace-pre-wrap break-words">{report.snapshot.text}</p>{report.snapshot.location && <p className="mt-2">Location: {report.snapshot.location}</p>}{report.snapshot.href && safeAttachmentUrl(report.snapshot.href) && <Link to={report.snapshot.href} className="link mt-3 inline-block">Open content</Link>}{report.snapshot.fileName && <p className="mt-2 break-all">File: {report.snapshot.fileName}</p>}{report.snapshot.fileUrl && safeAttachmentUrl(report.snapshot.fileUrl) && <a href={report.snapshot.fileUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block">Open reported file</a>}</> : <p className="mt-3">This older report has no saved preview. Content ID: {report.targetId}</p>}{report.actions.map((action, index) => <p key={index} className="mt-3 break-words border-t border-line pt-3">{action.action.replaceAll("_", " ")}{action.note ? ` — ${action.note}` : ""}</p>)}</section>}
          </li>
        ))}</ul>}
        <div className="mt-8 flex items-center justify-between gap-3"><button type="button" className="btn-secondary" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="text-sm text-muted">Page {page}</span><button type="button" className="btn-secondary" disabled={loading || !hasMore} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        <ConfirmDialog open={!!decision} title={decision ? `${actionName(decision.action)}?` : "Review report"} confirmLabel={decision ? actionName(decision.action) : "Confirm"} busyLabel="Saving..." busy={busy} error={actionError} onConfirm={moderate} onCancel={() => setDecision(null)}>
          <p>{decision?.action === "REMOVE_CONTENT" ? "Remove this content from student views and resolve the report? The report snapshot and moderation record will be retained." : decision?.action === "DISMISS" ? "Dismiss this report without removing the content?" : "Mark this report as resolved without removing the content?"}</p>
          <label htmlFor="moderation-note" className="field-label mt-4">Review note (optional)</label><textarea id="moderation-note" maxLength={1000} rows={3} className="field-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </ConfirmDialog>
      </main>
    </div>
  );
}
