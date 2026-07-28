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
// `cards` points at the very PhaseIntro objects the te-form lesson teaches with
// (TE_FORM_CONCEPT_PAGES in src/data/grammar/lessons.ts): gl-te-intro "Grammar is
// how words fit together" and gl-te-use "The て/で-form links ideas, and the last
// verb sets the tense". The entry page renders those objects through the lesson's
// own IntroBody, so the concept page and the lesson say the same words and cannot
// drift. `summary` and `body` below are the small amount that is genuinely new:
// the one-line shelf note (and page sub-heading), and a short-answer fallback for
// a concept that ever ships with no card.

import { TE_FORM_CONCEPT_PAGES } from "@/data/grammar/lessons";
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
  /** The lesson's own concept pages, unmodified — the entry page renders these
   * through IntroBody, so the reference and the lesson cannot disagree. */
  readonly cards: readonly PhaseIntro[];
}

/**
 * The grammar concepts. One today: the て-form, in depth.
 *
 * Its two cards are the lesson's conceptual pages — what a form is, then て as a
 * connector and the last verb carrying the tense. The build mechanics stay on
 * the pattern entries themselves; this page is the idea.
 */
export const GRAMMAR_CONCEPTS: readonly GrammarConcept[] = [
  {
    id: "te-form",
    name: "The て-form, in depth",
    summary:
      "What a conjugation form is, how the て-form connects actions, and how the last verb sets the tense.",
    body: [
      "A conjugation form is a shape a verb takes to do a grammatical job. The て-form is the connecting shape: it joins one action or situation to the next.",
      "Depending on the sentence it reads as and, and then, so, because, or while, and the context tells you which. The て-form itself says nothing about when something happened or whether it is polite. The last verb in the chain does.",
    ],
    searchAlso: [
      "te-form",
      "te form",
      "connecting form",
      "connector",
      "conjugation form",
      "what is a form",
      "how verbs connect",
      "chaining actions",
    ],
    cards: TE_FORM_CONCEPT_PAGES,
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
