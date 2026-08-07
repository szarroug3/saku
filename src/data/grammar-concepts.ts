// GRAMMAR CONCEPTS — the ideas a grammar lesson teaches, kept as reference pages.
//
// THE HOLE THIS FILLS
// ===================
// A grammar pattern's Library entry (/library/grammar/te-sequence) shows the
// BUILD table: how the conjugation is formed, class by class. That is the right
// unit for "how do I make the て-form", and the wrong unit for the CONCEPTUAL
// teaching the lesson also gives — what a conjugation form even is, how the
// て-form works as a CONNECTOR that chains actions, and how the LAST verb in the
// chain carries the tense and the politeness. That teaching lived only in the
// lesson pages; once you had done the lesson there was nowhere to go back to it.
//
// So a grammar concept is a Library entry whose subject is a grammar IDEA rather
// than a single pattern. It is reference material, read and never drilled — the
// same shape a term (src/data/terms.ts) and a mark (src/data/marks.ts) already
// take: no glyph (the entry's title is its NAME), no facts ("what is a
// conjugation form" has no gradeable answer), and a body that is the lesson's
// own prose.
//
// NOT A WRITING RULE, AND ON ITS OWN SHELF
// ========================================
// A mark is a READING RULE and shelves under "Writing rules"; the owner
// explicitly did NOT want the て-form concept filed there. A grammar concept is
// its own kind, "Grammar concepts", parked next to the Grammar shelf it explains
// (see KINDS in src/lib/library/entries.ts). Only the te-family entries LINK to
// it — from their Links card's "Read about it" row — which is all the owner asked
// for; the shelf itself is a bonus browse home, not the requirement.
//
// THE PROSE IS THE LESSON'S, NOT A SECOND COPY
// ============================================
// The verb-classes concept's `cards` point at the very PhaseIntro the lesson
// teaches the two verb groups with (VERB_TYPES_CONCEPT_PAGES in
// src/data/grammar/lessons.ts): the gl-verb-types "Godan and Ichidan" page. The
// entry page renders that object through the lesson's own IntroBody, so the
// concept page and the lesson say the same words and cannot drift. `summary` and
// `body` below are the small amount that is genuinely new: the one-line shelf note
// (and page sub-heading), and a short-answer fallback for a concept that ever
// ships with no card. (The て-form no longer has a concept page — the te-sequence
// form recipe's own Library entry carries its full teaching now.)

import {
  ADJECTIVE_TYPES_CONCEPT_PAGES,
  VERB_TYPES_CONCEPT_PAGES,
} from "@/data/grammar/lessons";
import type { PhaseIntro } from "@/data/phase-intros";
import { entryId } from "@/lib/fact-id";
import type { EntryId } from "@/types";

/** The subject id, in the same shape as MARK_SUBJECT / TERM_SUBJECT. It is also
 * the URL kind segment (/library/grammar-concept/te-form) and the shelf's id. */
export const GRAMMAR_CONCEPT_SUBJECT = "grammar-concept";

/** Mint a grammar concept's entry id. The ONLY place a concept id is constructed;
 * everything downstream resolves it by lookup, never by taking the id apart. */
export function grammarConceptEntry(id: string): EntryId {
  return entryId(GRAMMAR_CONCEPT_SUBJECT, id);
}

/** One grammar-concept reference page. Shaped like a Term: no glyph (the title
 * IS the name), no facts, and a body that is the lesson's own prose (`cards`). */
export interface GrammarConcept {
  /** Stable id — the URL slug, the React key, and what a test names. */
  readonly id: string;
  /** What it is CALLED. The entry's title; a concept has no glyph. */
  readonly name: string;
  /** One line, for the shelf row and the entry page's sub-heading. */
  readonly summary: string;
  /** The short answer, as paragraphs — shown ONLY when no card follows it (see
   * GrammarConceptView), the same fallback a term makes. */
  readonly body: readonly string[];
  /** What someone might TYPE to find this beyond its name — the jargon and
   * phrasings a learner would reach for. Search matches an alias exactly. */
  readonly searchAlso?: readonly string[];
  /** Other concepts this one points at — the "Read about it" cross-links on the
   * concept's own page. The verb-class idea and the て-form idea each send the
   * reader to the other; a plain reference to a sibling concept, by its id. */
  readonly related?: readonly string[];
  /** The concept's teaching pages, rendered through the lesson's own IntroBody.
   * For the て-form these ARE the lesson's own PhaseIntro objects, so the
   * reference and the lesson cannot disagree; for a concept with no lesson to
   * reuse (verb classes, adjective types, keigo registers) they are authored here
   * in the identical voice, the single source for prose that has no second copy. */
  readonly cards: readonly PhaseIntro[];
}

// ---------------------------------------------------------------------------
// AUTHORED CONCEPT PAGES — for the concepts with no lesson to reuse.
//
// The verb-classes concept points at the lesson's own Verb Types page
// (VERB_TYPES_CONCEPT_PAGES), so it cannot drift from what lesson 1 teaches. The
// The adjective concept uses the lesson's shared class-identification page on
// its own. The old three-card conjugation appendix repeated that page and the
// form-specific grammar entries, turning a class reference into a wall of prose.
// Keigo is taught set by set,
// not as the register model, so its pages are authored here:
// kana-only examples (a learner meeting these has little kanji), a build/derive
// table where the change is worth seeing, and no em dashes. There is only ever one
// copy, here, so there is nothing to drift from.
// ---------------------------------------------------------------------------

