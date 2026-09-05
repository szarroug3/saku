// The quiz's model: a card per question, in plain data from whatever the
// route's adapter can build, and the four grades an answer can earn.
// Tracked as SAK-312 to SAK-317.
//
// Every card opens on a blank box (SAK-313). A right or near answer goes
// straight to the reveal; a miss shows the narrowed set for a second look;
// the learner may ask for the set at any time, at the cost of the clean
// grade. Four grades, kept apart (SAK-317), since they are four different
// events: clean (right, cold, first try), nearly (right but for spelling),
// help (right after narrowing, asked for or triggered by a miss), missed
// (wrong after the second look, or skipped).

import type { LessonTeach } from "./lesson";
import type { SkyItem } from "./types";

export type Grade = "clean" | "nearly" | "help" | "missed";

export const GRADES: readonly Grade[] = ["clean", "nearly", "help", "missed"];

/** What each grade means, and what it does to the schedule. */
export const GRADE: Record<Grade, { label: string; meaning: string; consequence: string }> = {
  clean: { label: "Clean", meaning: "Right, cold, first try.", consequence: "Produced cold: the interval stretches furthest." },
  nearly: { label: "Nearly", meaning: "Right but for spelling.", consequence: "You had it and the spelling slipped: back sooner, no reset." },
  help: { label: "With help", meaning: "Right after narrowing it down.", consequence: "Recognised rather than recalled: treated as weaker than clean." },
  missed: { label: "Missed", meaning: "Wrong after the second look, or skipped.", consequence: "Back tomorrow, and its confusable comes with it." },
};

/** One choice in the narrowed set. */
export interface QuizOption {
  id: string;
  label: string;
  /** The label is Japanese, for its font. */
  jp: boolean;
}

/** One question. */
export interface QuizCard {
  /** The fact asked about: the card's id. */
  id: string;
  /** The thing it is a fact of, for the reveal's head and the strip. */
  item: SkyItem;
  /** The big thing on the card, and the line that makes it answerable. */
  prompt: { glyph: string; jp: boolean; context?: string };
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
  /** What was typed, when something was. */
  given?: string;
  /** Attempts before the reveal: 1 for a clean answer. */
  tries: number;
  /** The narrowed set was shown before the answer landed. */
  narrowed: boolean;
}

/** What a grader says about a typed answer. */
export interface Verdict { ok: boolean; nearly: boolean }

/** The grade for what happened on a card: the verdict, whether the set
 * was shown, and whether this was the first try. */
export function gradeFor(verdict: Verdict, narrowed: boolean, tries: number): Grade | null {
  if (verdict.ok) return narrowed || tries > 1 ? "help" : "clean";
  if (verdict.nearly && !narrowed) return "nearly";
  return null;
}

/** The four counts. */
export function tally(answers: readonly QuizAnswer[]): Record<Grade, number> {
  const out: Record<Grade, number> = { clean: 0, nearly: 0, help: 0, missed: 0 };
  for (const a of answers) out[a.grade]++;
  return out;
}
