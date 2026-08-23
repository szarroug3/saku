// DAY-OF-MONTH AND MONTH-OF-YEAR — the "how it's built" reference pages for
// 〜日 and 〜月.
//
// WHY THIS EXISTS
// ================
// SAK-163 round 1 shipped DAYS and MONTHS (src/data/counters.ts) as 43 flat,
// independent CounterForm entries — every one of them individually memorised,
// with no card anywhere saying that most of them actually follow a rule.
// Review feedback (Changes Requested): a learner staring at 31 unrelated day
// tiles has no way to see that 11th-31st is almost entirely "[number] + にち",
// and the app already teaches every OTHER generative counter (〜本, 〜匹, the
// tens, the big words) with exactly that shape — a rule card plus a named
// Irregular table — via src/data/number-construction.ts. Round 2 gave day/month
// this SAME reference-page shape, but stopped short of a generative round (see
// below). Round 4 finishes the job: day/month are now taught EXACTLY like every
// other counter — one rule card, then a rolled, live-generated round — and this
// file's DAY/MONTH objects carry the quizConfig that makes that round.
//
// WHY THIS IS A SIBLING FILE, NOT MORE COUNTER_SPECS IN number-construction.ts
// ===============================================================================
// Every OTHER construction page (number-construction.ts's COUNTER_SPECS) rolls
// its counts through number-reading.ts's shared counterReading() engine — a
// PREFIX + LAST UNIT mechanism built for counters whose irregularity is a sound
// shift on the ones digit. Day-of-month does not have that shape (20日's はつか
// is a whole suppletive word, not a digit-driven shift), so it needs its OWN
// engine (day-month-reading.ts) rather than a "day" CounterKind bolted onto the
// shared one — see that file's header for the fuller argument. Round 4 wires
// that separate engine into the SAME generative-quiz machinery every other
// counter uses (number-quiz.ts's QuizKind dispatches to it), so this file still
// earns its keep as a sibling of number-construction.ts rather than folding in:
// the READING logic is different, even though the TEACHING shape is now
// identical.
//
// DERIVED, NOT HAND-TYPED
// ========================
// Every reading below comes from day-month-reading.ts's dayReadingParts /
// monthReadingParts — the pure engine, cross-checked in day-month-reading.test.ts
// against counters.ts's DAYS/MONTHS — and every WORD (the kanji-plus-digit
// spelling, 十四日) is read straight off DAYS/MONTHS's own glyph, not re-spelled
// here. DAYS/MONTHS are no longer scheduled/drilled as individual forms (see
// counters.ts's note above DAYS) — they survive purely as this reference data —
// but they are still the REAL data a rolled quiz item and this page's example
// row are both built from, so a reading can never be shown here, or asked in a
// drill, that the app's own data does not equally ship.

import { DAYS, MONTHS, type CounterForm } from "@/data/counters";
import type { NumberConstruction } from "@/data/number-construction";
import type { CountBuildPiece, CountRow, IntroCountGroup, IntroPara } from "@/data/phase-intros";
import type { NumberQuizConfig } from "@/lib/engine/number-quiz";
import {
  dayReading,
  dayReadingParts,
  isDayException,
  monthReading,
  monthReadingParts,
  type DayMonthPart,
} from "@/lib/day-month-reading";

// ---------------------------------------------------------------------------
// Real forms, looked up rather than re-spelled — see the header note above.
// ---------------------------------------------------------------------------

const DAY_FORMS: readonly CounterForm[] = DAYS;
const MONTH_FORMS: readonly CounterForm[] = MONTHS;

/** Day n's real shipped form (1-31) — counters.ts lists all 31 in order, so
 * index n-1 names the same count with no key parsing. */
function dayForm(n: number): CounterForm {
  return DAY_FORMS[n - 1];
}

/** Month n's real shipped form (1-12), same lookup as dayForm. */
function monthForm(n: number): CounterForm {
  return MONTH_FORMS[n - 1];
}

/** DayMonthPart[] → CountBuildPiece[], the shape phase-intro-view's build
 * column renders. A single-piece result (a whole memorised/suppletive word,
 * such as 1st-10th or 20th) has no additive equation to show — the same "no
 * build" treatment counterRow gives 〜人's ひとり/ふたり/よにん — so it maps to
 * the empty array rather than a one-piece "equation" that would just repeat
 * the word. */
function toBuild(parts: readonly DayMonthPart[]): CountBuildPiece[] {
  if (parts.length <= 1) return [];
  return parts.map((p) => (p.value === undefined ? { kana: p.kana } : { kana: p.kana, value: String(p.value) }));
}

/** "11th", "20th", "23rd" — the ordinal label a day row's first column shows.
 * Pure formatting of the count itself, not a fact to cross-check. */
function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

function dayRow(n: number): CountRow {
  const form = dayForm(n);
  const parts = dayReadingParts(n)!;
  return {
    label: ordinal(n),
    word: form.glyph,
    reading: dayReading(n)!,
    build: toBuild(parts),
    result: { kana: form.reading, value: String(n) },
  };
}

function monthRow(n: number): CountRow {
  const form = monthForm(n);
  const parts = monthReadingParts(n)!;
  return {
    label: form.meaning, // "April" — the real gloss, not a re-typed month name.
    word: form.glyph,
    reading: monthReading(n)!,
    build: toBuild(parts),
    result: { kana: form.reading, value: String(n) },
  };
}

// ---------------------------------------------------------------------------
// DAY — three groups: the memorised 1st-10th (no rule, same tier as 〜つ),
// then Regular / Irregular for 11th-31st, the grammar-style split every other
// construction page uses for its 1-10 table.
// ---------------------------------------------------------------------------