/** The keigo-registers concept's pages: the three-register politeness model, from
 * the header of src/data/keigo.ts. Authored fresh; the Keigo shelf teaches the
 * specific verbs, this page is the why behind them. */
const KEIGO_REGISTER_CONCEPT_PAGES: readonly PhaseIntro[] = [
  {
    id: "gc-keigo-intro",
    setId: "",
    title: "Japanese has politeness levels.",
    body: [
      { text: "You can say the same thing at different levels of politeness, and Japanese has three registers for it." },
      { lead: "Polite (ていねい)", text: "is the neutral courteous layer, です and ます, the one everyone learns first." },
      { lead: "Honorific (そんけい) and humble (けんじょう)", text: "sit on top of it, and each swaps in a different verb depending on whose action it is." },
    ],
  },
  {
    id: "gc-keigo-honorific",
    setId: "",
    title: "Honorific raises the other person.",
    body: [
      { text: "The honorific register raises the person you are speaking about, to show respect for what they do. For their eating, たべる becomes めしあがる." },
      { text: "You use it for the other person's actions, never your own. Raising yourself would be the opposite of respectful." },
    ],
  },
  {
    id: "gc-keigo-humble",
    setId: "",
    title: "Humble lowers your own action.",
    body: [
      { text: "The humble register lowers your own action, to defer to the person you are speaking with. For your own eating, たべる becomes いただく." },
      { text: "You use it for what you do, so that the other person is left standing higher by comparison." },
    ],
  },
  {
    id: "gc-keigo-choice",
    setId: "",
    title: "Whose action it is decides which you use.",
    body: [
      { text: "So the choice is not about the verb, it is about whose action it is. Honorific for someone else, humble for yourself." },
      { text: "Getting this backwards is a real mistake, not just an awkward one: using a humble form for someone else's action lowers the very person you meant to raise." },
    ],
  },
];

/**
 * The grammar concepts.
 *
 * verb-classes points at lesson 1's own Verb Types page, so it cannot drift. The
 * other two are foundational ideas with no single lesson to reuse, authored here
 * in the same voice: adjective types and the keigo registers. The build mechanics
 * stay on the pattern (and form) entries themselves; these pages are the ideas.
 * The て-form used to have a concept page here; it was removed once the te-sequence
 * form recipe grew its own Library entry carrying the full teaching.
 */
export const GRAMMAR_CONCEPTS: readonly GrammarConcept[] = [
  {
    id: "verb-classes",
    name: "う-verbs and る-verbs",
    summary:
      "Every verb is one of two groups (with some exceptions), and the group decides how every form is built.",
    body: [
      "Japanese verbs fall into two groups, う-verbs and る-verbs, plus the two irregular verbs する and くる. A verb's group decides how every one of its forms is conjugated.",
      "An う-verb drops its last kana and adds the ending. An る-verb just drops its final る and adds the ending. A verb ending in る can be either group, so you learn each verb's group along with the verb.",
    ],
    searchAlso: [
      "verb classes",
      "verb groups",
      "u-verb",
      "ru-verb",
      "godan",
      "ichidan",
      "conjugation groups",
      "which group",
      "how verbs conjugate",
      "irregular verbs",
    ],
    related: [],
    cards: VERB_TYPES_CONCEPT_PAGES,
  },
  {
    id: "adjective-types",
    name: "い-adjectives and な-adjectives",
    summary:
      "い-adjectives conjugate themselves; な-adjectives take な and lean on です for tense and connection.",
    body: [
      "Japanese adjectives come in two kinds. い-adjectives usually end in い and conjugate themselves. な-adjectives have no reliable kana ending; the な in their name is what they add before a noun.",
      "Spelling is only a clue. Common な-adjectives such as きれい and きらい end in い, so an adjective's class is learned with the word.",
    ],
    searchAlso: [
      "adjective types",
      "i-adjective",
      "na-adjective",
      "adjectives",
      "kinds of adjective",
      "keiyoushi",
      "how adjectives conjugate",
    ],
    cards: ADJECTIVE_TYPES_CONCEPT_PAGES,
  },
  {
    id: "keigo-registers",
    name: "Keigo: the politeness levels",
    summary:
      "Three registers: polite, honorific for the other person, humble for yourself.",
    body: [
      "Japanese has politeness levels. There are three registers: polite (です and ます, the neutral courteous layer), honorific (which raises the other person's action), and humble (which lowers your own).",
      "Which one you reach for is decided by whose action it is: honorific for someone else, humble for yourself. Using a humble form for someone else lowers them, which is a real mistake.",
    ],
    searchAlso: [
      "keigo",
      "politeness levels",
      "registers",
      "honorific",
      "humble",
      "polite",
      "sonkeigo",
      "kenjougo",
      "teineigo",
    ],
    cards: KEIGO_REGISTER_CONCEPT_PAGES,
  },
];

const BY_ID: ReadonlyMap<string, GrammarConcept> = new Map(
  GRAMMAR_CONCEPTS.map((c) => [c.id, c]),
);

const BY_ENTRY: ReadonlyMap<EntryId, GrammarConcept> = new Map(
  GRAMMAR_CONCEPTS.map((c) => [grammarConceptEntry(c.id), c]),
);

/** The concept an entry id names, or undefined. A lookup, like every other id
 * resolution in the app — this never takes an id apart. */
export function grammarConceptFor(entry: EntryId): GrammarConcept | undefined {
  return BY_ENTRY.get(entry);
}

/** A concept by its short id — for tests and for anything holding the id. */
export function grammarConceptRow(id: string): GrammarConcept | undefined {
  return BY_ID.get(id);
}
