// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/date-range.test.ts
//
// Local-time boundary math for the Practice date filter. Every `now` and every
// expected value is built with the LOCAL Date constructor, so the assertions
// hold in any timezone the test happens to run in — both sides shift together.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  parseDateInput,
  rangeLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  thisMonthRange,
  thisWeekRange,
  toDateInputValue,
  todayRange,
} from "./date-range.ts";

// 2026-01-15 13:30:45.123, local. Jan 15 2026 is a Thursday (getDay() === 4).
const NOW = new Date(2026, 0, 15, 13, 30, 45, 123).getTime();
const at = (
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  ms = 0,
): number => new Date(y, mo, d, h, mi, s, ms).getTime();

test("startOfDay / endOfDay are local midnight and 23:59:59.999", () => {
  assert.equal(startOfDay(NOW), at(2026, 0, 15));
  assert.equal(endOfDay(NOW), at(2026, 0, 15, 23, 59, 59, 999));
});

test("startOfWeek / endOfWeek default to a Sunday-based week", () => {
  // Thursday Jan 15 → Sunday Jan 11 .. Saturday Jan 17.
  assert.equal(startOfWeek(NOW), at(2026, 0, 11));
  assert.equal(endOfWeek(NOW), at(2026, 0, 17, 23, 59, 59, 999));
});

test("startOfWeek honours a Monday week start", () => {
  assert.equal(startOfWeek(NOW, 1), at(2026, 0, 12));
});

test("startOfMonth / endOfMonth bracket the calendar month", () => {
  assert.equal(startOfMonth(NOW), at(2026, 0, 1));
  assert.equal(endOfMonth(NOW), at(2026, 0, 31, 23, 59, 59, 999));
});

test("parseDateInput → local start-of-day; null on empty/invalid/overflow", () => {
  assert.equal(parseDateInput("2026-01-15"), at(2026, 0, 15));
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput("not-a-date"), null);
  assert.equal(parseDateInput("2026-13-01"), null);
  assert.equal(parseDateInput("2026-02-30"), null); // Feb 30 does not exist
});

test("toDateInputValue round-trips with parseDateInput", () => {
  assert.equal(toDateInputValue(NOW), "2026-01-15");
  assert.equal(toDateInputValue(parseDateInput("2026-08-01")!), "2026-08-01");
});

test("range builders clamp `to` to now, not the future end of the period", () => {
  assert.deepEqual(todayRange(NOW), {
    from: at(2026, 0, 15),
    to: at(2026, 0, 15, 23, 59, 59, 999),
  });
  // Week/month "to" is end-of-today, NOT end-of-week / end-of-month.
  assert.equal(thisWeekRange(NOW).from, at(2026, 0, 11));
  assert.equal(thisWeekRange(NOW).to, endOfDay(NOW));
  assert.equal(thisMonthRange(NOW).from, at(2026, 0, 1));
  assert.equal(thisMonthRange(NOW).to, endOfDay(NOW));
});

test("rangeLabel names the prebuilts and formats custom ranges", () => {
  assert.equal(rangeLabel(todayRange(NOW), NOW), "today");
  assert.equal(rangeLabel(thisWeekRange(NOW), NOW), "this week");
  assert.equal(rangeLabel(thisMonthRange(NOW), NOW), "this month");
  assert.equal(rangeLabel({ from: null, to: null }, NOW), "any time");

  // Same-year custom drops the year.
  assert.equal(
    rangeLabel({ from: at(2026, 7, 1), to: at(2026, 7, 5) }, NOW),
    "Aug 1 – Aug 5",
  );
  // A bound in another year brings the year back.
  assert.equal(
    rangeLabel({ from: at(2024, 7, 1), to: at(2024, 8, 2) }, NOW),
    "Aug 1, 2024 – Sep 2, 2024",
  );
  // Open-ended windows.
  assert.equal(rangeLabel({ from: at(2026, 7, 1), to: null }, NOW), "since Aug 1");
  assert.equal(rangeLabel({ from: null, to: at(2026, 7, 5) }, NOW), "until Aug 5");
});
