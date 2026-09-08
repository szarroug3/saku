// One pass over one deck, as the quiz screen holds it (SAK-420).
//
// The Quiz keeps two different kinds of thing in its head. There is what the
// card in front of you is doing: what has been typed, how many tries are left,
// which choices are struck through, whether a hint was asked for. And there is
// where the pass itself has got to: which card that is, what has been answered
// so far, and whether the deck is done with. The first is the card's business
// and stays in the component. The second is this file.
//
// It is three fields and a handful of moves between them, and the component
// holds it in ONE piece of state, so a settled answer and the position it
// leaves you on are the same object rather than two that have to agree.
//
// PURE, and it does not import React. The unit tests run under
// `--conditions=react-server`, where `useState` does not exist, so a hook here
// could not be tested at all; the component supplies the `useState` and this
// supplies every move it makes.
//
// NOT the same thing as `quiz-run.ts`, which is next to it. That one is the
// small envelope a pass is WRITTEN DOWN as, so it survives a closed tab. This
// one is the pass while it is being answered. They meet twice: a pass opens on
// a run that was written down, and reports itself back after every answer.

import type { QuizAnswer, QuizCard } from "./quiz";

/** A pass over a deck: where it is, what it has, whether it is over. */
export interface QuizPass {
  /** Which card of the deck is in front of the learner. */
  at: number;
  /** What has been answered, by card id. A card answered once is answered:
   * stepping back to it shows its reveal rather than asking it again. */
  answers: Readonly<Record<string, QuizAnswer>>;
  /** Whether the deck is done with, and the results stand in its place. */
  finished: boolean;
}

/** A pass as it opens: at the start with nothing answered, or where a saved
 * run was left (SAK-404).
 *
 * Read once, when the screen mounts. The screen owns the pass from then on,
 * and the caller writing the run down after every answer must not push it
 * back in. */
export function openPass(run?: { at?: number; answers?: readonly QuizAnswer[] }): QuizPass {
  return {
    at: run?.at ?? 0,
    answers: Object.fromEntries((run?.answers ?? []).map((a) => [a.cardId, a])),
    finished: false,
  };
}

/** How many of the deck have been answered. */
export function answeredCount(pass: QuizPass): number {
  return Object.keys(pass.answers).length;
}

/** Whether there is nothing left to ask. An empty deck is not answered: it
 * was never asked. */
export function allAnswered(pass: QuizPass, cards: readonly QuizCard[]): boolean {
  return cards.length > 0 && answeredCount(pass) === cards.length;
}

/** The answers in the order the deck asked them.
 *
 * What the recorder is handed, what the results list, and what is written
 * down after every answer. Off the cards rather than off the answers, so the
 * order is the deck's own and a card with no answer is simply absent. */
export function passAnswers(pass: QuizPass, cards: readonly QuizCard[]): readonly QuizAnswer[] {
  return cards.map((c) => pass.answers[c.id]).filter((a): a is QuizAnswer => !!a);
}

/** The card answered, and the position left exactly where it is.
 *
 * A miss stays on its own reveal, which is the whole point of settling and
 * moving on being two moves: a right answer does both, a missed one only
 * this. */
export function withAnswer(pass: QuizPass, answer: QuizAnswer): QuizPass {
  return { ...pass, answers: { ...pass.answers, [answer.cardId]: answer } };
}

/** On to the next card with no answer, wrapping past the end; finished when
 * every card has one.
 *
 * Wrapping is what makes a skipped card come back: step past it to the end of
 * the deck and the walk starts again at the front, so the cards you left open
 * are what is left to answer. */
export function nextOpen(pass: QuizPass, cards: readonly QuizCard[]): QuizPass {
  if (answeredCount(pass) >= cards.length) return finishPass(pass);
  for (let step = 1; step <= cards.length; step++) {
    const n = (pass.at + step) % cards.length;
    if (!pass.answers[cards[n].id]) return { ...pass, at: n };
  }
  return pass;
}

/** Somewhere else in the deck, by the arrows or the deck list.
 *
 * The SAME object back when the step goes nowhere: past either end, or onto
 * the card already in front of you, which is what the deck list asks for when
 * the current card is clicked. Setting the same object is a re-render React
 * bails out of, exactly as setting the same number was. */
export function stepTo(pass: QuizPass, cards: readonly QuizCard[], n: number): QuizPass {
  if (n < 0 || n >= cards.length || n === pass.at) return pass;
  return { ...pass, at: n };
}

/** Done with, whatever is left unanswered: ending the quiz early is a
 * finished pass with cards nobody answered, and the results say so. */
export function finishPass(pass: QuizPass): QuizPass {
  return pass.finished ? pass : { ...pass, finished: true };
}
