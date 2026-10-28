import api from "../lib/api";

// All marketplace endpoint URLs live here so they change in one place
const BASE = "/listings";

export type ListingStatus = "ACTIVE" | "SOLD" | "REMOVED";

export type ListingImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Seller = {
  id: string;
  profile?: {
    displayName: string;
    avatarUrl?: string | null;
  } | null;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  condition: string;
  /** Older API responses omit it; treat missing as ACTIVE */
  status?: ListingStatus;
  createdAt: string;
  category: Category;
  images: ListingImage[];
  seller: Seller;
};

export type ListingInput = {
  title: string;
  description: string;
  priceCents: number;
  categoryId: string;
  condition: string;
  /** JPEG, PNG or WebP data URLs, max 5 */
  images: { url: string }[];
};

// The unfiltered first page is cached so returning to the marketplace is
// instant; any change to a listing clears it so stale data never shows.
let firstPageCache: { listings: Listing[]; hasMore: boolean } | null = null;

export function getCachedFirstPage() {
  return firstPageCache;
}

export function setCachedFirstPage(value: { listings: Listing[]; hasMore: boolean }) {
  firstPageCache = value;
}

function clearCache() {
  firstPageCache = null;
}

export async function getCategories() {
  const response = await api.get<Category[]>(`${BASE}/categories`);
  return response.data;
}

export async function getListing(id: string) {
  const response = await api.get<Listing>(`${BASE}/${id}`);
  return response.data;
}

export async function createListing(input: ListingInput) {
  const response = await api.post<Listing>(BASE, input);
  clearCache();
  return response.data;
}

export async function updateListing(id: string, input: ListingInput) {
  const response = await api.put<Listing>(`${BASE}/${id}`, input);
  clearCache();
  return response.data;
}

export async function markListingSold(id: string) {
  const response = await api.patch<Listing>(`${BASE}/${id}/sold`);
  clearCache();
  return response.data;
}

export async function deleteListing(id: string) {
  await api.delete(`${BASE}/${id}`);
  clearCache();
}
