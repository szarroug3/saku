// day-month-reading.ts — the pure kana-reading engine for day-of-month (〜日)
// and month-of-year (〜月). Originally SAK-163 round-2's "how it's built"
// engine for a closed, memorised set; round 4 promotes day/month to a
// GENERATIVE category (one rule card, then a rolled round — see
// counter-categories.ts and the "SAK-163 round 4" note below), and this
// engine is now what number-quiz.ts rolls its counts through, exactly the
// role counterReading() plays for 〜本/〜人/the tens.
//
// WHY THIS IS ITS OWN FILE, NOT A CounterKind ON number-reading.ts's ENGINE
// ==========================================================================
// number-reading.ts's counterReading() is a PREFIX + LAST UNIT engine built for
// counters whose irregularity is a bounded set of SOUND SHIFTS on the ones digit
// (1/3/6/8/10 for 本, …) that repeat identically at every ten (11本, 21本, 31本…
// all shift the same way). Day-of-month does not have that shape: 20日 (はつか)
// is a whole irregular WORD that happens to land on a multiple of ten, not a
// digit-driven shift the prefix+unit split can express, and the range is a fixed
// 1-31 that never composes past a month, not an unbounded counted range. Bolting
// a "day" CounterKind onto that shared engine would mean leaking a
// one-multiple-of-ten special case into a mechanism built for a different shape
// of irregularity, and buying nothing in return: the engine's whole point is
// generating an UNBOUNDED range from a rule, and day/month are a fixed 31/12.
// So the SEPARATION still stands even now that day/month ARE drilled
// generatively: number-quiz.ts (see its QuizKind type) dispatches to THIS
// engine for a "day"/"month" item and to number-reading.ts's counterReading()
// for everything else, rather than widening CounterKind to fit a shape it was
// never built for. See counters.ts's note above the (now reference-only) DAYS
// array for the fuller argument.
//
// WHAT THIS FILE ACTUALLY DOES
// =============================
// It derives the day/month readings from a base rule (number + にち / number +
// がつ) plus NAMED exceptions — the same 31/12 readings src/data/counters.ts's
// DAYS/MONTHS arrays ship as reference data for the Library's "how it's built"
// page (src/data/day-month-construction.ts), so that page's worked table comes
// from a REAL function, never a second hand-typed copy of counters.ts's
// strings, and so a learner's rolled quiz item and the reference page's example
// row can never state two different readings for the same count.
// day-month-construction.test.ts and this file's own test cross-check both
// dayReading/monthReading AND the exception predicates against those DAYS/
// MONTHS arrays — so a reading can never be rolled or shown that the app's own
// reference data does not also carry.
//
// THE RULE, AND THE EXCEPTIONS — VERIFIED AGAINST THE SHIPPED DATA
// ====================================================================
// DAYS: 1st-10th are memorised outright (ついたち…とおか), no rule — the same
// treatment 〜つ's ひとつ…とお gets. 11th and up is the plain number plus にち,
// EXCEPT:
//   - 14th and 24th reuse the native よっか (the 4th's own memorised word)
//     instead of よん/し + にち: 十四日 is じゅうよっか, not じゅうよんにち.
//   - 20th is its own suppletive word, はつか, unrelated to にじゅう + か.
//   - 17th, 19th, 27th and 29th still end in にち, but the ones digit switches
//     to the BRANCH reading (see number-reading.ts's ONES_BRANCH) instead of
//     the default: しち for 7, く for 9. 十七日 is じゅうしちにち, never
//     じゅうななにち; 十九日 is じゅうくにち, never じゅうきゅうにち.
// The last group is the one correction this round makes to the ticket's own
// summary of "the only breaks are 14/20/24": counters.ts's real DAYS array
// (and counters.test.ts's own pinned expectations) also read 17/19/27/29 with
// the branch digit, exactly the way MONTHS reads 7月 as しちがつ rather than
// なながつ. That is a genuine third exception SHAPE (branch-digit substitution),
// distinct from both the memorised 1st-10th tier and the よっか/はつか
// suppletions, and this file names it rather than silently mis-deriving those
// four readings.
//
// MONTHS: almost entirely the plain number plus がつ, except 4月 (しがつ), 7月
// (しちがつ) and 9月 (くがつ) — every one of these is the SAME ones-digit branch
// reading DAYS' 17th/19th/27th/29th use, just with no tens part to keep and a
// different suffix (がつ, not にち).

import { numberReading, ONES_BRANCH } from "./number-reading";

/** One piece of a day/month reading's build — a run of kana, annotated with the
 * integer it represents when it is a number piece (absent for a fixed suffix
 * such as にち/がつ, or for a whole memorised word). Mirrors phase-intros.ts's
 * CountBuildPiece shape (kana + optional numeric value) so
 * day-month-construction.ts can turn these straight into CountBuildPiece rows
 * with no re-shaping. */
export interface DayMonthPart {
  readonly kana: string;
  readonly value?: number;
}

/** The 1st through the 10th, memorised outright — no rule, the same shape as
 * 〜つ's ひとつ…とお. Sourced to match counters.ts's DAYS 1-10 verbatim; kept
 * here (not imported from there) because this file must stay a plain reading
 * ENGINE with no data-file dependency, the same discipline number-reading.ts
 * itself follows for UNIT — cross-checked against counters.ts by this file's
 * own test, day-month-reading.test.ts. */
