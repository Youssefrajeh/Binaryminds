import api from "../lib/api";
import {
  LOST_FOUND_CATEGORIES,
  type LostFoundFilters,
  type CreateLostFoundInput,
  type LostFoundPostDto,
} from "@campushub/shared";

export { LOST_FOUND_CATEGORIES };
export type { LostFoundCategory, LostFoundKind, LostFoundStatus, LostFoundFilters, CreateLostFoundInput } from "@campushub/shared";
export type LostFoundPost = LostFoundPostDto;

// All lost & found endpoint URLs live here so they change in one place
const BASE = "/lost-found";

export function categoryLabel(value: string): string {
  return LOST_FOUND_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

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
