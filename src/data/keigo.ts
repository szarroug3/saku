// The keigo (politeness) TRACK — the honorific and humble verbs, taught as sets
// against the plain verb they replace.
//
// WHAT KEIGO IS, IN ONE PARAGRAPH
// ===============================
// Japanese changes the SHAPE of a verb by who you are speaking to and about.
// There are three registers. POLITE (です/ます) is the neutral courteous layer
// and is taught by the grammar track already. HONORIFIC raises the other person:
// you use it for what THEY do, to show respect — 食べる becomes 召し上がる.
// HUMBLE lowers yourself: you use it for what YOU do, to defer — 食べる becomes
// いただく. Same action, three ways to say it, and which one you reach for is
// decided entirely by whose action it is. This file carries the honorific and
// humble sets; the polite layer is not re-taught here.
//
// WHY THIS IS HAND-CURATED, AND WHY THE BAR IS ABSOLUTE
// ====================================================
// A wrong pairing teaches a false belief that is worse than not knowing: calling
// いただく the honorific when it is the humble form would have a learner lower
// the person they meant to raise. So every row below is one of the small,
// well-established core sets, checked against a reference, and nothing uncertain
// is shipped. The set is intentionally small.
//
// RECOGNITION FIRST (owner's ruling, task 12)
// ===========================================
// The track opens EARLY, the way grammar opens on known words: as soon as the
// learner knows the plain verb a set replaces, they meet its keigo forms and are
// asked to RECOGNISE them — shown 召し上がる, pick "eat / drink (honorific)". They
// are never asked to PRODUCE a keigo form (shown a situation, type the verb) at
// this stage; production rides in later on the same track. So every fact this
// file mints is a recognition fact: the glyph is the keigo verb, the answer is
// what it means and which register it is. See src/lib/engine/question.ts for how
// it is asked (multiple choice, jp→en only) and src/lib/keigo-lesson.ts for the
// early, per-set gate.
//
// WHAT ALREADY EXISTS, AND WHAT WAS ADDED
// =======================================
// Most of these verbs are already in the vocabulary as isolated words with the
// relationship stripped out — this track is what puts the relationship back.
// One core verb was MISSING from the dictionary cut and was added by hand:
// いらっしゃる (the honorific of 行く / 来る / いる). See the SUPPLEMENT in
// src/data/vocab.ts.

import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

/**
 * The subject every keigo fact carries. Unlike the counters track (which is
 * `word` with a label), keigo is its OWN subject: what it asks — "which register
 * is this verb, and of what plain verb" — is a relationship, not a vocabulary
 * meaning, and it needs its own question shape and its own distractors (the
 * same-action opposite register). This is the transitivity model, not the
 * counters one.
 */
export const KEIGO_SUBJECT = "keigo";

/**
 * The two registers this track teaches.
 *
 *   honorific — raises the OTHER person. Used for what they do. 召し上がる.
 *   humble    — lowers YOURSELF. Used for what you do. いただく.
 *
 * The words "honorific" and "humble" are introduced to the learner by the track
 * intro card (src/data/track-intros.ts) — they are not assumed known.
 */
export type Register = "honorific" | "humble";

/** A plain verb a set replaces — the everyday word the learner already knows.
 * `keb` is its written form as the vocabulary carries it, which is also the gate:
 * the set opens once this word is learned. */
export interface PlainVerb {
  readonly keb: string;
  readonly reading: string;
}

/** One keigo verb — a single askable recognition item. */
export interface KeigoWord {
  /** The entry-key seed for this word's fact, namespaced so it can never collide
   * with a real vocabulary id. */
  readonly key: string;
  /** What it looks like on screen — 召し上がる, いただく. */
  readonly word: string;
  /** Its reading in kana. */
  readonly reading: string;
  /** Which register it is. */
  readonly register: Register;
  /**
   * A short label that tells this form apart from another in the SAME register,
   * set only when a set carries more than one (言う has two humbles, 参る/おる
   * split by meaning, not politeness). Reads as a suffix on the box role —
   * "Humble · going or coming" — and feeds the set's closing note. Absent when a
   * register has just one form, where "for what you do" already says it all.
   */
  readonly use?: string;
}

/**
 * One keigo SET: a plain verb (or verbs) and the honorific and humble forms that
 * replace it. This is the unit the learner meets and the entry the Library
 * shelves — the whole relationship in one place, the way a transitivity pair is.
 *
 * A set may be missing a side (くれる has an honorific but no humble; もらう has a
 * humble but no honorific), and may carry more than one word on a side (言う has
 * two humble forms). Whatever is present is what gets taught.
 */
