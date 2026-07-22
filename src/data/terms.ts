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

  // ⚠️ DRAFT — OWNER VOICE PASS PENDING (second batch) ⚠️
  // ====================================================
  // The ten entries below fill the rest of the jargon the app puts on screen
  // before it defines it: the writing marks (dakuten, handakuten, yōon), the two
  // ways kana attach to words (okurigana, rendaku), and the grammar words the
  // later tracks lean on (counter, particle, keigo, pitch accent, mora). Same
  // rules as the block above: every summary and body is a DRAFT in the owner's
  // plain register, facts kept minimal and uncontroversial, nothing invented.
  {
    id: "dakuten",
    name: "Dakuten",
    summary: "The two small strokes that voice a kana, turning か into が.",
    body: [
      "A dakuten is the pair of short strokes added at a kana's top right. It switches the sound to its voiced partner, so か “ka” becomes が “ga” and さ “sa” becomes ざ “za”.",
      "The same mark works across the k, s, t and h rows.",
    ],
    searchAlso: ["dakuten", "voicing mark", "ten ten", "tenten"],
  },
  {
    id: "handakuten",
    name: "Handakuten",
    summary: "The small circle that turns the は row into p sounds.",
    body: [
      "A handakuten is the little circle added at a kana's top right. It only goes on the は row, and it makes a p sound, so は “ha” becomes ぱ “pa”.",
      "It is the mark that gives you ぱ, ぴ, ぷ, ぺ and ぽ.",
    ],
    searchAlso: ["handakuten", "maru", "circle mark", "p sound"],
  },
  {
    id: "yoon",
    name: "Yōon",
    summary: "A small や, ゆ or よ joined to an i row kana, like きゃ.",
    body: [
      "A yōon is a small や, ゆ or よ written after a kana from the i row, such as き, so the two form one blended sound. き plus a small ゃ gives きゃ “kya”, said as a single beat.",
      "The small kana is written at half size, which is what tells you to blend the two rather than say them one after the other.",
    ],
    searchAlso: ["yoon", "youon", "yōon", "combo", "combination", "contracted sound", "small ya yu yo"],
  },
  {
    id: "okurigana",
    name: "Okurigana",
    summary: "The kana tail written after a kanji, like the る in 見る.",
    body: [
      "Okurigana are the kana written after a kanji to finish a word and show its ending. In 見る “to see”, the kanji 見 carries the meaning and the okurigana る is the part that changes when the word does.",
      "They are how a verb or adjective shows its grammar while the kanji stays fixed.",
    ],
    searchAlso: ["okurigana", "kana tail", "kana ending"],
  },
  {
    id: "rendaku",
    name: "Rendaku",
    summary: "Voicing that appears when two words join, like て plus かみ giving てがみ.",
    body: [
      "Rendaku is the way the start of a second word often turns voiced when two words join into one. て plus かみ “paper” becomes てがみ “letter”, with the か “ka” shifting to が “ga”.",
      "It does not happen every time, but it is common enough that a joined word sounding voiced is usually this.",
    ],
    searchAlso: ["rendaku", "sequential voicing"],
  },
  {
    id: "counter",
    name: "Counter",
    summary: "A word added to a number to count a kind of thing, like 本 or 人.",
    body: [
      "A counter is a small word placed after a number to say what is being counted. Japanese picks the counter to match the thing, so 本 counts long thin objects and 人 counts people.",
      "Which counter to use depends on the kind of thing, and a few of them change the number's sound as well.",
    ],
    searchAlso: ["counter", "counters", "counter word", "measure word", "josuushi"],
  },
  {
    id: "particle",
    name: "Particle",
    summary: "A small word that marks another word's job in the sentence, like は, を or へ.",
    body: [
      "A particle is a short word placed after another word to show what job it is doing. は marks the topic, を marks the object, and へ points toward a direction.",
      "They are how Japanese keeps track of who did what, in place of relying on word order.",
    ],
    searchAlso: ["particle", "particles", "joshi"],
  },
  {
    id: "keigo",
    name: "Keigo",
    summary: "Polite Japanese, split into honorific language and humble language.",
    body: [
      "Keigo is the polite speech used to show respect. It comes in two registers: honorific language, which raises the person you are speaking about, and humble language, which lowers yourself to the same effect.",
      "Choosing between them turns on who is doing the action, you or the other person.",
    ],
    searchAlso: ["keigo", "honorific", "humble", "sonkeigo", "kenjougo", "kenjogo", "polite speech", "politeness"],
  },
  {
    id: "pitch-accent",
    name: "Pitch accent",
    summary: "The rise and fall in a word that can tell two look-alike words apart.",
    body: [
      "Pitch accent is the pattern of higher and lower sound across a word. Some words are told apart by it alone: 箸 “chopsticks” and 橋 “bridge” are both “hashi”, and only the pitch says which one is meant.",
      "The line drawn over a reading shows where the voice stays high and where it drops.",
    ],
    searchAlso: ["pitch accent", "pitch", "accent", "downstep", "heiban", "atamadaka"],
  },
  {
    id: "mora",
    name: "Mora",
    summary: "A unit of timing, the single beat that most kana take.",
    body: [
      "A mora is the beat of sound each kana takes, so a word's length is counted in these beats rather than in syllables. Most kana are one mora, and ん and a small っ each count as a mora of their own even though they are not full syllables.",
      "It is the even timing of these beats that gives spoken Japanese its steady pace.",
    ],
    searchAlso: ["mora", "morae", "beat", "timing unit"],
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
