import type { ReactNode } from "react";

type Tone = "success" | "neutral" | "danger" | "brand";

const tones: Record<Tone, string> = {
  success: "border-success/25 bg-success-soft text-success",
  neutral: "border-line bg-canvas text-ink-soft",
  danger: "border-danger/25 bg-danger-soft text-danger",
  brand: "border-brand/25 bg-brand-soft text-brand",
};

export function StatusBadge({
  tone,
  children,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
