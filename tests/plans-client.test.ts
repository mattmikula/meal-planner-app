import { expect, test } from "vitest";

import { formatDateString, getWeekStartForDate, parseDateString } from "@/lib/plans/client";

test("parseDateString returns null for invalid dates", () => {
  expect(parseDateString("2026-02-30")).toBeNull();
});

test("parseDateString returns a valid date for YYYY-MM-DD", () => {
  const parsed = parseDateString("2026-01-18");
  expect(parsed ? formatDateString(parsed) : null).toBe("2026-01-18");
});

test("getWeekStartForDate normalizes to Monday", () => {
  const date = new Date(Date.UTC(2026, 0, 14));
  expect(getWeekStartForDate(date)).toBe("2026-01-12");
});

test("getWeekStartForDate keeps Monday as week start", () => {
  const date = new Date(Date.UTC(2026, 0, 12));
  expect(getWeekStartForDate(date)).toBe("2026-01-12");
});

test("getWeekStartForDate normalizes Sunday to prior Monday", () => {
  const date = new Date(Date.UTC(2026, 0, 18));
  expect(getWeekStartForDate(date)).toBe("2026-01-12");
});
