import { useId, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { apiErrorMessage } from "../lib/errors";
import {
  REPORT_REASONS,
  submitReport,
  type ReportContentType,
  type ReportReason,
} from "../services/reportService";

const MAX_DETAILS = 500;

const contentNames: Record<ReportContentType, string> = {
  LISTING: "listing",
  LOST_FOUND_POST: "post",
  MESSAGE: "message",
  FILE: "file",
};

type Props = {
  contentType: ReportContentType;
  contentId: string;
  /** "button" for page actions, "link" for small inline text such as under a message */
  variant?: "button" | "link";
  className?: string;
};

/** Report button plus its form; attach it to any reportable piece of content */
export function ReportButton({ contentType, contentId, variant = "button", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const titleId = useId();
  const reasonId = useId();
  const detailsId = useId();

  const noun = contentNames[contentType];

  function openForm() {
    setReason("");
    setDetails("");
    setReasonError("");
    setSubmitError("");
    setSent(false);
    setOpen(true);
  }

  function close() {
    if (!submitting) setOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!reason) {
      setReasonError("Choose a reason for your report.");
      return;
    }

    setSubmitting(true);
    try {
      const trimmed = details.trim();
      await submitReport({
        targetType: contentType,
        targetId: contentId,
        reason,
        ...(trimmed ? { details: trimmed } : {}),
      });
      setSent(true);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Failed to send your report. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openForm}
        aria-label={`Report this ${noun}`}
        className={
          variant === "link"
            ? `font-medium text-muted underline-offset-2 hover:text-danger hover:underline ${className}`
            : `btn-secondary text-ink-soft hover:text-danger ${className}`
        }
      >
        Report
      </button>

      <Modal open={open} onClose={close} labelledBy={titleId}>
        <h2 id={titleId} className="text-lg font-semibold">
          Report this {noun}
        </h2>

        {sent ? (
          <>
            <p role="status" className="alert-success mt-4">
              Thanks. Your report was sent to the CampusHub moderators.
            </p>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary" onClick={close} autoFocus>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-5">
            <p className="text-sm text-ink-soft">
              Reports are private. The person who posted this won't see who reported it.
            </p>

            {submitError && (
              <div role="alert" className="alert-error">
                {submitError}
              </div>
            )}

            <div>
              <label htmlFor={reasonId} className="field-label">
                Reason *
              </label>
              <select
                id={reasonId}
                className="field-input"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as ReportReason);
                  setReasonError("");
                }}
                aria-invalid={reasonError ? true : undefined}
                aria-describedby={reasonError ? `${reasonId}-error` : undefined}
                autoFocus
              >
                <option value="">Select a reason</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {reasonError && (
                <p id={`${reasonId}-error`} className="mt-1 text-xs text-danger">
                  {reasonError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={detailsId} className="field-label">
                Details <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id={detailsId}
                rows={4}
                maxLength={MAX_DETAILS}
                className="field-input resize-none"
                placeholder="Anything that helps moderators understand the problem"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                aria-describedby={`${detailsId}-count`}
              />
              <p id={`${detailsId}-count`} className="mt-1 text-right text-xs text-muted">
                {details.length}/{MAX_DETAILS}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={close} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Sending..." : "Send report"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
