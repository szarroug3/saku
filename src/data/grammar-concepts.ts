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
// The て-form concept points at the lesson's own pages (TE_FORM_CONCEPT_PAGES),
// so it cannot drift from what the lesson teaches. The three concepts below have
// no single lesson that teaches the idea whole — verb classes govern EVERY
// conjugation, not one form; adjectives have no lesson yet; keigo is taught set
// by set, not as the register model. So their pages are authored here, in the
// same voice the lessons use: kana-only examples (a learner meeting these has
// little kanji), a build/derive table where the change is worth seeing, and no
// em dashes. There is only ever one copy, here, so there is nothing to drift
// from.
// ---------------------------------------------------------------------------

/** The verb-classes concept's pages: every verb is one of two groups (plus the
 * two irregulars), and the group decides how EVERY form is built. Generalised
 * from the て-form lesson's class pages beyond the て-form. */
const VERB_CLASS_CONCEPT_PAGES: readonly PhaseIntro[] = [
  {
    id: "gc-class-intro",
    setId: "",
    title: "A verb's group decides how it changes.",
    body: [
      { lead: "Japanese verbs change shape.", text: "Each verb belongs to one of two groups, and the group decides how every one of its shapes is built." },
      { text: "You learn this once and it pays off everywhere. The negative, the past, the て-form, the polite form: all of them follow from which group the verb is in." },
      { lead: "There are also two irregular verbs,", text: "する and くる, which follow no group and are learned by heart. Every other verb is one of the two groups." },
    ],
  },
  {
    id: "gc-class-u",
    setId: "",
    title: "う-verbs shift their last sound.",
    body: [
      { text: "The larger group is called う-verbs (you may also see them called godan). Their dictionary form ends in a う-row kana: う, く, ぐ, す, つ, ぬ, ぶ, む, or る." },
      { text: "To conjugate one, that last kana shifts across the five rows あ, い, う, え, お, and an ending is added. く becomes か, き, く, け, or こ depending on the form. The row you land on is set by the form you are building." },
      { text: "What each ending does is a separate topic. The point here is the last sound moving from one row to another." },
    ],
    buildRules: [
      { label: "あ row", verb: "かく", drop: "く", add: "かない" },
      { label: "い row", verb: "かく", drop: "く", add: "きます" },
      { label: "え row", verb: "かく", drop: "く", add: "けば" },
      { label: "お row", verb: "かく", drop: "く", add: "こう" },
    ],
    buildHeads: { label: "Row" },
  },
  {
    id: "gc-class-ru",
    setId: "",
    title: "る-verbs just drop る.",
    body: [
      { text: "The second group is called る-verbs (you may also see them called ichidan). These are simpler: drop the final る and add the ending straight on." },
      { text: "Nothing shifts across rows. The part before る stays the same in every form, so once you know one form you can see the rest." },
    ],
    buildRules: [
      { label: "negative", verb: "たべる", drop: "る", add: "ない" },
      { label: "polite", verb: "たべる", drop: "る", add: "ます" },
      { label: "て-form", verb: "たべる", drop: "る", add: "て" },
    ],
    buildHeads: { label: "Form" },
  },
  {
    id: "gc-class-which",
    setId: "",
    title: "A verb ending in る can belong to either group.",
    body: [
      { text: "The spelling alone does not tell you which group a る verb is in. かえる (to return) is an う-verb, so its negative is かえらない. たべる (to eat) is an る-verb, so its negative is たべない." },
      { text: "You learn each verb's group along with the verb, and the app tags it for you. With practice you will start to recognise which group a verb belongs to." },
    ],
    buildRules: [
      { label: "う-verb", verb: "かえる", to: "かえらない" },
      { label: "る-verb", verb: "たべる", to: "たべない" },
    ],
    buildHeads: { label: "Group" },
  },
  {
    id: "gc-class-irregular",
    setId: "",
    title: "する and くる follow no rule, so you learn them by heart.",
    body: [
      { text: "する (to do) and くる (to come) are the only two irregular verbs. They never follow the う-verb or る-verb rules, so every form is learned on its own rather than built from a group." },
      { text: "There are only two of them, and they are among the most common verbs you will meet, so they become familiar quickly." },
    ],
    buildRules: [
      { label: "polite", verb: "する", to: "します" },
      { label: "polite", verb: "くる", to: "きます" },
    ],
    buildHeads: { label: "Form" },
  },
];

/** The adjective-types concept's pages: Japanese has two kinds of adjective, and
 * which kind a word is decides whether it conjugates itself or leans on です.
 * Authored fresh, grounded in how the app conjugates adj-i vs adj-na. */
