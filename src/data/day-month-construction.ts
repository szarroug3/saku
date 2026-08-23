// DAY-OF-MONTH AND MONTH-OF-YEAR — the "how it's built" reference pages for
// 〜日 and 〜月, SAK-163's round-2 fix.
//
// WHY THIS EXISTS
// ================
// The first SAK-163 round shipped DAYS and MONTHS (src/data/counters.ts) as 43
// flat, independent CounterForm entries — every one of them individually
// memorised, with no card anywhere saying that most of them actually follow a
// rule. Review feedback (Changes Requested): a learner staring at 31 unrelated
// day tiles has no way to see that 11th-31st is almost entirely "[number] +
// にち", and the app already teaches every OTHER generative counter (〜本, 〜匹,
// the tens, the big words) with exactly that shape — a rule card plus a named
// Irregular table — via src/data/number-construction.ts. This file gives
// day/month the SAME reference-page shape.
//
// WHY THIS IS A SIBLING FILE, NOT MORE ENTRIES IN COUNTER_CATEGORIES
// ======================================================================
// Every OTHER construction page (src/data/number-construction.ts's
// COUNTER_SPECS) pairs with a src/data/counter-categories.ts CATEGORY: a
// MARKER-gated generative round that drills freshly ROLLED counts through
// number-reading.ts's counterReading() engine. Day/month cannot take that path
// — see day-month-reading.ts's header for why bolting a "day" CounterKind onto
// that shared engine is the wrong move, not just an omission. And day/month do
// not NEED a generative round: every one of the 31/12 possible counts already
// ships as its own real, drillable CounterForm (counters.ts's DAYS/MONTHS,
// unchanged by this file), so the ordinary word-fact Drill already covers them.
// What was missing was never "more drilling" — it was the missing RULE. So
// these two pages carry a body + exampleGroups exactly like every other
// construction page (and slot into the very same NUMBER_CONSTRUCTIONS array —
// see number-construction.ts, where DAY/MONTH are appended), but their
// `quizConfig` is absent: there is no generative round to launch, and the
// interface's `quizConfig` was loosened to optional for exactly this case (see
// number-construction.ts's NumberConstruction doc comment).
//
// DERIVED, NOT HAND-TYPED
// ========================
// Every reading below comes from day-month-reading.ts's dayReadingParts /
// monthReadingParts — the pure engine, cross-checked in
// day-month-reading.test.ts against counters.ts's real shipped forms — and
// every WORD (the kanji-plus-digit spelling, 十四日) is read straight off the
// real CounterForm the learner will actually meet (COUNTER_CURRICULUM's DAYS/
// MONTHS), not re-spelled here. So this page, like every other construction
// page, can never state a reading — or a glyph — the app does not also ship.

import { COUNTER_CURRICULUM, type CounterForm } from "@/data/counters";
import type { NumberConstruction } from "@/data/number-construction";
import type { CountBuildPiece, CountRow, IntroCountGroup, IntroPara, PhaseIntro } from "@/data/phase-intros";
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

const DAY_FORMS: readonly CounterForm[] = COUNTER_CURRICULUM.filter((f) => f.counter === "日");
const MONTH_FORMS: readonly CounterForm[] = COUNTER_CURRICULUM.filter((f) => f.counter === "月");

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

// Mutable (IntroPara[], not readonly): shared verbatim by DAY.body (which
// wants readonly IntroPara[]) AND DAY_RULE_INTRO.body (PhaseIntro's own body
// field is mutable IntroPara[]) — a mutable array satisfies both.
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

export const DAY: NumberConstruction = {
  id: "day",
  name: "Day of the month (〜日)",
  summary:
    "The 1st through the 10th are memorized; 11th and up add にち to the number, with a few exceptions.",
  glyph: "〜日",
  body: DAY_BODY,
  exampleGroups: [DAY_MEMORIZED_GROUP, DAY_REGULAR_GROUP, DAY_IRREGULAR_GROUP],
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

export const MONTH: NumberConstruction = {
  id: "month",
  name: "Month of the year (〜月)",
  summary: "Almost every month is the number plus がつ; three months use a different reading of the number.",
  glyph: "〜月",
  body: MONTH_BODY,
  exampleGroups: [MONTH_REGULAR_GROUP, MONTH_IRREGULAR_GROUP],
  searchAlso: ["month of the year", "がつ", "月", "calendar month", "months"],
};

// ---------------------------------------------------------------------------
// LESSON RULE CARDS — shown once, right before the material they explain,
// the same "non-term additional intro page" shape as TSU_INTRO
// (src/data/track-intros.ts). PROSE ONLY, no countTables: unlike a generative
// category's rule card (which is the only place a learner sees a worked
// table before the drill rolls random counts), day/month's individual forms
// are taught right around this same card in a fixed 1st..31st / 1月..12月
// sequence, so restating the whole table here would only repeat what the next
// dozen-plus cards already show one at a time. The full worked table lives on
// the Library reference page (DAY/MONTH above) for a reader who lands there
// out of lesson order. Body text is shared verbatim with DAY/MONTH so the
// lesson card and the reference page cannot drift apart in wording.
// ---------------------------------------------------------------------------

export const DAY_RULE_INTRO: PhaseIntro = {
  id: "intro-day-rule",
  setId: "",
  eyebrow: "How day-of-month readings work",
  title: "The 1st through the 10th are memorized; the 11th and up build from the number.",
  body: DAY_BODY,
};

export const MONTH_RULE_INTRO: PhaseIntro = {
  id: "intro-month-rule",
  setId: "",
  eyebrow: "How month readings work",
  title: "A month is almost always just the number plus 〜月.",
  body: MONTH_BODY,
};
