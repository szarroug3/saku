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
import {
  RECIPES,
  isPrimaryPatternRecipe,
  patternGroup,
  type Level,
  type Recipe,
} from "@/data/grammar/recipes";
import { autoPatternPage } from "@/data/grammar/auto-page";
import {
  BA_FORM_PAGES,
  CAUSATIVE_FORM_PAGES,
  CAUSATIVE_PASSIVE_FORM_PAGES,
  MASU_FORM_PAGES,
  NAI_FORM_PAGES,
  PASSIVE_FORM_PAGES,
  POTENTIAL_FORM_PAGES,
  STEM_FORM_PAGES,
  TA_FORM_PAGES,
  TARA_FORM_PAGES,
  VOLITIONAL_FORM_PAGES,
} from "@/data/grammar/form-intros";
import { factsOf } from "@/lib/facts";
import {
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  type PhaseIntro,
} from "@/data/phase-intros";
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
  /** Every independently quizzed meaning taught on this written pattern.
   * Usually one; ambiguous patterns such as 〜られる carry both senses in one
   * lesson and one Library page. */
  readonly recipeIds?: readonly string[];
}

/** Every fact a recipe teaches, read off the registry (never parsed) — its
 * meaning always, its production where the recipe carries one. The same lookup
 * grammar-lesson.ts's patternFacts used, lifted here so a lesson's `drills` and
 * a `pattern` page's `facts` are the identical list by construction. */
function patternFacts(recipeId: string): FactId[] {
  return factsOf(patternEntry(recipeId));
}

