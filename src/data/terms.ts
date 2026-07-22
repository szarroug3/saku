// TERMS — the words this app uses before it teaches them.
//
// THE HOLE THIS FILLS
// ===================
// A beginner probe found jargon the app leans on with no page to look it up:
// "JLPT" sits on Settings and Progress, "furigana" on Resources, and the names
// of the scripts themselves — hiragana, katakana, kana, romaji, kanji, radical —
// turn up all over before anything defines them. The track intros (see
// src/data/track-intros.ts) reach most of these, but some live on surfaces a
// track intro never opens. So each gets a Library entry: a short reference page
// that says what the word means, the same way a mark's page says what a reading
// rule does.
//
// NOT A MARK, AND ON ITS OWN SHELF
// ================================
// A mark (src/data/marks.ts) is a READING RULE — ゛ voices a consonant, っ
// doubles one. "JLPT" is a test and "hiragana" is a script; neither is a rule
// about how a character is read, so they do not belong on the Writing rules
// shelf. They are their own kind, "Terms", parked at the end of the Library
// beside the other reference shelves. The shape is a mark's, though: no glyph
// (the entry's title is its NAME), no facts (nothing here is gradeable — "what
// is JLPT" has no answer to mark), and a body of plain prose.
//
// ⚠️ THE COPY IS DRAFT — OWNER VOICE PASS PENDING ⚠️
// =================================================
// Every `summary` and `body` string below is a DRAFT in the owner's plain
// register, written for her to revise. Facts are kept minimal and deliberately
// uncontroversial; nothing here invents a Japanese detail. If a definition
// firmed up any further it risked stating something the owner had not checked,
// so where a word has more to it than one honest paragraph, this says the honest
// paragraph and stops.

import { entryId } from "@/lib/fact-id";
import type { EntryId } from "@/types";

/** The subject id, in the same shape as KANA_SUBJECT / MARK_SUBJECT. It is also
 * the URL kind segment (/library/term/jlpt) and the shelf's id. */
export const TERM_SUBJECT = "term";

/** Mint a term's entry id. The ONLY place a term id is constructed; everything
 * downstream resolves it by lookup, never by taking the id apart. */
export function termEntry(id: string): EntryId {
  return entryId(TERM_SUBJECT, id);
}

/** One reference definition. */
export interface Term {
  /** Stable id — the URL slug, the React key, and what a test names. */
  readonly id: string;
  /** What it is CALLED. This is the entry's title; a term has no glyph. */
  readonly name: string;
  /** One line, for the shelf row and the entry page's sub-heading. */
  readonly summary: string;
  /**
   * The definition, as paragraphs — two or three sentences in total.
   *
   * IN THE OWNER'S VOICE (draft). Kept to what is plainly true so a voice pass
   * is the only thing left to do, not a fact check.
   */
  readonly body: readonly string[];
  /** What someone might TYPE to find this beyond its name — the jargon and
   * spellings other resources use. Search matches an alias exactly. */
  readonly searchAlso?: readonly string[];
}

/**
 * The reference terms, in a gentle learning order: the scripts first (the
 * umbrella, then each script, then the Latin-letter fallback), then kanji and
 * the parts kanji are built from, then the two words that name a surface rather
 * than a script — furigana and JLPT.
 */
export const TERMS: readonly Term[] = [
  {
    id: "kana",
    name: "Kana",
    summary: "The two Japanese sound scripts, hiragana and katakana, together.",
    body: [
      "Kana is the name for Japanese's two sound-based scripts together, hiragana and katakana.",
      "Each kana stands for a sound rather than a meaning, and between them they can spell any Japanese word.",
    ],
    searchAlso: ["kana", "syllabary", "syllabaries"],
  },
  {
    id: "hiragana",
    name: "Hiragana",
    summary: "The rounded kana, used for Japanese words and grammar.",
    body: [
      "Hiragana is one of the two kana scripts. Its shapes are rounded and flowing.",
      "It is used to write native Japanese words, word endings and grammar, and it is usually the first writing a learner picks up.",
    ],
    searchAlso: ["hiragana"],
  },
  {
    id: "katakana",
    name: "Katakana",
    summary: "The angular kana, used mostly for borrowed words.",
    body: [
      "Katakana is the other kana script. Its shapes are sharp and angular.",
      "It is used mostly for words borrowed from other languages, foreign names, and sometimes for emphasis. It stands for the same set of sounds as hiragana.",
    ],
    searchAlso: ["katakana"],
  },
  {
    id: "romaji",
    name: "Romaji",
    summary: "Japanese written in the Latin letters used for English.",
    body: [
      "Romaji is Japanese written out in the Latin letters used for English, like “sushi” for すし.",
      "It is a way in for people who cannot yet read kana. There is more than one system for spelling it, so the same word can turn up written more than one way.",
    ],
    searchAlso: ["romaji", "rōmaji", "roman letters", "romanization", "romanisation"],
  },
  {
    id: "kanji",
    name: "Kanji",
    summary: "Characters borrowed from Chinese, each carrying a meaning.",
    body: [
      "Kanji are the characters Japanese borrowed from Chinese. Each one carries a meaning, and usually has more than one reading depending on the word it sits in.",
      "Ordinary Japanese writing mixes kanji with kana.",
    ],
    searchAlso: ["kanji", "chinese characters", "han characters"],
  },
  {
    id: "radical",
    name: "Radical",
    summary: "A building block that kanji are made from and filed under.",
    body: [
      "A radical is one of the recurring parts that kanji are built from.",
      "Dictionaries file each kanji under one of its radicals, which is how you look a character up by its shape. Learning the common radicals makes a new kanji easier to break down.",
    ],
    searchAlso: ["radical", "radicals", "bushu", "kanji parts"],
  },
  {
    id: "furigana",
    name: "Furigana",
    summary: "Small kana printed next to a kanji to show how it is read.",
    body: [
      "Furigana are the small kana written above or beside a kanji to show its reading.",
      "They are there to help a reader who does not yet know the kanji, so you see them most in books for learners and in writing for children.",
    ],
    searchAlso: ["furigana", "reading aid", "ruby"],
  },
  {
    id: "jlpt",
    name: "JLPT",
    summary: "A standard test of Japanese, graded N5 (easiest) to N1 (hardest).",
    body: [
      "JLPT stands for the Japanese-Language Proficiency Test. It sorts Japanese into five levels, from N5 for beginners up to N1 for the most advanced.",
      "This app tags its grammar patterns with those levels, so you can tell roughly how hard each one is.",
    ],
    searchAlso: ["jlpt", "proficiency test", "n5", "n4", "n3", "n2", "n1"],
  },
];

const BY_ID: ReadonlyMap<string, Term> = new Map(TERMS.map((t) => [t.id, t]));

const BY_ENTRY: ReadonlyMap<EntryId, Term> = new Map(
  TERMS.map((t) => [termEntry(t.id), t]),
);

/** The term an entry id names, or undefined. A lookup, like every other id
 * resolution in the app — this never takes an id apart. */
export function termFor(entry: EntryId): Term | undefined {
  return BY_ENTRY.get(entry);
}

/** A term by its short id — for tests and for anything holding the id itself. */
export function termRow(id: string): Term | undefined {
  return BY_ID.get(id);
}
