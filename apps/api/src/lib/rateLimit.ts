/**
 * Sliding-window rate limiter kept in memory. Good enough for a single API
 * instance; a multi-instance deploy would need a shared store (e.g. Redis).
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  /**
   * Keys come from request input (emails, IPs), so a key that is never used
   * again would otherwise stay in memory forever. Once per window, drop every
   * key whose newest hit has left the window.
   */
  function sweep(current: number) {
    if (current - lastSweep < windowMs) return;
    lastSweep = current;
    const cutoff = current - windowMs;
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1] <= cutoff) hits.delete(key);
    }
  }

  return {
    /** Records a hit and returns false when the key is over the limit */
    tryConsume(key: string): boolean {
      const current = now();
      sweep(current);
      const cutoff = current - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }

      recent.push(current);
      hits.set(key, recent);
      return true;
    },

    reset(key?: string) {
      if (key) hits.delete(key);
      else hits.clear();
    },

    /** Number of keys currently held in memory */
    size(): number {
      return hits.size;
    },
  };
}