// ---------------------------------------------------------------------------
// FOUNDATIONAL LESSON PAGES — adjective noun form first, then the て/で-form.
//
// The class-split the owner locked: intro (what a form is) -> う-verbs ->
// る-verbs -> telling them apart -> いく exception -> する/くる irregulars ->
// what it does. Verbs are kana-only: a learner at the start of grammar has little
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
        text: "Adjectives can change shape too. Some forms can end a sentence. Others prepare a word for whatever comes next.",
      },
      {
        lead: "A pattern",
        text: "is a reusable way to combine a form with other words. It tells you how the pieces fit and what the whole thing means.",
      },
      {
        lead: "Not every form is a tense.",
        text: "A form might show time, a negative, or politeness, or it might just make a word ready for another piece.",
      },
      { text: "You learn a form once, then reuse it with many words and patterns." },
    ],
  },
  {
    // PAGE 2 — Verb Types. The godan/ichidan split, taught ONCE here and named
    // with both words so later form lessons can lean on the terms. No て-form
    // building on this page: the classes come first, the conjugation follows.
    id: "gl-verb-types",
    setId: "",
    eyebrow: "Verb Types",
    title: "Godan and Ichidan.",
    body: [
      {
        text: "Before you conjugate a verb, you need to figure out what group it's in. Every Japanese verb is an う-verb, an る-verb, or one of two irregulars, and the group decides how the verb changes.",
      },
      {
        lead: "う-verbs (godan)",
        text: "are the larger group. An う-verb ends in a kana from the う-row (う, く, ぐ, す, つ, ぬ, ぶ, む, or る), so かう, かく and はなす are all う-verbs.",
      },
      {
        lead: "る-verbs (ichidan)",
        text: "end in る, like たべる and みる.",
      },
      {
        text: "The spelling alone does not always tell them apart, because some verbs that end in る are う-verbs. かえる (to return) is an う-verb, while たべる (to eat) is an る-verb. You learn each verb's group with the verb, and the app tags it for you.",
      },
      {
        lead: "する and くる",
        text: "belong to neither group. They are the two irregular verbs, and you learn their conjugations by heart.",
      },
    ],
  },
  {
    // PAGE 3 — Adjective Types. Unlike the verb groups, the な class is not a
    // literal dictionary-form ending, so spelling is only a clue. Teach the
    // before-a-noun diagnostic here before any adjective conjugation table asks
    // the learner to understand an い / な label.
    id: "gl-adjective-types",
    setId: "",
    eyebrow: "Adjective Types",
    title: "い-adjectives and な-adjectives.",
    body: [
      {
        text: "Before you use an adjective, you need to know which of the two adjective classes it belongs to. The class is a property of the word, just like a verb's group.",
      },
      {
        lead: "い-adjectives",
        text: "usually end in い, like たかい and やすい. Before a noun they do not change: たかいみせ (an expensive shop). Their final い changes when they use other forms.",
      },
      {
        lead: "な-adjectives",
        text: "have no reliable kana ending. Examples include しずか, べんり, and げんき. They are called な-adjectives because they add な before a noun.",
      },
      {
        lead: "Spelling alone does not always identify the class.",
        text: "Some な-adjectives end in い even when there is no separate い after a kanji, including きれい. You learn the class with the word.",
      },
      {
        lead: "A useful clue:",
        text: "When a word is written with kanji followed by a separate い, like 高い, it is usually an い-adjective. This is not a guarantee: 嫌い has the same visible pattern but is a な-adjective.",
      },
    ],
  },
  {
    // PAGE 4 — the first adjective FORM, separate from the class-identification
    // concept above. This page owns both the meaning the following quiz asks for
    // and the build table; the adjective-types Library page stays a class guide.
    id: "gl-prenominal-form",
    setId: "",
    eyebrow: "The 〜な form",
    title: "Describe a noun.",
    hideLibraryIntro: true,
    body: [
      {
        lead: "The 〜な form",
        text: "lets an adjective describe a noun.",
      },
    ],
    buildSections: [{
      title: "Adjectives",
      hideTitle: true,
      body: [{
        heading: "Before a noun",
        text: "An い-adjective does not change, while a な-adjective adds な.",
      }],
      heads: { label: "Type", change: "Change" },
      rules: [
          {
            label: "い-adjective",
            verb: "たかい (expensive) + みせ (shop)",
            to: "たかいみせ",
            accent: false,
            audio: false,
          },
          {
            label: "な-adjective",
            verb: "しずか (quiet) + な + みせ (shop)",
            to: "しずかなみせ",
            accent: "な",
            audio: false,
          },
      ],
    }],
  },
  {
    // PAGE 5 — what the て/で-form is FOR, with the chain build-up. No conjugation
    // rules here (those are the next pages). The chain ends in a verb the learner cannot
    // build yet; the copy tells them not to worry about it, only that the LAST
    // verb carries the tense.
    id: "gl-te-form-use",
    setId: "",
    eyebrow: "The て/で-form",
    title: "One form, several meanings.",
    body: [
      {
        lead: "By itself,",
        text: 'a verb in the て/で-form is a casual request or command: まって "wait!", みて "look!", ちょっときて "come here a sec".',
      },
      {
        lead: "As a connector,",
        text: 'the て/で-form works with both verbs and adjectives. With verbs it links actions and can mean "and", "and then", "so", "because", or "while". With adjectives it links descriptions or gives a reason, often meaning "and" or "because". Context decides the exact connection.',
      },
      {
        lead: "When used as a connector,",
        text: "the form doesn't indicate the sentence's tense or politeness. The final predicate does. That final predicate may be a verb or an adjective, and the earlier て/で-forms stay the same when it changes.",
      },
      {
        text: "In たべて、のんで、はなしている, the final predicate, はなしている, is where the tense and politeness are indicated. In たかくて、べんりです, the final predicate, べんりです, does that job. Don't worry about how either ending is built yet; the point is that the earlier connector forms do not change with it.",
      },
    ],
    buildSections: [{
      title: "Connector example",
      body: [{
        text: "Each connector stays in the て/で-form. The final predicate carries the tense and politeness.",
      }],
      rules: [
        { verb: "たべる", to: "たべて", gloss: "eat" },
        { verb: "のむ", to: "のんで", gloss: "drink" },
        { verb: "はなす", to: "はなして", gloss: "talk" },
      ],
      footer: {
        chain: "たべて、のんで、はなしている",
        gloss: "is eating, drinking, and talking",
      },
    }],
  },
  {
    // PAGE 6 — how to build verbs: every godan ending, the one ichidan rule,
    // and the three exceptional or irregular verbs.
    id: "gl-te-build-verbs",
    setId: "",
    title: "Verbs",
    sectionTitle: true,
    body: [],
    buildSections: [{
      title: "Verbs",
      body: [
        {
          text: "Drop the verb's last kana and add the ending that matches. Some endings use て and some use で; the ending decides which, and they mean the same, so you never choose between them.",
        },
        {
          text: "いく is an exception: everywhere else it is a normal う-verb, but its て-form changes to って, not いて. する and くる are irregular: they follow no group's rule, so you learn their conjugations by heart.",
        },
      ],
      tables: [
      {
        title: "Godan (う-verbs)",
        rules: [
          {
            label: "う・つ・る",
            verb: "かう",
            drop: "う",
            add: "って",
            note: "The っ in って is a small っ, not a full-size つ.",
          },
          { label: "", verb: "まつ", drop: "つ", add: "って" },
          { label: "", verb: "とる", drop: "る", add: "って" },
          { label: "む・ぶ・ぬ", verb: "のむ", drop: "む", add: "んで" },
          { label: "", verb: "あそぶ", drop: "ぶ", add: "んで" },
          { label: "", verb: "しぬ", drop: "ぬ", add: "んで" },
          { label: "く", verb: "かく", drop: "く", add: "いて" },
          { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "いで" },
          { label: "す", verb: "はなす", drop: "す", add: "して" },
        ],
        heads: { label: "Ending" },
      },
      {
        title: "Ichidan (る-verbs)",
        rules: [{ verb: "たべる", drop: "る", add: "て" }],
      },
      {
        title: "Irregular verbs",
        rules: [
          { label: "exception", verb: "いく", drop: "く", add: "って" },
          { label: "irregular", verb: "する", to: "して" },
          { label: "irregular", verb: "くる", to: "きて" },
        ],
        heads: { label: "" },
      },
      ],
    }],
  },
  {
    // PAGE 7 — adjective building follows the verb rules as its own section,
    // so the two word types do not share one undifferentiated table stack.
    id: "gl-te-build-adjectives",
    setId: "",
    title: "Adjectives",
    sectionTitle: true,
    body: [],
    buildSections: [{
      title: "Adjectives",
      body: [{ text: "Change the adjective's ending according to its type." }],
      tables: [
      {
        title: "Adjectives",
        rules: [
          { label: "い-adjective", verb: "たかい", drop: "い", add: "くて" },
          { label: "な-adjective", verb: "しずか", drop: "", add: "で" },
        ],
        heads: { label: "Type" },
      },
      {
        title: "Irregular adjectives",
        rules: [
          {
            label: "exception",
            verb: "いい",
            to: "よくて",
          },
        ],
        heads: { label: "" },
      },
      ],
    }],
  },
];

