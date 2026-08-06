// Local-time date-window math for the Practice "when you learned it" filter.
//
// Pure arithmetic over ms epochs — no React, no DOM, no Date.now() baked in (the
// caller passes `now` so a test can pin it and the UI can share one clock). The
// boundaries are LOCAL time, because "today" / "this week" is what the clock on
// the learner's wall says, not UTC: startOfDay is local midnight, endOfDay is
// local 23:59:59.999.
//
// WEEK STARTS SUNDAY (US convention). It is a single parameter (`weekStartsOn`,
// 0 = Sunday) threaded through startOfWeek/endOfWeek so flipping to Monday is a
// one-line default change here and nothing else moves.

/** Local midnight (00:00:00.000) of the day containing `now`. */
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local end-of-day (23:59:59.999) of the day containing `now`. */
export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Local start-of-week. `weekStartsOn` is the day index the week begins on
 *  (0 = Sunday, the US default; pass 1 for Monday). */
export function startOfWeek(now: number, weekStartsOn = 0): number {
  const d = new Date(startOfDay(now));
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

/** Local end-of-week — the 23:59:59.999 of the last day of the week `now` is in. */
export function endOfWeek(now: number, weekStartsOn = 0): number {
  const start = new Date(startOfWeek(now, weekStartsOn));
  start.setDate(start.getDate() + 6);
  start.setHours(23, 59, 59, 999);
  return start.getTime();
}

/** Local midnight of the first day of the month containing `now`. */
export function startOfMonth(now: number): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local 23:59:59.999 of the last day of the month containing `now`. */
export function endOfMonth(now: number): number {
  const d = new Date(now);
  // Day 0 of the next month is the last day of this one.
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** A `<input type="date">` value "YYYY-MM-DD" → LOCAL start-of-day ms. Returns
 *  null for "" or anything that is not a valid Y-M-D. */
export function parseDateInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  // Reject overflow (e.g. Feb 30 rolling into March): the parts must round-trip.
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d.getTime();
}

/** ms → "YYYY-MM-DD" in LOCAL time — for seeding a `<input type="date">`. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export interface DateRange {
  from: number | null;
  to: number | null;
}

/** Today, local: [startOfDay, endOfDay]. */
export function todayRange(now: number): DateRange {
  return { from: startOfDay(now), to: endOfDay(now) };
}

/** This week so far: [startOfWeek, endOfDay(now)]. The `to` is NOW, not the
 *  future end of the week — you cannot have learned things you haven't reached. */
export function thisWeekRange(now: number, weekStartsOn = 0): DateRange {
  return { from: startOfWeek(now, weekStartsOn), to: endOfDay(now) };
}

/** This month so far: [startOfMonth, endOfDay(now)] — clamped to now like week. */
export function thisMonthRange(now: number): DateRange {
  return { from: startOfMonth(now), to: endOfDay(now) };
}

/** True when two ranges name the same window (both bounds equal, null-aware). */
function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** True when `r` is exactly one of the three prebuilts for `now`. */
export function matchesPrebuilt(
  r: DateRange,
  now: number,
  which: "today" | "week" | "month",
): boolean {
  const target =
    which === "today"
      ? todayRange(now)
      : which === "week"
        ? thisWeekRange(now)
        : thisMonthRange(now);
  return sameRange(r, target);
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(ms: number, withYear: boolean): string {
  const d = new Date(ms);
  const base = `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

/**
 * A human label for a window: "today" / "this week" / "this month" when it
 * matches a prebuilt for `now`, else a compact custom label.
 *
 * Custom labels drop the year when both bounds share the current year
 * ("Aug 1 – Aug 5") and include it otherwise ("Aug 1 – Sep 2, 2024"). An
 * open-ended window reads as "since <date>" / "until <date>".
 */
export function rangeLabel(r: DateRange, now: number): string {
  if (r.from == null && r.to == null) return "any time";
  if (matchesPrebuilt(r, now, "today")) return "today";
  if (matchesPrebuilt(r, now, "week")) return "this week";
  if (matchesPrebuilt(r, now, "month")) return "this month";

  const nowYear = new Date(now).getFullYear();
  const yearOf = (ms: number) => new Date(ms).getFullYear();

  if (r.from != null && r.to == null) {
    return `since ${shortDate(r.from, yearOf(r.from) !== nowYear)}`;
  }
  if (r.from == null && r.to != null) {
    return `until ${shortDate(r.to, yearOf(r.to) !== nowYear)}`;
  }
  const from = r.from as number;
  const to = r.to as number;
  const differentYear = yearOf(from) !== nowYear || yearOf(to) !== nowYear;
  return `${shortDate(from, differentYear)} – ${shortDate(to, differentYear)}`;
}
