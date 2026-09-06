// The quiz's model: a card per question, in plain data from whatever the
// route's adapter can build, and the three grades an answer can earn.
// Tracked as SAK-312 to SAK-317.
//
// Every card opens on a blank box (SAK-313), or on its choices when that is
// all it is ever asked by. A right answer moves straight on; a wrong one
// gets more tries (MAX_TRIES in all; one only on a card of two choices)
// before the card is missed. Help is there to ask for: the choices, a
// hint. Three grades (Sam, 2026-09-05; the old "nearly" went, since ka for
// ki is not a slip): perfect (right, first try, nothing asked for), with
// help (right after a retry, a hint or asking for the choices), missed
// (wrong after the last try, or given up). Opening on choices is not help.
// Cards can be skipped and come back to; the grades are per card.

import type { LessonTeach } from "./lesson";
import type { SkyItem } from "./types";

export type Grade = "clean" | "help" | "missed";

export const GRADES: readonly Grade[] = ["clean", "help", "missed"];

/** How many goes a card gets before it is missed: two retries. */
/** Retries after a first wrong answer, until the learner changes it on the
 * quiz itself (Sam, 2026-09-06: the one home for a setting is where you
 * would change it). Tries in all are one more than this. */
export const DEFAULT_RETRIES = 2;

/** What each grade means, and what it does to the schedule. */
export const GRADE: Record<Grade, { label: string; meaning: string; consequence: string }> = {
  clean: { label: "Perfect", meaning: "You got it right without any help.", consequence: "Recalled cold: the interval stretches furthest." },
  help: { label: "With help", meaning: "You got it after a retry, hint, or multiple choice.", consequence: "Counted as weaker than perfect: it comes back sooner." },
  missed: { label: "Missed", meaning: "You ran out of tries, or gave it up.", consequence: "Back tomorrow, and its look-alike comes with it." },
};

/** One choice in the narrowed set. */
export interface QuizOption {
  id: string;
  label: string;
  /** The label is Japanese, for its font. */
  jp: boolean;
  /** The label is a reading to draw with this pitch (the mora the voice
   * falls after; 0 for none): a card asking which pitch is right. */
  pitch?: number;
}

/** One question. */
export interface QuizCard {
  /** The fact asked about: the card's id. */
  id: string;
  /** The thing it is a fact of, for the reveal's head and the strip. */
  item: SkyItem;
  /** The big thing on the card, and the line that makes it answerable.
   * `within` is a word the glyph is asked inside (a kanji's reading in
   * 統一): the card draws the word with the glyph in ink and the rest
   * muted. */
  prompt: { glyph: string; jp: boolean; context?: string; within?: string };
  /** What to do, in the app's words: "Type the reading in romaji." */
  instruction?: string;
  /** A nudge, shown on request: a line, or a drawing. */
  hint?: { text?: string; image?: string };
  /** What kind of answer is wanted, for the box's placeholder. */
  answerIs: "reading" | "meaning" | "other";
  /** Opens on the box; false opens on the options (a card only ever asked
   * by recognition). */
  typed: boolean;
  /** The narrowed set, the answer among them, shuffled. */
  options: readonly QuizOption[];
  answerId: string;
  /** The answer as the reveal shows it. */
  answer: string;
  /** The answer is a reading to draw with this pitch (a pitch card). */
  answerPitch?: number;
  /** A listening card (SAK-345): what is played, in kana, with the glyph
   * and its context hidden until the card is answered or a hint asked. */
  listen?: string;
  /** A sentence-ordering card (SAK-346): the pieces to put in order, shuffled,
   * and the one order that is right. The prompt is the English. */
  order?: { pieces: readonly string[]; answer: readonly string[] };
  /** How many times this fact has been seen, and missed, before tonight. */
  seen: number;
  missed: number;
  /** What the reveal teaches: the card under the sky. */
  teach?: LessonTeach;
  /** Something the adapter wants back with the answer (the direction asked). */
  meta?: Readonly<Record<string, string>>;
}

/** What the learner did with one card. */
export interface QuizAnswer {
  cardId: string;
  grade: Grade;
  /** The card's own notes for the recorder, carried back with the answer. */
  meta?: Readonly<Record<string, string>>;
  /** What was typed, when something was. */
  given?: string;
  /** Attempts it took: 1 for a perfect answer. */
  tries: number;
  /** The choices were shown before the answer landed. */
  narrowed: boolean;
  /** A hint was shown. */
  hinted: boolean;
}

/** The grade for a right answer: perfect only when nothing helped it
 * along, no retry, no hint, no asking for the choices. */
export function gradeFor(helped: boolean): Grade {
  return helped ? "help" : "clean";
}

/** The three counts. */
export function tally(answers: readonly QuizAnswer[]): Record<Grade, number> {
  const out: Record<Grade, number> = { clean: 0, help: 0, missed: 0 };
  for (const a of answers) out[a.grade]++;
  return out;
}