/** Lesson 1, fully authored: the te-form pages, then the te-sequence drill it
 * sets up. `drills` are te-sequence's own facts — the meaning fact plus ONE
 * production fact per regular class, exceptional verb, and adjective type.
 * patternFacts reads exactly this set off the registry, so the lesson stays in
 * sync with the separately scored skills by construction. */
const LESSON_TE_FORM: GrammarLessonDef = {
  id: "te-form",
  title: "The て/で-form",
  pages: TE_FORM_PAGES.filter(
    (card) =>
      card.id !== "gl-te-intro" &&
      card.id !== "gl-adjective-types" &&
      card.id !== "gl-prenominal-form",
  ).map((card) => ({ kind: "teach", card })),
  drills: patternFacts("te-sequence"),
  primaryPattern: "te-sequence",
};

/** Grammar lesson 1: what a form is, the okurigana concept, the two adjective
 * classes, and the first adjective form. */
const LESSON_PRENOMINAL_FORM: GrammarLessonDef = {
  id: "prenominal-form",
  title: "Adjectives before nouns",
  pages: [
    { kind: "teach", card: TE_FORM_PAGES.find((p) => p.id === "gl-te-intro")! },
    { kind: "teach", card: OKURIGANA_INTRO },
    { kind: "teach", card: OKURIGANA_MOVING },
    { kind: "teach", card: TE_FORM_PAGES.find((p) => p.id === "gl-adjective-types")! },
    { kind: "teach", card: TE_FORM_PAGES.find((p) => p.id === "gl-prenominal-form")! },
  ],
  drills: patternFacts("prenominal-form"),
  primaryPattern: "prenominal-form",
};

/**
 * The Verb Types page (godan / ichidan), exported for the Library's verb-classes
 * concept reference (src/data/grammar-concepts.ts).
 *
 * The concept renders THIS object — the same `gl-verb-types` page lesson 2 teaches
 * the two verb groups with — so the reference page and the lesson say the same
 * words and cannot drift, the pointer-not-a-copy arrangement marks and terms make.
 * The て-form no longer has a concept page of its own: its Library entry (the
 * te-sequence form recipe) now carries the full teaching. */
export const VERB_TYPES_CONCEPT_PAGES: readonly PhaseIntro[] = [
  TE_FORM_PAGES.find((p) => p.id === "gl-verb-types")!,
];