const DAY_MEMORIZED_GROUP: IntroCountGroup = {
  title: "1st–10th (memorized)",
  counter: false,
  examples: Array.from({ length: 10 }, (_, i) => dayRow(i + 1)),
};

const DAY_REGULAR_GROUP: IntroCountGroup = {
  title: "Regular (11th–31st)",
  counter: false,
  examples: Array.from({ length: 21 }, (_, i) => i + 11)
    .filter((n) => !isDayException(n))
    .map(dayRow),
};

const DAY_IRREGULAR_GROUP: IntroCountGroup = {
  title: "Irregular (11th–31st)",
  counter: false,
  examples: Array.from({ length: 21 }, (_, i) => i + 11).filter(isDayException).map(dayRow),
};

const DAY_BODY: IntroPara[] = [
  {
    lead: "The 1st through the 10th are their own words.",
    text: "ついたち, ふつか, みっか, and so on through とおか are memorised outright, with no rule joining them to the number, the same way ひとつ through とお are for 〜つ.",
  },
  {
    lead: "11th and up: put the number in front of にち.",
    text: "Every other day is the plain number said before にち: 十一日 is じゅういちにち and 十五日 is じゅうごにち.",
  },
  {
    lead: "Three counts keep a memorised word instead.",
    text: "十四日 and 二十四日 reuse よっか, the 4th's own memorised word, instead of よん/し plus にち. 二十日 is its own word, はつか, unrelated to にじゅう.",
  },
  {
    lead: "Two more switch to the alternate reading of 7 and 9.",
    text: "十七日, 十九日, 二十七日 and 二十九日 still end in にち, but the number reads しち (not なな) or く (not きゅう), the same alternate reading 7月 and 9月 use.",
  },
];

/** The generative round the "day" category rolls: counts 1-31, mixed
 * read/write/hear, drawn LIVE from day-month-reading.ts's dayReading — never a
 * lookup table. Irregular-first coverage (buildNumberRound in number-quiz.ts)
 * guarantees a round of sufficient count surfaces every one of the seven
 * exception counts (IRREGULAR_COUNTS.day there): 14, 17, 19, 20, 24, 27, 29. */
const DAY_QUIZ_CONFIG: NumberQuizConfig = {
  count: 10,
  includeCounters: true,
  counters: ["day"],
  numberMax: 31,
  directions: ["read", "write", "hear"],
};

export const DAY: NumberConstruction = {
  id: "day",
  name: "Day of the month (〜日)",
  summary:
    "The 1st through the 10th are memorized; 11th and up add にち to the number, with a few exceptions.",
  glyph: "〜日",
  body: DAY_BODY,
  exampleGroups: [DAY_MEMORIZED_GROUP, DAY_REGULAR_GROUP, DAY_IRREGULAR_GROUP],
  quizConfig: DAY_QUIZ_CONFIG,
  searchAlso: ["day of the month", "にち", "日", "calendar day", "dates", "counting days"],
};

// ---------------------------------------------------------------------------
// MONTH — two groups: Regular / Irregular, the same split every counter page
// uses. There is no memorised tier the way DAYS has one — every month is
// built from a number, even the three that read it differently.
// ---------------------------------------------------------------------------

const MONTH_REGULAR_GROUP: IntroCountGroup = {
  title: "Regular",
  counter: false,
  examples: Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((n) => n !== 4 && n !== 7 && n !== 9)
    .map(monthRow),
};

const MONTH_IRREGULAR_GROUP: IntroCountGroup = {
  title: "Irregular",
  counter: false,
  examples: [4, 7, 9].map(monthRow),
};

const MONTH_BODY: IntroPara[] = [
  {
    lead: "Put the number in front of 〜月.",
    text: "A month is the plain number said before it: 二月 is にがつ and 五月 is ごがつ.",
  },
  {
    lead: "Three months read the number differently.",
    text: "四月 is しがつ, not よんがつ. 七月 is しちがつ, not なながつ. 九月 is くがつ, not きゅうがつ. Nothing else changes: it is still that reading of the number plus がつ.",
  },
];

/** The generative round the "month" category rolls: counts 1-12, mixed
 * read/write/hear, drawn LIVE from day-month-reading.ts's monthReading. */
const MONTH_QUIZ_CONFIG: NumberQuizConfig = {
  count: 10,
  includeCounters: true,
  counters: ["month"],
  numberMax: 12,
  directions: ["read", "write", "hear"],
};

export const MONTH: NumberConstruction = {
  id: "month",
  name: "Month of the year (〜月)",
  summary: "Almost every month is the number plus がつ; three months use a different reading of the number.",
  glyph: "〜月",
  body: MONTH_BODY,
  exampleGroups: [MONTH_REGULAR_GROUP, MONTH_IRREGULAR_GROUP],
  quizConfig: MONTH_QUIZ_CONFIG,
  searchAlso: ["month of the year", "がつ", "月", "calendar month", "months"],
};

// The lesson's own rule card for day/month is no longer authored here as a
// separate PhaseIntro (DAY_RULE_INTRO/MONTH_RULE_INTRO, round 2 through round
// 3): a generative category's rule card is now derived automatically, the
// same way every other counter's is — counter-categories.ts's counterIntro()
// builds it straight from DAY.body/MONTH.body plus DAY.exampleGroups/
// MONTH.exampleGroups (rendered as the same worked table this reference page
// shows), so there is no second card to keep in sync by hand. See
// lesson-steps.ts's generative-marker branch and counter-lesson.ts's
// GENERATIVE_UNITS.
