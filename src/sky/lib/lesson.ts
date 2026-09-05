// The lesson's order and its locking, over the graph. Tracked as SAK-307.
//
// Tonight's picks are taught bottom up, per pick: the pieces a character
// needs, then the character, then the word (graph.orderOf). Anything
// already in the sky is not re-taught and never listed, and a piece two
// picks share is taught once, at its first use. A group (a kana row) is a
// place, not a step: its sounds are the steps.
//
// A step opens once the step before it has been opened (Sam's rule). Known
// prerequisites are open from the start, for reference, and opening one
// does not advance the lesson. Nothing dims when you move on: a star opened
// stays lit for the rest of the lesson.

import type { Learned, PrerequisiteGraph } from "./graph";

/** A line of prose with the runs spoken as the sound marked. */
export type SoundLine = ReadonlyArray<{ text: string; accent?: boolean }>;

/** What the card teaches for one star, in plain data from whatever the
 * route's adapter can find: nothing is required, and a sparse item stays
 * short. */
export interface LessonTeach {
  /** The reading shown beside the glyph: kana for a word, romaji for a kana. */
  reading?: string;
  /** Every meaning, the first being the name. */
  meanings?: readonly string[];
  /** The shape's story, for a kana or a piece: runs of text, the ones
   * spoken as the sound marked to be coloured. */
  story?: SoundLine;
  /** The say-it-like hook: "Sounds like the letter n." */
  hook?: SoundLine;
  /** The drawing that goes with the story, when there is one. */
  mnemonicImage?: string;
  /** A sound that changes with what follows it (ん): the summary and the rules. */
  headsUp?: { summary: string; rules: ReadonlyArray<{ when: string; sounds: string; example: string }> };
  /** A word the sound is heard in: "ほん hon · book". */
  exampleWord?: { word: string; reading: string; gloss: string };
  /** Anything else worth a line: a counter's role, a pair's two verbs, a
   * keigo set's words. Plain paragraphs. */
  notes?: readonly string[];
  /** Where the character comes from, for a kanji. */
  etymology?: string;
  /** A kanji's readings, on'yomi and kun'yomi, each with words it is read that way in. */
  readings?: ReadonlyArray<{ reading: string; kind: "on" | "kun"; words: readonly string[] }>;
  /** A word's kanji and how each is read in this word. */
  writtenWith?: ReadonlyArray<{ kanji: string; reading: string }>;
  /** An example sentence for a word. */
  example?: { jp: string; en: string };
  /** A word's pitch pattern, when known. */
  pitch?: number | null;
  /** How many strokes a character takes. */
  strokes?: number;
  /** A kanji's pieces and what each does in it: the one that lends its
   * sound, the one that gives the sense. Shown against the "Made of" stars. */
  parts?: ReadonlyArray<{ glyph: string; sense: string; role: "phonetic" | "semantic" | null }>;
  /** The shapes a radical takes inside other characters (氵 for 水), where
   * each sits and a kanji it is seen in. */
  variants?: ReadonlyArray<{ glyph: string; position: string; example?: string }>;
  /** Tables that fold closed under the card: a word's forms, grouped. */
  tables?: readonly TeachTable[];
  /** A star taught over several pages rather than one card (a sentence
   * rule: the intro, then a step per part). Next and Back walk the pages
   * before moving on to the next star. */
  pages?: readonly TeachPage[];
  /** Forms taught side by side: a verb pair's two verbs by their role, a
   * keigo set's polite words by register, each with what it is for. */
  forms?: readonly TeachForm[];
}

/** One form of a set: its role ("It happens on its own", "Honorific"),
 * a note on when it is used, the word with its reading and pitch, the
 * English it points to, and a sentence showing it. */
export interface TeachForm {
  role: string;
  note?: string;
  word: string;
  reading?: string;
  pitch?: number | null;
  /** The English sentence the form answers to: "The door opened." */
  sentence?: string;
  /** A Japanese sentence with the form marked. */
  example?: PartedSentence;
}