/** The same adjective-class introduction used by the adjective-types Library
 * concept. The detailed reference can add conjugation examples after it, but the
 * answer to "which class is this word?" is taught once, here. */
export const ADJECTIVE_TYPES_CONCEPT_PAGES: readonly PhaseIntro[] = [
  TE_FORM_PAGES.find((p) => p.id === "gl-adjective-types")!,
];

// 〜ている has no authored lesson any more: it is a normal pattern, taught with the
// generated build page like the rest and bundled up to three at a time (it is no
// longer a solo sitting). The chain build-up it used to show now lives on lesson
// 1's て-form page, so it is not repeated here.

// ---------------------------------------------------------------------------
// THE OTHER FORM LESSONS — ない, た, stem.
//
// Each is its own sitting, taught before any pattern that uses the form, exactly
// as lesson 2 teaches the て-form. They are recipes (nai-form / ta-form /
// stem-form in recipes.ts) with add "", so the drill is "make the form" and the
// lesson flows through the same planner and quiz as any pattern — no special
// tracking. The authored pages are the form-intro tables (form-intros.ts), which
// no longer prepend onto a pattern (FORM_INTROS below drops these three). `drills`
// are the form recipe's own facts (its meaning plus its production). */
// ---------------------------------------------------------------------------

const LESSON_NAI_FORM: GrammarLessonDef = {
  id: "nai-form",
  title: "The ない-form",
  pages: NAI_FORM_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("nai-form"),
  primaryPattern: "nai-form",
};

const LESSON_TA_FORM: GrammarLessonDef = {
  id: "ta-form",
  title: "The た-form",
  pages: TA_FORM_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("ta-form"),
  primaryPattern: "ta-form",
};

const LESSON_STEM_FORM: GrammarLessonDef = {
  id: "stem-form",
  title: "The stem",
  pages: STEM_FORM_PAGES.map((card) => ({ kind: "teach", card })),
  drills: patternFacts("stem-form"),
  primaryPattern: "stem-form",
};

/** A standalone conjugation form (passive, potential, causative, …) as its own
 * lesson: the recipe id IS the form, its authored pages teach the conjugation. */
function formLesson(id: string, title: string, pages: readonly PhaseIntro[]): GrammarLessonDef {
  return {
    id,
    title,
    pages: pages.map((card) => ({ kind: "teach" as const, card })),
    drills: patternFacts(id),
    primaryPattern: id,
  };
}

const LESSON_PASSIVE = formLesson("passive", "The passive form", PASSIVE_FORM_PAGES);
const LESSON_POTENTIAL = formLesson("potential", "The potential form", POTENTIAL_FORM_PAGES);
const LESSON_CAUSATIVE = formLesson("causative", "The causative form", CAUSATIVE_FORM_PAGES);
const LESSON_CAUSATIVE_PASSIVE = formLesson(
  "causative-passive",
  "The causative-passive form",
  CAUSATIVE_PASSIVE_FORM_PAGES,
);
const LESSON_BA = formLesson("ba", "The ば-conditional", BA_FORM_PAGES);
const LESSON_TARA = formLesson("tara", "The たら-conditional", TARA_FORM_PAGES);
const LESSON_MASU_FORM = formLesson("masu-form", "The ます-form", MASU_FORM_PAGES);
const LESSON_VOLITIONAL_FORM = formLesson(
  "volitional-form",
  "The volitional form",
  VOLITIONAL_FORM_PAGES,
);

/**
 * The FORM-specific teaching pages a form recipe's Library entry renders, as one
 * stacked card — the same words the lesson teaches, so the two cannot drift.
 *
 * The て-form's lesson opens with two pages that are lesson-1 scaffolding rather
 * than facts about the form (the "what a form is" intro and the Verb Types page),
 * so its Library entry skips those and shows only the form's own pages: what it is
 * for, then separate verb and adjective build sections. The other forms have no
 * scaffolding — their whole lesson IS the form — so the Library shows all of it.
 */
