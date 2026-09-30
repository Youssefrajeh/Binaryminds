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
});