export interface KeigoSet {
  /** A stable id, the entry-key seed. */
  readonly id: string;
  /** The shared action, in plain English — the answer's non-register half.
   * "eat / drink", "say", "go / come / be". */
  readonly meaning: string;
  /** The plain verbs this set replaces. The set opens once ANY of them is
   * learned. Empty for the formulaic phrase, which has no plain verb. */
  readonly plain: readonly PlainVerb[];
  /** Every keigo word in the set, each tagged with its register. */
  readonly words: readonly KeigoWord[];
  /**
   * The written forms whose being-learned opens this set. Defaults to the plain
   * verbs' kebs; carried explicitly only for the formulaic phrase, which has no
   * plain verb of its own but belongs beside the go / come / be family.
   */
  readonly gate: readonly string[];
  /**
   * A set phrase rather than a verb with a plain partner — いらっしゃいませ. Its
   * recognition question asks only what it MEANS (there is no plain "eat" to
   * contrast a register against), so its gloss carries no "(honorific)" tag and
   * its distractors come from other sets. Absent (false) for every verb set.
   */
  readonly formulaic?: boolean;
}

function plain(keb: string, reading: string): PlainVerb {
  return { keb, reading };
}

function honorific(key: string, word: string, reading: string): KeigoWord {
  return { key, word, reading, register: "honorific" };
}

function humble(key: string, word: string, reading: string, use?: string): KeigoWord {
  return { key, word, reading, register: "humble", ...(use ? { use } : {}) };
}

/**
 * THE PINNED TABLE. Each row is a set the owner verifies against a reference
 * before merge; keigo.test.ts pins every plain→honorific→humble mapping so a
 * future edit cannot silently corrupt a pairing.
 *
 * The order is teaching order: the eat / drink pair leads because 召し上がる /
 * いただく is the canonical honorific-vs-humble contrast, and the formulaic
 * greeting trails at the end.
 */
export const KEIGO_SETS: readonly KeigoSet[] = [
  {
    id: "eat",
    meaning: "eat / drink",
    plain: [plain("食べる", "たべる"), plain("飲む", "のむ")],
    words: [
      honorific("meshiagaru", "召し上がる", "めしあがる"),
      humble("itadaku_eat", "いただく", "いただく"),
    ],
    gate: ["食べる", "飲む"],
  },
  {
    id: "say",
    meaning: "say",
    plain: [plain("言う", "いう")],
    words: [
      honorific("ossharu", "おっしゃる", "おっしゃる"),
      humble("mousu", "申す", "もうす", "everyday"),
      humble("moushiageru", "申し上げる", "もうしあげる", "more deferential"),
    ],
    gate: ["言う"],
  },
  {
    id: "do",
    meaning: "do",
    plain: [plain("する", "する")],
    words: [
      honorific("nasaru", "なさる", "なさる"),
      humble("itasu", "いたす", "いたす"),
    ],
    gate: ["する"],
  },
  {
    id: "go-come-be",
    meaning: "go / come / be",
    plain: [plain("行く", "いく"), plain("来る", "くる"), plain("いる", "いる")],
    words: [
      honorific("irassharu", "いらっしゃる", "いらっしゃる"),
      humble("mairu", "参る", "まいる", "going or coming"),
      humble("oru", "おる", "おる", "being somewhere"),
    ],
    gate: ["行く", "来る", "いる"],
  },
  {
    id: "see",
    meaning: "see / look at",
    plain: [plain("見る", "みる")],
    words: [
      honorific("goran_ni_naru", "ご覧になる", "ごらんになる"),
      humble("haiken_suru", "拝見する", "はいけんする"),
    ],
    gate: ["見る"],
  },
  {
    id: "give-me",
    meaning: "give (to me)",
    plain: [plain("くれる", "くれる")],
    words: [honorific("kudasaru", "くださる", "くださる")],
    gate: ["くれる"],
  },
  {
    id: "receive",
    meaning: "receive",
    plain: [plain("もらう", "もらう")],
    words: [humble("itadaku_receive", "いただく", "いただく")],
    gate: ["もらう"],
  },
  {
    id: "know",
    meaning: "know",
    plain: [plain("知る", "しる")],
    words: [
      honorific("gozonji", "ご存知だ", "ごぞんじだ"),
      humble("zonjiru", "存じる", "ぞんじる", "for a fact"),
      humble("zonjiageru", "存じ上げる", "ぞんじあげる", "for a person"),
    ],
    gate: ["知る"],
  },
  {
    id: "welcome",
    meaning: "welcome (a shop's greeting to a customer)",
    plain: [],
    words: [honorific("irasshaimase", "いらっしゃいませ", "いらっしゃいませ")],
    gate: ["行く", "来る", "いる"],
    formulaic: true,
  },
];

