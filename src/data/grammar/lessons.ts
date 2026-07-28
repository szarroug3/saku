// The grammar track as LESSONS, a thin layer above the recipe table.
//
// WHY A LESSON LAYER
// ==================
// The recipe table (recipes.ts) is the drill's inventory: one row per pattern,
// keyed to a meaning fact and (where it builds) a production fact. That is the
// right unit for the drill and the wrong unit for teaching. A beginner meeting
// the て/で-form for the first time needs several pages (what a form is, how each
// verb class builds it, the exceptions, what it does), not a single tile with a
// one-line gloss.
//
// So a GrammarLessonDef sits above the recipes: an ordered list of teaching
// PAGES plus the facts its quiz covers. A page is either a `teach` card (a
// PhaseIntro, rendered by the existing PhaseIntroView, zero new rendering code)
// or a `pattern` step (the terse recipe tile the track has always shown). The
// walk (lesson-steps.ts) reads these pages; the drill still runs on the facts.
//
// THE TAPER
// =========
// Richness follows track position, not a global switch (owner's call). The front
// of the track is heavy: L1 (て-form) is fully authored, class by class, because
// it is a learner's first encounter with a form. Later patterns that reuse a
// mechanic the learner already has need far less, so for now every pattern past
// the authored ones is a single terse `pattern` page, exactly what the track
// showed before this file existed. As those are authored, they grow their own
// teach pages; the interim is honest (one tile is one page), never a stub.

import { patternEntry } from "@/data/grammar";
import { DRILLABLE, type Level, type Recipe } from "@/data/grammar/recipes";
import { factsOf } from "@/lib/facts";
import type { PhaseIntro } from "@/data/phase-intros";
import type { FactId } from "@/types";

/** One page of a grammar lesson: a concept card, or a terse pattern tile.
 *
 * `teach` carries a PhaseIntro and renders through PhaseIntroView, the same
 * card kana uses for its concept pages. `pattern` carries the facts of one
 * recipe and renders as the existing grammar lesson tile (via itemsFromFacts in
 * lesson-steps.ts), so an un-authored pattern still teaches exactly as it did. */
export type GrammarPage =
  | { kind: "teach"; card: PhaseIntro }
  | { kind: "pattern"; facts: readonly FactId[] };

/** A grammar lesson: an ordered page arc plus the facts its quiz covers. */
export interface GrammarLessonDef {
  /** Stable id, independent of history. */
  id: string;
  /** The lesson's own title (the walk's first page carries its own hero, so
   * this is for cards and labels). */
  title: string;
  /** The teaching pages, in order. */
  pages: GrammarPage[];
  /** The facts this lesson introduces and its quiz covers (the drill runs on
   * these). May span more than one recipe later; today one lesson, one pattern's
   * facts (plus L1's te-sequence facts). */
  drills: FactId[];
  /** The recipe this lesson is built around, for the card tile and the host
   * gate. Every lesson today has one. */
  primaryPattern: string;
}

/** Every fact a recipe teaches, read off the registry (never parsed) — its
 * meaning always, its production where the recipe carries one. The same lookup
 * grammar-lesson.ts's patternFacts used, lifted here so a lesson's `drills` and
 * a `pattern` page's `facts` are the identical list by construction. */
function patternFacts(recipeId: string): FactId[] {
  return factsOf(patternEntry(recipeId));
}

// ---------------------------------------------------------------------------
// LESSON 1 — the て/で-form.
//
// The class-split the owner locked: intro (what a form is) -> う-verbs ->
// る-verbs -> telling them apart -> いく exception -> する/くる irregulars ->
// what it does. Verbs are kana-only: a learner at grammar lesson 1 has little
// kanji, and the point of every page is the ending, which the kana already show.
// Example verbs carry `say` wherever the change is audible (a sound change), and
// stay silent where it is purely written (る-verbs), the same rule the kana
// concept cards follow.
// ---------------------------------------------------------------------------

