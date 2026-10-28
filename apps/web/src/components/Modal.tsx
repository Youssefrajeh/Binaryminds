import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  /** Called on Escape; the parent decides whether to close */
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
};

/** Modal shell built on the native <dialog> element */
export function Modal({ open, onClose, labelledBy, describedBy, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // showModal traps focus and adds the backdrop; older engines only get `open`
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Escape fires "cancel"; route it through onClose so state stays in sync
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      {open && children}
    </dialog>
  );
}
