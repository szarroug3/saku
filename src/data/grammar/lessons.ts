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
import { RECIPES, type Level, type Recipe } from "@/data/grammar/recipes";
import { autoPatternPage } from "@/data/grammar/auto-page";
import {
  MASU_FORM_PAGES,
  NAI_FORM_PAGES,
  STEM_FORM_PAGES,
  TA_FORM_PAGES,
  VOLITIONAL_FORM_PAGES,
} from "@/data/grammar/form-intros";
import { factsOf } from "@/lib/facts";
import type { Form } from "@/lib/conjugate";
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
        lead: "This is the て/で-form,",
        text: "named for the て or で the verb ends in once you build it.",
      },
      {
        text: "Japanese verbs fall into two main groups, and the group decides the change. The larger group is called う-verbs: start from the dictionary form (the plain form you look a verb up by), drop its last kana, and add the ending that matches.",
      },
      {
        text: "The name is from the kana chart, not the spelling: an う-verb ends in a kana from the う-row (う, く, ぐ, す, つ, ぬ, ぶ, む, or る), so かく and はなす are う-verbs too, not only verbs ending in う.",
      },
      {
        text: "Some endings use て and some use で. Which one you get is fixed by the verb's ending. They are the same form with the same meaning, so you never choose between them.",
      },
    ],
    buildRules: [
      {
        label: "う・つ・る",
        verb: "かう",
        drop: "う",
        add: "って",
        note: "The っ in って is a small っ, not a full-size つ.",
      },
      { label: "", verb: "まつ", drop: "つ", add: "って" },
      { label: "む・ぶ・ぬ", verb: "のむ", drop: "む", add: "んで" },
      { label: "", verb: "あそぶ", drop: "ぶ", add: "んで" },
      { label: "", verb: "しぬ", drop: "ぬ", add: "んで" },
      { label: "く", verb: "かく", drop: "く", add: "いて" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "いで" },
      { label: "す", verb: "はなす", drop: "す", add: "して" },
    ],
    buildHeads: { label: "Ending" },
  },
  {
    id: "gl-te-ru-verbs",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "The other group, る-verbs, just drop る and add て.",
    body: [
      {
        text: "The second group is called る-verbs. These are simpler: drop the final る and add て. Unlike う-verbs, る-verbs only change to て, never で.",
      },
    ],
    buildRules: [
      { verb: "たべる", drop: "る", add: "て" },
      { verb: "みる", drop: "る", add: "て" },
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
    buildRules: [
      { label: "う-verb", verb: "かえる", drop: "る", add: "って" },
      { label: "る-verb", verb: "たべる", drop: "る", add: "て" },
    ],
    buildHeads: { label: "Verb type" },
  },
  {
    id: "gl-te-iku",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "いく (to go) is the one exception.",
    body: [
      { text: "A verb ending in く normally takes いて. いく does not: its て-form is いって." },
      {
        text: "いく breaks the rule only some of the time. In most forms it acts like any く-verb. The て-form is one of the few where it does not.",
      },
    ],
    buildRules: [{ verb: "いく", drop: "く", add: "って" }],
  },
  {
    id: "gl-te-irregular",
    setId: "",
    eyebrow: "Building the て/で-form",
    title: "する and くる follow no rule, so you learn them by heart.",
    body: [
      {
        text: "する (to do) and くる (to come) are the only two irregular verbs. Unlike いく, which is regular in most forms, these two never follow the う-verb or る-verb rules, so every form is learned by heart.",
      },
      { text: "For the て-form: する becomes して, and くる becomes きて." },
    ],
    buildRules: [
      { verb: "する", to: "して" },
      { verb: "くる", to: "きて" },
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
        text: 'The て/で-form joins one action or situation to the next. Depending on the sentence it can feel like "and", "and then", "so", "because", or "while", and the context tells you which.',
      },
      {
        lead: "The final verb carries the rest.",
        text: "The form itself does not say when something happened or whether it is polite. The last verb does. たべて、ねます means eat and then sleep; たべて、ねました means ate and then slept.",
      },
      {
        text: "Don't worry about how that last verb is built yet. Just notice that the first verb, たべて, stays the same in both, and only the last verb changes.",
      },
    ],
  },
];

/** Lesson 1, fully authored: the te-form pages, then the te-sequence drill it
 * sets up. `drills` are te-sequence's own facts — the meaning fact plus ONE
 * production fact per ending (って, んで, いて, いで, して; see te-endings.ts). The
 * te-form's production splits by ending rather than carrying a single "build the
 * て-form" fact, so a full-coverage round now asks the learner to build the
 * て-form of one verb of EACH ending, not one verb total. patternFacts reads
 * exactly this set off the registry (the plain production fact no longer exists),
 * so it stays in sync by construction. る-ending verbs are excluded on purpose —
 * their class is not predictable from spelling. */
