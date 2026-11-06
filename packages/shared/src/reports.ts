export const REPORT_REASONS = [
  { value: "SCAM", label: "Scam or fraud" },
  { value: "INAPPROPRIATE_CONTENT", label: "Inappropriate content" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "SPAM", label: "Spam or misleading content" },
  { value: "PRIVACY", label: "Personal information or privacy" },
  { value: "OTHER", label: "Other" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ReportTarget = "LISTING" | "LOST_FOUND_POST" | "MESSAGE" | "FILE";
/** REMOVED is a resolved report whose content an administrator took down */
export type ReportState = "OPEN" | "REMOVED" | "RESOLVED" | "DISMISSED";
export type ReportAction = "REMOVE_CONTENT" | "RESOLVE" | "DISMISS";
export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  LISTING: "Marketplace listing", LOST_FOUND_POST: "Lost & Found", MESSAGE: "Message", FILE: "Shared file",
};
export type ReportSnapshot = {
  title: string;
  text: string;
  authorId: string;
  href: string | null;
  location?: string;
  fileName?: string;
  fileUrl?: string | null;
  fileSize?: number;
};
export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  note?: string;
  attachmentIndex?: number;
}
export interface AdminReportDto {
  id: string;
  targetType: ReportTarget | "EVENT" | "USER";
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportState;
  createdAt: string;
  reporter: { name: string; email: string | null };
  snapshot: ReportSnapshot | null;
  actions: { action: string; note: string | null; createdAt: string; admin: string }[];
}

/** Stored attachments may predate current validation. Never render an unsafe URL. */
export function safeAttachmentUrl(value: string): string | null {
  if (/[\u0000-\u0020\\]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? value : null; }
  catch { return null; }
}