const TE_FORM_PAGES: PhaseIntro[] = [
  {
    id: "gl-te-intro",
    setId: "",
    eyebrow: "Grammar",
    title: "Grammar is how words fit together.",
    body: [
      { lead: "Japanese verbs change shape.", text: "Each shape is called a form." },
      {
        text: "Some forms can end a sentence. Others prepare the verb for whatever comes next.",
      },
      {
        lead: "A pattern",
        text: "is a reusable way to combine a form with other words. It tells you how the pieces fit and what the whole thing means.",
      },
      {
        lead: "Not every form is a tense.",
        text: "A form might show time, a negative, or politeness, or it might just make the verb ready for another piece.",
      },
      { text: "You learn a form once, then reuse it with many verbs and patterns." },
    ],
  },
  {
    id: "gl-te-u-verbs",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "Most verbs are う-verbs, and their ending decides the change.",
    body: [
      {
        text: "Japanese verbs fall into two main groups. The larger group is called う-verbs. To build the て/で-form, start from the dictionary form (the plain form you look a verb up by), drop its last kana, and add the ending that matches.",
      },
      {
        text: "The endings group up: う, つ and る take って; む, ぶ and ぬ take んで; く takes いて; ぐ takes いで; す takes して.",
      },
      {
        text: "Some endings use て and some use で. Which one you get is fixed by the verb's ending. They are the same form with the same meaning, so you never choose between them.",
      },
    ],
    examples: [
      { from: "かう", op: "→", to: "かって", gloss: "to buy", say: "かって" },
      { from: "のむ", op: "→", to: "のんで", gloss: "to drink", say: "のんで" },
      { from: "かく", op: "→", to: "かいて", gloss: "to write", say: "かいて" },
      { from: "およぐ", op: "→", to: "およいで", gloss: "to swim", say: "およいで" },
      { from: "はなす", op: "→", to: "はなして", gloss: "to speak", say: "はなして" },
    ],
  },
  {
    id: "gl-te-ru-verbs",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "The other group, る-verbs, just drop る and add て.",
    body: [
      {
        text: "The second group is called る-verbs. These are simpler: drop the final る and add て. There is no sound change, and never で.",
      },
    ],
    examples: [
      { from: "たべる", op: "→", to: "たべて", gloss: "to eat" },
      { from: "みる", op: "→", to: "みて", gloss: "to see" },
    ],
  },
  {
    id: "gl-te-which-class",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "A verb ending in る can belong to either group.",
    body: [
      {
        text: "The spelling alone does not tell you which group a る verb is in. かえる (to return) is an う-verb, so it becomes かえって. たべる (to eat) is an る-verb, so it becomes たべて.",
      },
      {
        text: "You learn each verb's group along with the verb, and the app tags it for you. With practice you will start to recognise which group a verb belongs to.",
      },
    ],
    examples: [
      { from: "かえる", op: "→", to: "かえって", gloss: "to return, an う-verb", say: "かえって" },
      { from: "たべる", op: "→", to: "たべて", gloss: "to eat, an る-verb", say: "たべて" },
    ],
  },
  {
    id: "gl-te-iku",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "いく (to go) is the one exception.",
    body: [
      { text: "A verb ending in く normally takes いて. いく does not: it becomes いって." },
      { text: "This same special change comes back later, when you learn the past (た) form." },
    ],
    examples: [{ from: "いく", op: "→", to: "いって", gloss: "to go", say: "いって" }],
  },
  {
    id: "gl-te-irregular",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "する and くる follow no rule, so you learn them by heart.",
    body: [
      {
        text: "Two common verbs are irregular. する (to do) becomes して. くる (to come) becomes きて.",
      },
    ],
    examples: [
      { from: "する", op: "→", to: "して", gloss: "to do", say: "して" },
      { from: "くる", op: "→", to: "きて", gloss: "to come", say: "きて" },
    ],
  },
  {
    id: "gl-te-use",
    setId: "",
    eyebrow: "Using the て/で-form",
    title: "The て/で-form links ideas, and the last verb sets the tense.",
    body: [
      {
        lead: "It connects.",
        text: "The て/で-form joins one action or situation to the next. Depending on the sentence it can feel like and, and then, so, because, or while, and the context tells you which.",
      },
      {
        lead: "The final verb carries the rest.",
        text: "The form itself does not say when something happened or whether it is polite. The last verb does. たべて、ねます means eat and then sleep; たべて、ねました means ate and then slept. Only the last verb changed.",
      },
    ],
  },
];