const FORM_LIBRARY_PAGES: Readonly<Record<string, readonly PhaseIntro[]>> = {
  // The general Grammar page belongs to the track's first lesson, not to a
  // reference entry. The form's Library entry gets its own meaning-and-build
  // page instead of reusing the adjective-class concept page.
  "prenominal-form": TE_FORM_PAGES.filter((p) => p.id === "gl-prenominal-form"),
  "te-sequence": [
    TE_FORM_PAGES.find((p) => p.id === "gl-te-form-use")!,
    TE_FORM_PAGES.find((p) => p.id === "gl-te-build-verbs")!,
    TE_FORM_PAGES.find((p) => p.id === "gl-te-build-adjectives")!,
  ],
  "nai-form": NAI_FORM_PAGES,
  "ta-form": TA_FORM_PAGES,
  "stem-form": STEM_FORM_PAGES,
  "masu-form": MASU_FORM_PAGES,
  "volitional-form": VOLITIONAL_FORM_PAGES,
  "passive": PASSIVE_FORM_PAGES,
  "potential": POTENTIAL_FORM_PAGES,
  "causative": CAUSATIVE_FORM_PAGES,
  "causative-passive": CAUSATIVE_PASSIVE_FORM_PAGES,
  "ba": BA_FORM_PAGES,
  "tara": TARA_FORM_PAGES,
};

/** The Library teaching pages for a form recipe, or empty for a non-form recipe. */
export function formLibraryPages(recipeId: string): readonly PhaseIntro[] {
  return FORM_LIBRARY_PAGES[recipeId] ?? [];
}

// ---------------------------------------------------------------------------
// THE CURRICULUM, AS LESSONS.
//
// Same order the track has always taught in: te-form first, then N5 before N4,
// stable within a level (the sort is copied from grammar-lesson.ts's
// CURRICULUM_PATTERNS rather than imported, because that file imports THIS one
// and the dependency runs one way). te-sequence becomes the authored L1; every
// other recipe becomes a one-page `pattern` lesson for now — the same terse tile
// the track showed before, one concept per sitting. Every recipe is taught: a
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
  "prenominal-form": 0,
  "te-sequence": 1,
  "te-iru": 2,
};

function leadRank(r: Recipe): number {
  return LESSON_LEAD[r.id] ?? 3;
}

// ALL recipes are taught, not only the producible ones. A producible
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

/** A pattern with no hand-authored lesson, as a generated page: the 〜ている-page-1
 * shape (meaning line + build table), derived from the recipe by autoPatternPage.
 * Every verb form now has its own form lesson taught before its patterns (see
 * FORM_RECIPE_IDS), so nothing is prepended here any more — a pattern is just its
 * own generated page. The te-form and 〜ている are authored by hand; every other
 * drillable pattern flows through here. */
function autoLesson(r: Recipe): GrammarLessonDef {
  return {
    id: r.id,
    title: r.pattern,
    pages: [{ kind: "teach", card: autoPatternPage(r) }],
    drills: patternFacts(r.id),
    primaryPattern: r.id,
    recipeIds: [r.id],
  };
}

/** The grammar track's lessons, in teaching order. te-form is the authored L1;
 * the rest are terse pattern lessons until authored. This is the denominator on
 * the lesson card ("lesson N of X"), and it is accurate to the number of
 * lessons because it IS the list of lessons. */
const AUTHORED_LESSONS: Readonly<Record<string, GrammarLessonDef>> = {
  "prenominal-form": LESSON_PRENOMINAL_FORM,
  "te-sequence": LESSON_TE_FORM,
  "nai-form": LESSON_NAI_FORM,
  "ta-form": LESSON_TA_FORM,
  "stem-form": LESSON_STEM_FORM,
  "masu-form": LESSON_MASU_FORM,
  "volitional-form": LESSON_VOLITIONAL_FORM,
  "passive": LESSON_PASSIVE,
  "potential": LESSON_POTENTIAL,
  "causative": LESSON_CAUSATIVE,
  "causative-passive": LESSON_CAUSATIVE_PASSIVE,
  "ba": LESSON_BA,
  "tara": LESSON_TARA,
};

export const CURRICULUM_LESSONS: readonly GrammarLessonDef[] = ORDERED.filter(
  isPrimaryPatternRecipe,
).map((primary) => {
  const recipes = patternGroup(primary.id);
  const members = recipes.map((r) => AUTHORED_LESSONS[r.id] ?? autoLesson(r));
  return {
    id: primary.id,
    title: primary.pattern,
    pages: members.flatMap((lesson) => lesson.pages),
    // All same-pattern facts now belong to the canonical Library entry, so this
    // one lookup includes every sense and every production rule exactly once.
    drills: patternFacts(primary.id),
    primaryPattern: primary.id,
    recipeIds: recipes.map((r) => r.id),
  };
});

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