const LESSON_TE_FORM: GrammarLessonDef = {
  id: "te-form",
  title: "The て/で-form",
  pages: TE_FORM_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("te-sequence"),
  primaryPattern: "te-sequence",
};

/**
 * The two CONCEPTUAL te-form pages, exported for the Library's grammar-concept
 * reference (src/data/grammar-concepts.ts).
 *
 * `gl-te-intro` (what a conjugation form is) and `gl-te-use` (て as a connector,
 * and the last verb carrying the tense and politeness) are the two pages that
 * teach the て-form as an IDEA rather than a build table. The concept entry
 * renders THESE objects, so the reference page and the lesson say the same words
 * and cannot drift — the same pointer-not-a-copy arrangement marks and terms
 * make. Selected by id off TE_FORM_PAGES rather than re-authored; the ids are
 * stable, so the lookup is total. */
export const TE_FORM_CONCEPT_PAGES: readonly PhaseIntro[] = [
  TE_FORM_PAGES.find((p) => p.id === "gl-te-intro")!,
  TE_FORM_PAGES.find((p) => p.id === "gl-te-use")!,
];

// ---------------------------------------------------------------------------
// LESSON 2 — 〜ている.
//
// Builds directly on lesson 1: 〜ている is the て/で-form plus いる. Two pages: what
// it means and how to build it (one page — the meaning and the build are the same
// small move, so they share a page), then connecting ongoing actions (chain
// て-forms, end with 〜ている). The build table reuses lesson 1's equation frame as
// an add-only step (て-form + いる), including the する/くる irregulars.
// ---------------------------------------------------------------------------

const TE_IRU_PAGES: PhaseIntro[] = [
  {
    id: "gl-teiru-meaning",
    setId: "",
    eyebrow: "Grammar",
    title: "〜ている: an action in progress.",
    body: [
      {
        text: 'Put a verb in its て/で-form, then add いる. It says the action is happening or ongoing, often "am/is/are …-ing" in English.',
      },
      {
        text: "The first part stays in its て/で-form; adding いる is what gives the whole thing its ongoing meaning.",
      },
    ],
    buildRules: [
      { verb: "たべて", add: "いる", gloss: "is eating" },
      { verb: "のんで", add: "いる", gloss: "is drinking" },
      { verb: "して", add: "いる", gloss: "is doing" },
      { verb: "きて", add: "いる", gloss: "is coming" },
    ],
  },
  {
    id: "gl-teiru-connect",
    setId: "",
    eyebrow: "Using 〜ている",
    title: "Chain て/で-forms, and end with 〜ている.",
    body: [
      {
        text: "As you saw with the て/で-form, it can connect ideas. To connect ongoing actions, put the earlier verbs in their て/で-form and end the chain with 〜ている.",
      },
      {
        lead: "Each verb before the last",
        text: "takes the plain て/で-form; only the final verb takes 〜ている. Build each one, then put them together.",
      },
    ],
    buildRules: [
      { verb: "たべる", to: "たべて", gloss: "eat" },
      { verb: "のむ", to: "のんで", gloss: "drink" },
      { verb: "はなす", to: "はなしている", gloss: "talk" },
    ],
    buildFooter: {
      chain: "たべて、のんで、はなしている",
      gloss: "is eating, drinking, and talking",
    },
  },
];

const LESSON_TE_IRU: GrammarLessonDef = {
  id: "te-iru",
  title: "〜ている",
  pages: TE_IRU_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("te-iru"),
  primaryPattern: "te-iru",
};

// ---------------------------------------------------------------------------
// THE CURRICULUM, AS LESSONS.
//
// Same order the track has always taught in: te-form first, then N5 before N4,
// stable within a level (the sort is copied from grammar-lesson.ts's
// CURRICULUM_PATTERNS rather than imported, because that file imports THIS one
// and the dependency runs one way). te-sequence becomes the authored L1; every
// other recipe becomes a one-page `pattern` lesson for now — the same terse tile
// the track showed before, one concept per sitting. All 96 recipes are taught: a
// producible pattern drills its production, a non-producible one drills its
// meaning only (its lesson's drills are [meaning] by construction).
// ---------------------------------------------------------------------------

function levelRank(level: Level): number {
  return level === "N5" ? 0 : level === "N4" ? 1 : 2;
}

/** The authored lessons that lead the track, in the order Grammar.md sets: the
 * て/で-form first, then 〜ている. Everything else falls to `2` and keeps its
 * level/authored order behind them. This is the first slice of the draft's
 * family re-cut; the rest of the ordering is still the recipe table's. */
const LESSON_LEAD: Readonly<Record<string, number>> = {
  "te-sequence": 0,
  "te-iru": 1,
};

function leadRank(r: Recipe): number {
  return LESSON_LEAD[r.id] ?? 2;
}

