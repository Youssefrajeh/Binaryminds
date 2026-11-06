import { useId, useState, type FormEvent } from "react";
import { REPORT_REASONS, type ReportInput, type ReportReason, type ReportTarget } from "@campushub/shared";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import api from "../lib/api";

const ALREADY_REPORTED = "You already reported this. An administrator will review it.";

export function ReportButton({ targetType, targetId, ownerId, attachmentIndex, label = "Report content" }: {
  targetType: ReportTarget; targetId: string; ownerId?: string; attachmentIndex?: number; label?: string;
}) {
  const { user } = useAuth();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checking, setChecking] = useState(false);
  // Once this student has reported the item, the button gives way to a note
  const [reported, setReported] = useState(false);
  if (!user || user.id === ownerId) return null;

  async function start() {
    if (checking) return;
    setReason(""); setNote(""); setError(""); setSuccess("");
    setChecking(true);
    try {
      const result = await api.get<{ reported: boolean }>("/reports/status", { params: { targetType, targetId, ...(attachmentIndex !== undefined ? { attachmentIndex } : {}) } });
      if (result.data.reported) { setReported(true); setSuccess(ALREADY_REPORTED); return; }
    } catch { /* The API still refuses duplicates, so a failed check just opens the form */ }
    finally { setChecking(false); }
    setOpen(true);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!reason) { setError("Choose a reason for this report."); return; }
    setBusy(true); setError("");
    const input: ReportInput = { targetType, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}), ...(attachmentIndex !== undefined ? { attachmentIndex } : {}) };
    try {
      const result = await api.post<{ alreadyReported?: boolean }>("/reports", input);
      setOpen(false);
      setReported(true);
      setSuccess(result.data.alreadyReported ? ALREADY_REPORTED : "Report sent. An administrator will review it.");
    } catch (err) { setError(apiErrorMessage(err, "Could not send the report. Please try again.")); }
    finally { setBusy(false); }
  }
  return (
    <div className="text-xs">
      {!reported && <button type="button" className="rounded px-1 py-1 font-medium text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60" aria-label={label} disabled={checking} onClick={start}>{checking ? "Checking..." : "Report"}</button>}
      {success && <p role="status" className="mt-1 max-w-xs text-ink-soft">{success}</p>}
      <ConfirmDialog open={open} title={label} confirmLabel="Submit report" busyLabel="Sending..." busy={busy} error={error} onConfirm={submit} onCancel={() => setOpen(false)}>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <p>Choose a reason. Your report is sent privately to administrators.</p>
          <div><label htmlFor={`${id}-reason`} className="field-label">Reason *</label><select id={`${id}-reason`} disabled={busy} required className="field-input" value={reason} aria-invalid={!!error && !reason} onChange={(e) => { setReason(e.target.value as ReportReason); setError(""); }}><option value="">Choose a reason</option>{REPORT_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div><label htmlFor={`${id}-note`} className="field-label">Note (optional)</label><textarea id={`${id}-note`} disabled={busy} rows={3} maxLength={1000} className="field-input resize-y" value={note} onChange={(e) => setNote(e.target.value)} /><p className="mt-1 text-xs text-muted">Up to 1,000 characters.</p></div>
        </form>
      </ConfirmDialog>
    </div>
  );
}
