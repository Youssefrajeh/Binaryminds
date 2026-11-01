import { afterEach, expect, it, vi } from "vitest";
import { clearCache, getCachedFirstPage, setCachedFirstPage } from "./listingService";
afterEach(() => { clearCache(); vi.restoreAllMocks(); });
it("keeps quick navigation cached but expires stale marketplace results", () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  setCachedFirstPage({ listings: [], hasMore: true });
  expect(getCachedFirstPage()?.hasMore).toBe(true);
  now.mockReturnValue(31000);
  expect(getCachedFirstPage()).toBeNull();
});