// ALL 96 recipes are taught, not only the 56 producible ones. A producible
// recipe carries a production drill; a non-producible one (a vacuous pattern
// like 〜と思う, an order-free wrap like 〜たり〜たり, or 〜しか〜ない) carries only
// its meaning fact, so its lesson drills MEANING alone (autoLesson reads factsOf,
// which is [meaning] for it) and is quizzed by multiple choice. The sort is
// unchanged and stable, so the 40 non-producible patterns interleave by level
// among their kin — 〜と思う (N5) sits with the N5s, the N3 set after the N4s —
// and each level keeps its authored RECIPES order.
const ORDERED: readonly Recipe[] = [...RECIPES].sort(
  (a, b) => leadRank(a) - leadRank(b) || levelRank(a.level) - levelRank(b.level),
);

/** A form and the intro pages that teach it. The intro rides the FIRST pattern
 * in teaching order that is built on that form, so the form is taught just before
 * it is first used — the way lesson 1 teaches the て-form before the て-patterns.
 * (The て-form and stem→ます chain past this: te-sequence/te-iru are authored, and
 * the te-family all sits under lesson 1's form.) */
const FORM_INTROS: readonly { form: Form; pages: readonly PhaseIntro[] }[] = [
  { form: "nai", pages: NAI_FORM_PAGES },
  { form: "ta", pages: TA_FORM_PAGES },
  { form: "stem", pages: STEM_FORM_PAGES },
  { form: "masu", pages: MASU_FORM_PAGES },
  { form: "volitional", pages: VOLITIONAL_FORM_PAGES },
];

/** Recipe id → the form-intro pages to prepend to its lesson, for the one recipe
 * that first introduces each form. Computed off ORDERED so it always lands on the
 * head of the family, whatever the order re-cut. */
const FORM_INTRO_AT: ReadonlyMap<string, readonly PhaseIntro[]> = (() => {
  const m = new Map<string, readonly PhaseIntro[]>();
  for (const fi of FORM_INTROS) {
    const first = ORDERED.find((r) => r.attach.find((a) => a.host === "verb")?.form === fi.form);
    if (first) m.set(first.id, fi.pages);
  }
  return m;
})();

/** A pattern with no hand-authored lesson, as a generated page: the 〜ている-page-1
 * shape (meaning line + build table), derived from the recipe by autoPatternPage.
 * Where this pattern is the first to use a form, the form's intro pages are
 * prepended so the form is taught before it is used. The te-form and 〜ている are
 * authored by hand; every other drillable pattern flows through here. */
function autoLesson(r: Recipe): GrammarLessonDef {
  const facts = patternFacts(r.id);
  const intro = (FORM_INTRO_AT.get(r.id) ?? []).map(
    (card) => ({ kind: "teach" as const, card }),
  );
  return {
    id: r.id,
    title: r.pattern,
    pages: [...intro, { kind: "teach", card: autoPatternPage(r) }],
    drills: facts,
    primaryPattern: r.id,
  };
}

/** The grammar track's lessons, in teaching order. te-form is the authored L1;
 * the rest are terse pattern lessons until authored. This is the denominator on
 * the lesson card ("lesson N of X"), and it is accurate to the number of
 * lessons because it IS the list of lessons. */
export const CURRICULUM_LESSONS: readonly GrammarLessonDef[] = ORDERED.map((r) =>
  r.id === "te-sequence"
    ? LESSON_TE_FORM
    : r.id === "te-iru"
      ? LESSON_TE_IRU
      : autoLesson(r),
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
 * on the first fact that names a lesson. A pattern-bundle sitting now carries
 * several lessons at once, so the walk uses grammarLessonsForFacts (plural); this
 * single-lesson lookup is kept for callers that only need to know a set is
 * grammar and which lesson it opens with.
 */
export function grammarLessonForFacts(facts: readonly FactId[]): GrammarLessonDef | null {
  for (const f of facts) {
    const lesson = LESSON_BY_FACT.get(f);
    if (lesson) return lesson;
  }
  return null;
}

/**
 * Every grammar lesson a teach set covers, in teaching (CURRICULUM_LESSONS)
 * order — the bundled-sitting generalization of grammarLessonForFacts.
 *
 * A pattern-bundle sitting hands out up to three lessons' drills as one flat
 * teach set (see nextGrammarLesson), so the walk has to emit each lesson's pages
 * in turn, not just the first one's. Deduped and ordered by CURRICULUM_LESSONS so
 * the pages read in the order the patterns are taught. Empty when the facts are
 * not a grammar lesson.
 */
export function grammarLessonsForFacts(facts: readonly FactId[]): GrammarLessonDef[] {
  const set = new Set(facts);
  const out: GrammarLessonDef[] = [];
  for (const lesson of CURRICULUM_LESSONS) {
    if (lesson.drills.some((f) => set.has(f))) out.push(lesson);
  }
  return out;
}