const ADJECTIVE_TYPE_CONCEPT_PAGES: readonly PhaseIntro[] = [
  {
    id: "gc-adj-intro",
    setId: "",
    title: "Adjectives come in two kinds.",
    body: [
      { lead: "い-adjectives", text: "end in い, like たかい (expensive) and やすい (cheap). They conjugate themselves: they carry their own negative, past, and て-form." },
      { lead: "な-adjectives", text: "do not conjugate, like しずか (quiet) and べんり (convenient). They take な before a noun and lean on です, だった, and で for tense and connection." },
      { text: "Which kind a word is decides everything that attaches to it, so you learn a word's kind along with the word." },
    ],
  },
  {
    id: "gc-adj-i",
    setId: "",
    title: "い-adjectives change their own ending.",
    body: [
      { text: "Drop the final い and add the ending. たかい becomes たかくない for the negative, たかかった for the past, and たかくて to connect to what follows." },
      { text: "So an い-adjective works a lot like a verb: the word itself carries the tense, with no です needed to make it grammatical." },
    ],
    buildRules: [
      { label: "negative", verb: "たかい", drop: "い", add: "くない" },
      { label: "past", verb: "たかい", drop: "い", add: "かった" },
      { label: "て-form", verb: "たかい", drop: "い", add: "くて" },
    ],
    buildHeads: { label: "Form" },
  },
  {
    id: "gc-adj-na",
    setId: "",
    title: "な-adjectives take な, and lean on です.",
    body: [
      { text: "A な-adjective does not change its own shape. Before a noun it takes な, as in しずかな へや (a quiet room)." },
      { text: "For tense and connection it borrows です, だった, and で, so しずかです is polite, しずかだった is past, and しずかで connects to what follows. The adjective itself stays しずか throughout." },
    ],
    buildRules: [
      { label: "before a noun", verb: "しずか", to: "しずかな へや" },
      { label: "polite", verb: "しずか", to: "しずかです" },
      { label: "past", verb: "しずか", to: "しずかだった" },
      { label: "connecting", verb: "しずか", to: "しずかで" },
    ],
    buildHeads: { label: "Use" },
  },
  {
    id: "gc-adj-exceptions",
    setId: "",
    title: "A few look like い but are な-adjectives.",
    body: [
      { text: "Most words ending in い are い-adjectives, but a handful are not. きれい (pretty, clean) and きらい (disliked) end in い and yet behave as な-adjectives: きれいな はな, きれいです." },
      { text: "There are only a few of these, so you learn them as exceptions. The app tags each word's kind, so you never have to guess." },
    ],
  },
];

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
 * The て-form points at the lesson's own conceptual pages (what a form is, then
 * て as a connector and the last verb carrying the tense), so it cannot drift.
 * The other three are foundational ideas with no single lesson to reuse, authored
 * here in the same voice: verb classes (which govern all conjugation), adjective
 * types, and the keigo registers. The build mechanics stay on the pattern entries
 * themselves; these pages are the ideas.
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
    related: ["verb-classes"],
    cards: TE_FORM_CONCEPT_PAGES,
  },
  {
    id: "verb-classes",
    name: "う-verbs and る-verbs",
    summary:
      "Every verb is one of two groups (plus two irregulars), and the group decides how every form is built.",
    body: [
      "Japanese verbs fall into two groups, う-verbs and る-verbs, plus the two irregular verbs する and くる. A verb's group decides how every one of its forms is conjugated.",
      "An う-verb's last kana shifts across the あ, い, う, え, お rows. An る-verb just drops its final る and adds the ending. A verb ending in る can be either group, so you learn each verb's group along with the verb.",
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
    related: ["te-form"],
    cards: VERB_CLASS_CONCEPT_PAGES,
  },
  {
    id: "adjective-types",
    name: "い-adjectives and な-adjectives",
    summary:
      "い-adjectives conjugate themselves; な-adjectives take な and lean on です for tense and connection.",
    body: [
      "Japanese adjectives come in two kinds. い-adjectives end in い and conjugate themselves: たかい becomes たかくない, たかかった, たかくて. な-adjectives do not conjugate: they take な before a noun and lean on です, だった, and で.",
      "Most words ending in い are い-adjectives, but a few common ones like きれい and きらい are な-adjectives despite ending in い, so they are learned as exceptions.",
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
    cards: ADJECTIVE_TYPE_CONCEPT_PAGES,
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
