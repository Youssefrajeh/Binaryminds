/** Lost & Found contracts shared by the React app and Express API. */
export const LOST_FOUND_CATEGORIES = [
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "ID_CARDS", label: "ID / Cards" },
  { value: "KEYS", label: "Keys" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "BAGS", label: "Bags" },
  { value: "BOOKS", label: "Books" },
  { value: "OTHER", label: "Other" },
] as const;

export type LostFoundCategory = (typeof LOST_FOUND_CATEGORIES)[number]["value"];
export type LostFoundKind = "LOST" | "FOUND";
export type LostFoundStatus = "OPEN" | "RESOLVED";
export const MAX_LOST_FOUND_PHOTO_BYTES = 2 * 1024 * 1024;

/** Reports describe campus calendar dates, independent of the server's timezone. */
export function campusToday(now: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export interface LostFoundPostDto {
  id: string;
  authorId: string;
  kind: LostFoundKind;
  title: string;
  description: string;
  category: LostFoundCategory;
  location: string;
  occurredOn: string;
  imageUrl: string | null;
  status: LostFoundStatus;
  createdAt: string;
  author?: {
    id: string;
    profile?: { displayName: string; avatarUrl?: string | null } | null;
  };
}

export interface LostFoundFilters {
  search?: string;
  kind?: LostFoundKind | "";
  category?: LostFoundCategory | "";
  location?: string;
  /** Inclusive campus calendar date bounds (YYYY-MM-DD). */
  from?: string;
  to?: string;
  page?: number;
}

export interface CreateLostFoundInput {
  kind: LostFoundKind;
  title: string;
  description: string;
  category: LostFoundCategory;
  location: string;
  occurredOn: string;
  /** Optional JPEG, PNG or WebP data URL, at most 2 MB decoded. */
  imageUrl: string | null;
}