/** The entry a set's facts hang off — one entry per set, so the whole set is one
 * Library page and one teach card. */
export function keigoSetEntry(set: KeigoSet): EntryId {
  return entryId(KEIGO_SUBJECT, set.id);
}

/** One keigo word's recognition fact id. */
export function keigoWordFactId(set: KeigoSet, word: KeigoWord): FactId {
  return factId(keigoSetEntry(set), word.key);
}

/**
 * What a recognition question asks the learner to pick — the action, plus the
 * register in parentheses for a verb set. 召し上がる → "eat / drink (honorific)".
 * A formulaic phrase carries no register tag: いらっしゃいませ → "welcome (…)".
 * This is the fact's answer AND its option label, so the honorific and humble
 * forms of one set read as the same action with opposite tags — which is exactly
 * the contrast the item tests.
 */
export function recognitionGloss(set: KeigoSet, word: KeigoWord): string {
  return set.formulaic ? set.meaning : `${set.meaning} (${word.register})`;
}

/** Everything the question layer needs to ask a keigo fact without parsing its
 * id — the lookup-not-parse rule the fact registry is built on. */
export interface KeigoWordInfo {
  readonly set: KeigoSet;
  readonly word: KeigoWord;
  /** The recognition gloss — the answer, and this fact's meaning. */
  readonly gloss: string;
}

const INFO_BY_FACT = new Map<FactId, KeigoWordInfo>();
const SET_BY_ENTRY = new Map<EntryId, KeigoSet>();

/** Every keigo recognition fact — one per keigo word across every set. */
export const KEIGO_FACTS: FactInfo[] = buildKeigoFacts();

function buildKeigoFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const set of KEIGO_SETS) {
    const entry = keigoSetEntry(set);
    SET_BY_ENTRY.set(entry, set);
    for (const word of set.words) {
      const id = keigoWordFactId(set, word);
      const gloss = recognitionGloss(set, word);
      INFO_BY_FACT.set(id, { set, word, gloss });
      facts.push({
        id,
        entry,
        glyph: word.word,
        answers: [gloss],
        subject: KEIGO_SUBJECT,
        meaning: gloss,
      });
    }
  }
  return facts;
}

/** What a keigo fact asks, or undefined for a non-keigo id. A lookup, never a
 * parse. */
export function keigoWordInfo(fact: FactId): KeigoWordInfo | undefined {
  return INFO_BY_FACT.get(fact);
}

/** The set an entry belongs to, or undefined — for the teach card and the
 * Library page, which show the whole set rather than one word. */
export function keigoSetForEntry(entry: EntryId): KeigoSet | undefined {
  return SET_BY_ENTRY.get(entry);
}

/**
 * Plausible wrong answers for a recognition fact, in preference order.
 *
 * The SHARPEST distractor is the same set's OPPOSITE register — 召し上がる's board
 * offers いただく's gloss "eat / drink (humble)", so the learner cannot pass
 * without knowing which register 召し上がる is. That is the whole skill. After it,
 * words from OTHER sets fill the board. A fact whose gloss EQUALS the asked one
 * is never offered: 申す and 申し上げる are both "say (humble)", so putting one
 * opposite the other would be a second right answer. The asked fact is excluded
 * too. The engine slices this to the board size and drops any the data no longer
 * has.
 */
export function keigoDistractors(fact: FactId): FactId[] {
  const asked = INFO_BY_FACT.get(fact);
  if (!asked) return [];
  const sameSetOpposite: FactId[] = [];
  const otherSets: FactId[] = [];
  for (const [id, info] of INFO_BY_FACT) {
    if (id === fact) continue;
    if (info.gloss === asked.gloss) continue;
    if (info.set.id === asked.set.id) sameSetOpposite.push(id);
    else otherSets.push(id);
  }
  return [...sameSetOpposite, ...otherSets];
}

/**
 * The TRACK LABEL: every entry that belongs to the keigo track. src/lib/track-open.ts
 * reads it to route these to the keigo track intro and to count the track as
 * started, the same mechanism the counters track uses (COUNTER_ENTRIES).
 */
export const KEIGO_ENTRIES: ReadonlySet<EntryId> = new Set(
  KEIGO_SETS.map(keigoSetEntry),
);
