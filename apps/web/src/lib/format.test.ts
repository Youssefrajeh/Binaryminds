import { describe, expect, it } from "vitest";
import { formatDayLabel, formatListTime, formatMessageTime, newClientId } from "./format";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("formatDayLabel", () => {
  it("says Today and Yesterday", () => {
    expect(formatDayLabel(new Date().toISOString())).toBe("Today");
    expect(formatDayLabel(daysAgo(1))).toBe("Yesterday");
  });

  it("uses a full date for older days", () => {
    expect(formatDayLabel(daysAgo(10))).not.toMatch(/Today|Yesterday/);
  });
});

describe("formatListTime", () => {
  it("shows a clock time for today", () => {
    expect(formatListTime(new Date().toISOString())).toMatch(/\d/);
  });

  it("shows a weekday within a week and a date after", () => {
    expect(formatListTime(daysAgo(3))).not.toMatch(/\d/);
    expect(formatListTime(daysAgo(30))).toMatch(/\d/);
  });
});

describe("formatMessageTime", () => {
  it("returns a time string", () => {
    expect(formatMessageTime(new Date().toISOString())).toMatch(/\d/);
  });
});

describe("newClientId", () => {
  it("returns unique ids", () => {
    expect(newClientId()).not.toBe(newClientId());
  });
});