const DAY_MEMORIZED: Readonly<Record<number, string>> = {
  1: "ついたち",
  2: "ふつか",
  3: "みっか",
  4: "よっか",
  5: "いつか",
  6: "むいか",
  7: "なのか",
  8: "ようか",
  9: "ここのか",
  10: "とおか",
};

/**
 * The build pieces of day n's reading (1-31), or null out of range.
 *
 * A single-piece result (n ≤ 10, or n === 20) is a whole memorised/suppletive
 * word — there is no additive equation to show, the same "no build" treatment
 * counterRow gives 〜人's ひとり/ふたり/よにん. A two-piece result is the tens
 * part (annotated with its own value) plus a suffix piece: よっか for the two
 * counts that keep the native 4th's word (14, 24), the branch-digit + にち for
 * the two ones digits that switch reading (17/19, 27/29), or the plain にち
 * for every other regular count.
 */
export function dayReadingParts(n: number): readonly DayMonthPart[] | null {
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  if (n <= 10) return [{ kana: DAY_MEMORIZED[n] }];
  if (n === 20) return [{ kana: "はつか" }];
  const d = n % 10;
  const tensValue = n - d;
  if (d === 4) return [{ kana: numberReading(tensValue), value: tensValue }, { kana: "よっか" }];
  if (d === 7 || d === 9) {
    return [
      { kana: numberReading(tensValue), value: tensValue },
      { kana: `${ONES_BRANCH[d]}にち` },
    ];
  }
  return [{ kana: numberReading(n), value: n }, { kana: "にち" }];
}

/** The full kana reading of day n (1-31) — dayReadingParts joined, or null out
 * of range. This is what a page or a fact would print; the parts above are
 * what the reference table's build column shows. */
export function dayReading(n: number): string | null {
  const parts = dayReadingParts(n);
  return parts ? parts.map((p) => p.kana).join("") : null;
}

/**
 * Does day n (11-31) break the plain "[number] + にち" rule? False for the
 * 1st-10th (n ≤ 10): they are a memorised TIER, not exceptions to a rule that
 * was never in force for them (the same reason 〜つ's ひとつ…とお carries no
 * "irregular" flag of its own). True for the three exception shapes named
 * above: 14/24 (よっか), 20 (はつか), and 17/19/27/29 (branch digit).
 */
export function isDayException(n: number): boolean {
  if (n < 11 || n > 31) return false;
  if (n === 20) return true;
  const d = n % 10;
  return d === 4 || d === 7 || d === 9;
}

/** The build pieces of month n's reading (1-12), or null out of range. Every
 * month is two pieces: the number (or, for 4/7/9, its branch reading) plus
 * がつ — there is no suppletive/whole-word tier the way DAYS has one. */
export function monthReadingParts(n: number): readonly DayMonthPart[] | null {
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  if (n in ONES_BRANCH) return [{ kana: ONES_BRANCH[n], value: n }, { kana: "がつ" }];
  return [{ kana: numberReading(n), value: n }, { kana: "がつ" }];
}

/** The full kana reading of month n (1-12) — monthReadingParts joined, or null
 * out of range. */
export function monthReading(n: number): string | null {
  const parts = monthReadingParts(n);
  return parts ? parts.map((p) => p.kana).join("") : null;
}

/** Does month n break the plain "[number] + がつ" rule? True for exactly 4, 7
 * and 9 — the three months that read the number as its branch alternate
 * (し/しち/く) instead of the default よん/なな/きゅう. */
export function isMonthException(n: number): boolean {
  return n === 4 || n === 7 || n === 9;
}

// ---------------------------------------------------------------------------
// GRADING SETS — SAK-163 round 4. Day/month are now taught GENERATIVELY (one
// rule card each, then a rolled round — see counter-categories.ts and
// number-quiz.ts's QuizKind), the same shape 〜本/〜人/the tens already teach
// with. number-quiz.ts's grader needs an "every acceptable typed answer" set
// for a rolled day/month item, exactly the shape acceptableCounterReadings
// gives an ordinary CounterKind (number-reading.ts) — these are that, for this
// file's own engine.
// ---------------------------------------------------------------------------

/**
 * Every reading a learner may legitimately type for day n (1-31).
 *
 * Unlike a sound-shifting counter (〜本 ↔ じゅっぽん/じっぽん), a day-of-month
 * reading carries no spelling alternate — every one of the three exception
 * shapes (the memorised 1st-10th, the よっか reuse at 14/24, はつか at 20, and
 * the branch digit at 17/19/27/29) is idiomatically fixed, and a plain -にち
 * count has no branch digit left to alternate (4/7/9 are already the
 * exceptions that consume it). So this is always the single canonical
 * reading, or [] out of range — mirrors acceptableCounterReadings' shape so
 * number-quiz.ts's grader can treat a day item exactly like a counter item.
 */
export function acceptableDayReadings(n: number): string[] {
  const r = dayReading(n);
  return r === null ? [] : [r];
}

/** Every reading a learner may legitimately type for month n (1-12). Same "one
 * canonical reading" rule as acceptableDayReadings, for the same reason. */
export function acceptableMonthReadings(n: number): string[] {
  const r = monthReading(n);
  return r === null ? [] : [r];
}
