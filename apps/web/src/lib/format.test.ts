import { describe, expect, it } from "vitest";
import { formatDayLabel, formatListTime, formatMessageTime, newClientId, formatEventDate, formatEventDateRange, formatTimeRange } from "./format";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("optional event ending", () => {
  const start = "2099-01-01T18:00:00";
  it("shows only a start time if no end time was supplied", () => {
    expect(formatTimeRange(start, null)).not.toContain("–");
    expect(formatTimeRange(start, null)).not.toContain("Invalid");
  });
  it("shows a calendar date range without requiring an end time", () => {
    expect(formatEventDateRange(start, "2099-01-20", null)).toBe(`${formatEventDate(start)} – ${formatEventDate("2099-01-20T12:00:00")}`);
    expect(formatEventDateRange(start, "2099-01-01", null)).toBe(formatEventDate(start));
  });
  it("uses the viewer's local ending day when an end timestamp exists", () => {
    const end = "2099-01-20T00:30:00Z";
    expect(formatEventDateRange(start, "2099-01-21", end)).toBe(`${formatEventDate(start)} – ${formatEventDate(end)}`);
  });
});

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
