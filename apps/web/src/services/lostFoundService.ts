import api from "../lib/api";

// All lost & found endpoint URLs live here so they change in one place
const BASE = "/lost-found";

export type LostFoundKind = "LOST" | "FOUND";
export type LostFoundStatus = "OPEN" | "RESOLVED";

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

export function categoryLabel(value: string): string {
  return LOST_FOUND_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export type LostFoundPost = {
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
};

export type LostFoundFilters = {
  search?: string;
  kind?: LostFoundKind | "";
  category?: string;
  location?: string;
  /** Inclusive YYYY-MM-DD bounds on occurredOn */
  from?: string;
  to?: string;
  page?: number;
};

export type CreateLostFoundInput = {
  kind: LostFoundKind;
  title: string;
  description: string;
  category: LostFoundCategory;
  location: string;
  /** YYYY-MM-DD */
  occurredOn: string;
  /** JPEG, PNG or WebP data URL, max 2 MB */
  imageUrl: string | null;
};

/** Drops empty values so only active filters become query params */
function toParams({ page, ...filters }: LostFoundFilters) {
  return {
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    ...(page && page > 1 ? { page } : {}),
  };
}

export async function listLostFoundPosts(filters: LostFoundFilters) {
  const response = await api.get<LostFoundPost[]>(BASE, { params: toParams(filters) });
  return {
    posts: response.data,
    hasMore: response.headers?.["x-has-more"] === "true",
  };
}

export async function createLostFoundPost(input: CreateLostFoundInput) {
  const response = await api.post<LostFoundPost>(BASE, input);
  return response.data;
}

export async function resolveLostFoundPost(id: string) {
  const response = await api.patch<LostFoundPost>(`${BASE}/${id}/resolve`);
  return response.data;
}
