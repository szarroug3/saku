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

import { shuffled } from "./random";
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
  /** The box turns romaji into kana as it is typed, in this script, because
   * the answer is Japanese. Absent when the answer is not: a kana card is
   * the whole of that case, since ROMAJI is what it asks you for ("a" for
   * あ). Sam, 2026-09-06: nothing but kana should ever ask for romaji. */
  answerInKana?: "hiragana" | "katakana";
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
  /** What answers this card, as data, so the grader needs nothing but the
   * card (SAK-380). The adapter fills it in; the Sky never reads it. */
  key?: AnswerKey;
}

/** What answers a card, as data.
 *
 * A copy of the app's `src/lib/answer-key.ts`, kept here because the Sky owns
 * its card model and does not import the app (see src/sky/README.md). The
 * app's own type is the one with the rules written on it; the two are held
 * together by a test, the way `standing.ts` is.
 *
 * The Sky itself never looks inside: the route hands in a grader, and this is
 * only here so a card can carry its answer across the wire. */
export interface AnswerKey {
  /** Accepted by raw equality after a trim, nothing forgiven. */
  strict?: readonly string[];
  /** Japanese to produce: exact, or a romaji spelling when it is all kana. */
  produce?: readonly string[];
  /** Accepted once case and spacing are normalised. Stored normalised. */
  loose?: readonly string[];
  /** As `loose`, and additionally within a typo or two. Stored normalised. */
  typo?: readonly string[];
  /** A count as digits, with full-width digits folded before comparing. */
  digits?: string;
}

/** What the learner did with one card. */
export interface QuizAnswer {
  cardId: string;
  grade: Grade;
  /** The card's own notes for the recorder, carried back with the answer. */
  meta?: Readonly<Record<string, string>>;
  /**
   * Everything tried on this card, in order (SAK-387).
   *
   * A list, not the last guess: missing a card twice used to show only the
   * second one, so the two things that were confused could not both be seen,
   * which is the whole point of the line. A typed attempt is what was typed,
   * a picked one is the choice's label, an ordering one is the pieces as
   * placed.
   */
  said?: readonly string[];
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

/** How far ahead the spread looks for a card to trade with, so a deck of
 * one item does not walk the whole list per clash. */
const REACH = 8;

/** The deck in a random order, with a word's own cards moved apart
 * (SAK-388). Two things, because a plain shuffle only fixes one of them:
 * the deck was asked in the order the facts came out of the tables, and a
 * word's meaning and its reading sitting back to back means the second is
 * answered off the first rather than from memory.
 *
 * The source of numbers is handed in: `Math.random` where the deck is
 * built, a seeded one where the order must survive a re-render. */
export function shuffleDeck(cards: readonly QuizCard[], random: () => number = Math.random): QuizCard[] {
  return spread(shuffled(cards, random));
}

/** Trade each card that landed beside another of its own item for the
 * nearest one that fits both places, looking ahead first and then back,
 * since a clash in the last two places has nowhere ahead to go. A deck
 * with nothing else to offer, every card of one word, keeps them
 * together. */
function spread(cards: QuizCard[]): QuizCard[] {
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].item.id !== cards[i - 1].item.id) continue;
    // what each neighbour of the two places would be after the trade
    const trade = (j: number) => {
      const at = (k: number) => (k === i ? cards[j] : k === j ? cards[i] : cards[k])?.item.id;
      if (at(i) === at(i - 1) || at(i) === at(i + 1) || at(j) === at(j - 1) || at(j) === at(j + 1)) return false;
      [cards[i], cards[j]] = [cards[j], cards[i]];
      return true;
    };
    for (let d = 1; d <= REACH; d++) {
      if (i + d < cards.length && trade(i + d)) break;
      if (i - d >= 0 && trade(i - d)) break;
    }
  }
  return cards;
}

/** Where a quiz came from, and what to call it (SAK-353).
 *
 * The results and the rest screen used to offer "Back to the observatory"
 * whatever had sent you, and told practice apart by looking for the word
 * "practice" in the href. A quiz can start from the Observatory, the Atlas,
 * Sessions or Practice, and only the route that opened it knows which. */
export interface WayBack {
  href: string;
  /** "Back to the Atlas". Written out, since it is a button. */
  label: string;
}
