import api from "../lib/api";

// All report endpoint URLs live here so they change in one place
const BASE = "/reports";

/** Matches the API's ReportTargetType; FILE still needs adding there */
export type ReportContentType = "LISTING" | "LOST_FOUND_POST" | "MESSAGE" | "FILE";

export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam or misleading" },
  { value: "SCAM", label: "Scam or fraud" },
  { value: "INAPPROPRIATE", label: "Inappropriate or offensive" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "PROHIBITED_ITEM", label: "Prohibited or illegal item" },
  { value: "OTHER", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export type ReportInput = {
  targetType: ReportContentType;
  targetId: string;
  reason: ReportReason;
  /** Optional free text, max 500 characters */
  details?: string;
};

export async function submitReport(input: ReportInput) {
  const response = await api.post<{ id: string }>(BASE, input);
  return response.data;
}
