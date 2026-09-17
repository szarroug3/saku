// The quiz's model: a card per question, in plain data from whatever the
// route's adapter can build, and the three grades an answer can earn.
// Tracked as SAK-312 to SAK-317.
//
// Every card opens on a blank box (SAK-313), or on its choices when that is
// all it is ever asked by. A right answer moves straight on; a wrong one
// gets more tries (DEFAULT_RETRIES in all; one only on a card of two choices)
// before the card is missed. Help is there to ask for: the choices, a
// hint. Three grades (Sam, 2026-09-05; the old "nearly" went, since ka for
// ki is not a slip): perfect (right, first try, nothing asked for), with
// help (right after a retry, a hint or asking for the choices), missed
// (wrong after the last try, or given up). Opening on choices is not help.
// Cards can be skipped and come back to; the grades are per card.

import { isJapanese } from "./japanese";
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
  clean: { label: "Perfect", meaning: "You got it right without any help.", consequence: "It waits the longest before it comes back." },
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
  /** Why this wrong choice was on the board, in a few words: "another
   * reading of the same character", "drawn almost the same" (SAK-315).
   *
   * The reveal lists these, so the escape hatch teaches: a distractor is the
   * shape of the mistake you were about to make, and saying which shape it
   * was is worth more than confirming the answer twice. The route works it
   * out from the confusable set the board was drawn from; an option it
   * cannot name honestly carries nothing and is simply not listed, since a
   * vague reason is worse than none. Never set on the answer. */
  why?: string;
}

/** One of a character's readings, as the reveal's breakdown lists it. */
export interface QuizReading {
  reading: string;
  /** "on'yomi", "kun'yomi", "listed both ways"; absent when unknown. */
  kind?: string;
  /** A word this reading turns up in, so it is a reading of something. */
  inWord?: string;
  /** This is the one the card asked about. */
  applies: boolean;
}

/** Which reading applies here, and why (SAK-316).
 *
 * The quiz is mostly not asking what a thing means. It is asking which
 * reading applies, because that is the part of Japanese that goes wrong: 水 is
 * みず alone and すい in 水曜日. So the reveal explains the rule rather than
 * confirming the answer twice.
 *
 * The prose is authored per RULE, not per item, and the route fills the
 * character and the word into it, so every card that exercises the same rule
 * says the same thing. A card whose rule cannot be named honestly carries
 * none, and the reveal is what it always was. */
