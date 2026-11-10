import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit.js";

describe("createRateLimiter", () => {
  it("allows up to the limit inside the window, then blocks", () => {
    let time = 0;
    const limiter = createRateLimiter(10, 5000, () => time);

    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume("alice")).toBe(true);
      time += 100;
    }
    expect(limiter.tryConsume("alice")).toBe(false);
  });

  it("frees capacity as old hits leave the window", () => {
    let time = 0;
    const limiter = createRateLimiter(2, 5000, () => time);

    limiter.tryConsume("alice");
    limiter.tryConsume("alice");
    expect(limiter.tryConsume("alice")).toBe(false);

    time = 5001;
    expect(limiter.tryConsume("alice")).toBe(true);
  });

  it("tracks each user separately", () => {
    const limiter = createRateLimiter(1, 5000, () => 0);

    expect(limiter.tryConsume("alice")).toBe(true);
    expect(limiter.tryConsume("bob")).toBe(true);
    expect(limiter.tryConsume("alice")).toBe(false);
  });

  it("forgets keys that have gone quiet, so one-off emails and IPs do not pile up in memory", () => {
    let time = 0;
    const limiter = createRateLimiter(5, 1000, () => time);

    for (let i = 0; i < 500; i++) limiter.tryConsume(`random-${i}@example.com`);
    expect(limiter.size()).toBe(500);

    time = 1001;
    limiter.tryConsume("next-request");
    expect(limiter.size()).toBe(1);
  });

  it("keeps a key that is still inside its window during cleanup", () => {
    let time = 0;
    const limiter = createRateLimiter(2, 1000, () => time);

    limiter.tryConsume("old");
    time = 600;
    limiter.tryConsume("active");
    limiter.tryConsume("active");
    time = 1100;
    limiter.tryConsume("trigger-cleanup");

    // "active" was last used 500 ms ago, so it is still limited
    expect(limiter.tryConsume("active")).toBe(false);
    expect(limiter.size()).toBe(2);
  });
});