/** Lesson 1, fully authored: the te-form pages, then the te-sequence drill it
 * sets up. `drills` are te-sequence's own facts, so the quiz after the walk is
 * the te-form production/meaning drill the track already had. */
const LESSON_TE_FORM: GrammarLessonDef = {
  id: "te-form",
  title: "The て/で-form",
  pages: TE_FORM_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("te-sequence"),
  primaryPattern: "te-sequence",
};

// ---------------------------------------------------------------------------
// THE CURRICULUM, AS LESSONS.
//
// Same order the track has always taught in: te-form first, then N5 before N4,
// stable within a level (the sort is copied from grammar-lesson.ts's
// CURRICULUM_PATTERNS rather than imported, because that file imports THIS one
// and the dependency runs one way). te-sequence becomes the authored L1; every
// other drillable recipe becomes a one-page `pattern` lesson for now — the same
// terse tile the track showed before, one concept per sitting.
// ---------------------------------------------------------------------------

function levelRank(level: Level): number {
  return level === "N5" ? 0 : level === "N4" ? 1 : 2;
}

function teFormFirst(r: Recipe): number {
  return r.id === "te-sequence" ? 0 : 1;
}

const ORDERED: readonly Recipe[] = [...DRILLABLE].sort(
  (a, b) => teFormFirst(a) - teFormFirst(b) || levelRank(a.level) - levelRank(b.level),
);

/** A not-yet-authored pattern, as a single terse lesson: one `pattern` page
 * over the recipe's own facts, taught exactly as the track taught it before. */
function autoLesson(r: Recipe): GrammarLessonDef {
  const facts = patternFacts(r.id);
  return {
    id: r.id,
    title: r.pattern,
    pages: [{ kind: "pattern", facts }],
    drills: facts,
    primaryPattern: r.id,
  };
}

/** The grammar track's lessons, in teaching order. te-form is the authored L1;
 * the rest are terse pattern lessons until authored. This is the denominator on
 * the lesson card ("lesson N of X"), and it is accurate to the number of
 * lessons because it IS the list of lessons. */
export const CURRICULUM_LESSONS: readonly GrammarLessonDef[] = ORDERED.map((r) =>
  r.id === "te-sequence" ? LESSON_TE_FORM : autoLesson(r),
);

/** Fact -> the lesson that teaches it. Built once from every lesson's drills, so
 * the walk can recover a lesson from the flat teach set the session hands it. */
const LESSON_BY_FACT: ReadonlyMap<FactId, GrammarLessonDef> = (() => {
  const m = new Map<FactId, GrammarLessonDef>();
  for (const lesson of CURRICULUM_LESSONS) {
    for (const f of lesson.drills) if (!m.has(f)) m.set(f, lesson);
  }
  return m;
})();

/**
 * The grammar lesson a teach set belongs to, or null when the facts are not a
 * grammar lesson (any other subject, or a grammar fact no lesson owns). Matches
 * on the first fact that names a lesson — a grammar sitting is one lesson, so
 * every fact in the set points at the same one.
 */
export function grammarLessonForFacts(facts: readonly FactId[]): GrammarLessonDef | null {
  for (const f of facts) {
    const lesson = LESSON_BY_FACT.get(f);
    if (lesson) return lesson;
  }
  return null;
}