export interface QuizRule {
  title: string;
  prose: string;
  /** The character's readings, the one asked marked: the reading that applies
   * is worth little except against the ones that did not. */
  readings?: readonly QuizReading[];
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
  /** A nudge, shown on request: a line, a drawing, or the arithmetic.
   *
   * `steps` is a grammar production card's derivation, one equation to the
   * line, already written out ("たかい − い + くて → たかくて"). It arrives as
   * strings because the Sky does not import the engine that builds it, and it
   * is drawn under `text` in the Japanese face rather than as prose. */
  /** `reading` is how a kanji word is said, kept apart from `text` so the
   * hint can say it in a sentence with the reading in the accent (SAK-453). */
  hint?: { text?: string; image?: string; reading?: string };
  /** How the answer is built, an equation to the line ("げんき + な →
   * げんきな"). Shown under the answer once the card is answered, never in
   * the hint: its last line IS the answer (SAK-454). */
  built?: readonly string[];
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
  /** Which reading applies here, and why (SAK-316); absent when the card
   * exercises no rule the app can name. */
  rule?: QuizRule;
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
  /** Accepted once case and spacing are normalized. Stored normalized. */
  loose?: readonly string[];
  /** As `loose`, and additionally within a typo or two. Stored normalized. */
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

/** Where a card stands while it is still open: what has been tried and
 * what help was taken. Kept per card, so a skipped card resumes. */
export interface Open {
  tries: number;
  narrowed: boolean;
  hinted: boolean;
  /** Choices already tried and found wrong. */
  wrong: readonly string[];
  /** Everything tried on this card so far, in order, for the reveal to list
   * (SAK-387). Each attempt is added as it is made, so an earlier guess is
   * still there when a later one settles the card. */
  said: readonly string[];
  /** The choice picked and not yet checked (a pick only selects; Check
   * submits, so a clip can be heard first: Sam, 2026-09-05). */
  chosen?: string;
  /** An ordering card's pieces placed so far, by their index in the deal. */
  built?: readonly number[];
}

/** A card nobody has touched yet. */
export const FRESH: Open = { tries: 0, narrowed: false, hinted: false, wrong: [], said: [] };

/** "One more try." or "2 tries left." */
export const triesNote = (left: number) => (left === 1 ? "One more try." : `${left} tries left.`);

/** How many goes this card gets in all: the retries plus the first, and
 * never more than a board of choices can honestly offer.
 *
 * A card answered by picking runs out when one wrong choice is left, since
 * the last one standing is the answer and picking it proves nothing: two
 * choices give one try, three give two. A typed card and an ordering card
 * have no board to exhaust, so they get the retries as set. */
export function maxTriesFor(card: QuizCard | undefined, retries: number): number {
  if (!card || card.typed || card.order) return retries + 1;
  return Math.min(retries + 1, Math.max(1, card.options.length - 1));
}

/** The three counts. */
export function tally(answers: readonly QuizAnswer[]): Record<Grade, number> {
  const out: Record<Grade, number> = { clean: 0, help: 0, missed: 0 };
  for (const a of answers) out[a.grade]++;
  return out;
}

/** What was said on the way to the right answer, in the order it was said
 * (SAK-425).
 *
 * `said` is every attempt on the card, and on a card that was answered in the
 * end the last of them IS the answer: it is already drawn, large, on its own
 * line. What the reveal was missing is the ones before it. A card answered
 * first time has none, and a missed card has no right answer to be before, so
 * its whole list is what it said and `QuizVerdict` shows that instead
 * (SAK-387).
 *
 * Off the answer, not off the open card, so it is the same on the way back to
 * a card as it was when the card was settled, and it survives a reload: the
 * saved run has carried `said` since SAK-404. */
export function triedBefore(answer: QuizAnswer): readonly string[] {
  if (answer.grade === "missed") return [];
  return (answer.said ?? []).slice(0, -1);
}

/** What the reveal draws large, and the muted line under it (SAK-440).
 *
 * A kana card takes the sound spelled in English beside the romaji (SAK-435),
 * so "ah" answers あ. The reveal printed the card's own answer regardless, so
 * a learner who typed "ah" was told PERFECT over the word "a", which is an
 * answer they did not give, and nothing on the screen said whether "ah" had
 * counted or whether they had been let off.
 *
 * It shows what they typed instead, and names the card's own form underneath,
 * so the credit and the spelling to learn are both on the screen. The muted
 * line comes apart into three pieces because its middle is the form itself and
 * may be Japanese, and Japanese is drawn in the Japanese face.
 */
interface AnswerLine {
  /** The big line: what was typed when that was an accepted spelling of its
   * own, and the card's answer otherwise. */
  said: string;
  /** The line under it. Absent when the big line IS the card's answer, which
   * is every card that was answered the way the card writes it. */
  note?: { before: string; form: string; after: string };
}

/** Case and spacing, the way the grader compares English (`norm` in
 * src/lib/en-text.ts). Two spellings that differ by nothing but these are the
 * same spelling, so "A" for あ is not worth a line. */
const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/** Which sentence names the card's own form. A meaning card's answer is
 * English and the alternate is a synonym, so it reads as one; a reading typed
 * in romaji is written in romaji; a reading that is Japanese is written, not
 * spelled. */
function noteFor(card: QuizCard): AnswerLine["note"] {
  if (card.answerIs === "meaning") return { before: "Also: ", form: card.answer, after: "" };
  if (isJapanese(card.answer)) return { before: "Also written ", form: card.answer, after: "." };
  return { before: "Written ", form: card.answer, after: " in romaji." };
}

export function answerLine(card: QuizCard, answer: QuizAnswer): AnswerLine {
  // A missed card already shows what was said, struck through, under the right
  // answer (SAK-387), and an ordering card says itself in pieces.
  if (answer.grade === "missed" || card.order) return { said: card.answer };
  const said = answer.said?.[answer.said.length - 1];
  if (!said || same(said, card.answer)) return { said: card.answer };
  // Picked, not typed: what is on a tile is the card's own wording either way,
  // so a board can never put a second spelling on the screen.
  if (card.options.some((o) => o.label === said)) return { said: card.answer };
  return { said, note: noteFor(card) };
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
    // what each neighbor of the two places would be after the trade
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
