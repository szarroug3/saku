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
}

export interface LessonStep {
  id: string;
  /** The pick this step belongs to: the word or row it is taught for. */
  pick: string;
  /** A page rather than a star: an intro to a track, a term, a sound
   * shift, read before the star it sits in front of. */
  page?: LessonPage;
}

/** A page in the order: what a track is, what a term means, how a mark
 * changes a sound. Plain text from whatever the route's adapter has. */
export interface LessonPage {
  /** The star this page comes before. */
  before: string;
  /** "Intro", "Term", "Sound shift": what kind of page, for the rail. */
  kind: string;
  title: string;
  body: readonly string[];
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
      for (const page of pages) if (page.before === id) steps.push({ id: `page:${page.kind}:${page.title}`, pick, page });
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
