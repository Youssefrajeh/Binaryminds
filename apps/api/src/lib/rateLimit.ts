/**
 * Sliding-window rate limiter kept in memory. Good enough for a single API
 * instance; a multi-instance deploy would need a shared store (e.g. Redis).
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  return {
    /** Records a hit and returns false when the key is over the limit */
    tryConsume(key: string): boolean {
      const cutoff = now() - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }

      recent.push(now());
      hits.set(key, recent);
      return true;
    },

    reset(key?: string) {
      if (key) hits.delete(key);
      else hits.clear();
    },
  };
}
