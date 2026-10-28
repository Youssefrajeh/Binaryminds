import { useId, type ReactNode } from "react";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown on the confirm button while the action runs */
  busyLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal "are you sure?" prompt for destructive actions */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Go back",
  busyLabel = "Working...",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      labelledBy={titleId}
      describedBy={bodyId}
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div id={bodyId} className="mt-2 text-sm text-ink-soft">
        {children}
      </div>

      {error && (
        <div role="alert" className="alert-error mt-4">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className="btn-primary bg-danger hover:bg-danger/90"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