/** One page of a star's teaching. */
export interface TeachPage {
  /** "Intro", "Step 1": what the page is, for the eyebrow and the pager. */
  eyebrow?: string;
  title: string;
  /** The page's one sentence, set bold under the title: "A radical is a
   * piece other kanji are built out of." */
  lead?: string;
  /** The line to keep in mind, in the accent: "Think: who → what → action." */
  hook?: string;
  /** The page's prose: an optional heading over it, a bold lead, its text,
   * and a phrase of the text to pick out in the accent. */
  paragraphs: ReadonlyArray<TeachParagraph>;
  /** The build as a formula, for a grammar pattern: [て-form] + から. */
  formula?: TeachFormula;
  /** Tables: a form's build rules, a pattern's derivation, a family of
   * patterns side by side. */
  tables?: readonly TeachTable[];
  /** Prose after the tables. */
  after?: ReadonlyArray<TeachParagraph>;
  /** Worked examples, each in its renderings. */
  examples?: readonly TeachExample[];
  /** Somewhere to read more. */
  link?: { href: string; label: string };
}

export interface TeachParagraph { heading?: string; lead?: string; text: string; accent?: string }

/** A build formula: the form in a box, what is trimmed off it, what is
 * added. `label` names the case when a pattern branches ("Godan"). */
export interface TeachFormula { label?: string; base: string; add?: string; trim?: string }

/** A table of the teaching: headings, and rows of cells, each cell runs of
 * text with the part that matters marked (the piece a rule adds). */
export interface TeachTable {
  title?: string;
  instruction?: string;
  formula?: TeachFormula | readonly TeachFormula[];
  heads: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<SoundLine>>;
  /** A closing line: the chain the rows build toward, and its meaning. */
  footer?: string;
  /** A note under the table: how a family's members differ. */
  note?: string;
}

/** An example sentence: natural English, the Japanese, and for a sentence
 * rule the English in Japanese order between them, each with its parts
 * named. */
export interface TeachExample {
  natural: PartedSentence;
  ordered?: PartedSentence;
  japanese: PartedSentence;
}

/** A sentence as runs of text. A run with a label is one of the sentence's
 * parts ("Topic" over 私は); the part this page teaches is marked active.
 * Runs without a label are the text between parts. */
export type PartedSentence = ReadonlyArray<{ text: string; label?: string; active?: boolean }>;

export interface LessonStep {
  id: string;
  /** The pick this step belongs to: the word or row it is taught for. */
  pick: string;
  /** A page rather than a star: an intro to a track, a term, a sound
   * shift, read before the star it sits in front of. */
  page?: LessonPage;
}

/** A page in the order: what a track is, what a term means, how a mark
 * changes a sound. The same page shape a star's teaching uses, placed
 * before a star. */
export interface LessonPage {
  /** The star this page comes before. */
  before: string;
  /** "Intro", "Term", "Sound shift": what kind of page, for the rail. */
  kind: string;
  page: TeachPage;
}

const has = (learned: Learned, id: string) => (typeof learned === "function" ? learned(id) : learned.has(id));

/** Every step of the night, in teaching order: the stars, with any pages
 * slotted in front of the star each comes before (a page whose star is not
 * tonight's is dropped). A page's id is "page:" and its title. */
export function lessonSteps(graph: PrerequisiteGraph, picks: readonly string[], learned: Learned, pages: readonly LessonPage[] = []): LessonStep[] {
  const steps: LessonStep[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    for (const id of graph.orderOf(pick)) {
      if (seen.has(id) || has(learned, id) || graph.itemOf(id)?.group) continue;
      seen.add(id);
      for (const page of pages) if (page.before === id) steps.push({ id: `page:${page.kind}:${page.page.title}`, pick, page });
      steps.push({ id, pick });
    }
  }
  return steps;
}

export type StarState = "locked" | "open" | "lit" | "selected";

/** The state of one star tonight, given which have been opened and which is
 * showing. A star not in the steps (already in the sky) is open, or lit once
 * it has been looked at. */
export function starState(steps: readonly LessonStep[], id: string, opened: ReadonlySet<string>, selected: string | null): StarState {
  if (id === selected) return "selected";
  if (opened.has(id)) return "lit";
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0) return "open";
  return isUnlocked(steps, i, opened) ? "open" : "locked";
}

/** A step is unlocked when it is first, or the step before it has been opened. */
export function isUnlocked(steps: readonly LessonStep[], index: number, opened: ReadonlySet<string>): boolean {
  return index === 0 || opened.has(steps[index - 1].id);
}
