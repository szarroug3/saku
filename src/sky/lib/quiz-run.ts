// A run you leave, so it is there when you come back (SAK-404).
//
// The quiz used to keep everything in component memory: close the tab
// halfway through twelve cards and the twelve were gone. This is the small
// envelope that survives that, and it is deliberately small. Four things,
// which is what a resume needs and no more:
//
//   the deck as it was dealt, by card id, in order;
//   where the learner had got to;
//   the answers so far;
//   what the run was asked from, so the way back to it can be built.
//
// Plus when it was left, which is not read by anything that resumes but is
// the one field you want when a run looks wrong.
//
// WHAT IS NOT IN HERE, and why. The per-card `Open` state -- tries used,
// choices struck through, a hint already asked for -- is not kept. A card
// you were three tries into opens fresh on the way back. That is the kinder
// reading of a run left an hour ago, and it means the envelope is a list of
// ids, a number and the answers, all of which are already the shape the
// recorder wants.
//
// PURE, and knows nothing about where it is stored. The browser's copy and
// the account's column are the route layer's business (quiz-run-store.ts);
// everything here works on plain data and is tested as such.

import type { QuizAnswer, QuizCard } from "./quiz";

/** What a run was asked from, so coming back asks for the same deck.
 *
 * The three ways a quiz starts: what is due (neither field set), a lesson's
 * picks, and the exact cards named (a retry). A practice run carries its
 * recipe as the key `recipeKey` makes of it, rather than the recipe itself:
 * this model never resolves a recipe, it only asks whether two runs came
 * from the same one. */
export interface RunSource {
  /** The items a lesson asked for. */
  picks?: readonly string[];
  /** The exact cards named: a retry, or "run it again" from Sessions. */
  cards?: readonly string[];
  /** A practice recipe, as its canonical key. */
  recipe?: string;
}

/** A quiz part way through, as it is written down. */
export interface SavedRun {
  /** The deck as dealt, by card id, in the order it was asked. */
  deck: readonly string[];
  /** Which of those the learner was on. */
  at: number;
  /** What has been answered so far, in the order it was answered. */
  answers: readonly QuizAnswer[];
  /** Where the deck came from. */
  from: RunSource;
  /** When the last answer was written. */
  leftAt: number;
}

const isIds = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

/** One answer as it comes back out of storage, or null.
 *
 * Only the fields the recorder and the results read are checked. A stored
 * run is this browser's own writing, not a stranger's, so this is a guard
 * against an older shape, not against an attacker. */
function answerOf(raw: unknown): QuizAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Partial<QuizAnswer>;
  if (typeof a.cardId !== "string") return null;
  if (a.grade !== "clean" && a.grade !== "help" && a.grade !== "missed") return null;
  if (typeof a.tries !== "number") return null;
  return {
    cardId: a.cardId,
    grade: a.grade,
    tries: a.tries,
    narrowed: a.narrowed === true,
    hinted: a.hinted === true,
    ...(isIds(a.said) ? { said: a.said } : {}),
    ...(a.meta && typeof a.meta === "object" ? { meta: a.meta as Readonly<Record<string, string>> } : {}),
  };
}

/** A stored run read back, or null when there is nothing usable there.
 *
 * A run of no cards is nothing to come back to, and neither is one where
 * every card is answered: that one finished, and either the clearing was
 * lost or the last write raced it. Both read as no run at all rather than
 * as a run that offers to resume into its own results. */
export function readRun(raw: unknown): SavedRun | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SavedRun>;
  if (!isIds(r.deck) || r.deck.length === 0) return null;
  const answers = Array.isArray(r.answers) ? r.answers.map(answerOf).filter((a): a is QuizAnswer => !!a) : [];
  if (answers.length >= r.deck.length) return null;
  const from = r.from && typeof r.from === "object" ? (r.from as RunSource) : {};
  return {
    deck: r.deck,
    at: typeof r.at === "number" && r.at >= 0 && r.at < r.deck.length ? Math.floor(r.at) : 0,
    answers,
    from: {
      ...(isIds(from.picks) && from.picks.length ? { picks: from.picks } : {}),
      ...(isIds(from.cards) && from.cards.length ? { cards: from.cards } : {}),
      ...(typeof from.recipe === "string" ? { recipe: from.recipe } : {}),
    },
    leftAt: typeof r.leftAt === "number" ? r.leftAt : 0,
  };
}

/** The run as it stands: how big the deck is and how far in. */
function runProgress(run: SavedRun): { answered: number; total: number } {
  const have = new Set(run.deck);
  return { answered: run.answers.filter((a) => have.has(a.cardId)).length, total: run.deck.length };
}

/** How far in, in the app's words: "12 cards, 5 answered." */
export function runNote(run: SavedRun): string {
  const { answered, total } = runProgress(run);
  return `${total} ${total === 1 ? "card" : "cards"}, ${answered} answered`;
}

/** Whether two runs were asked for in the same words.
 *
 * Two asks are the same run when they name the same picks, the same cards
 * and the same recipe. "What is due" names none of the three, so a second
 * visit to a bare /quiz matches a saved due run, which is the whole point. */
export function sameSource(a: RunSource, b: RunSource): boolean {
  const list = (v: readonly string[] | undefined) => (v ?? []).join(",");
  return list(a.picks) === list(b.picks) && list(a.cards) === list(b.cards) && (a.recipe ?? "") === (b.recipe ?? "");
}

/** The cards this deck names, in the order the deck names them.
 *
 * The loader deals a named set in a fresh order (SAK-388, and rightly: a
 * retry should not be the same walk twice). A resume is the exception, so
 * the cards are put back into the order they were asked in. A card the data
 * no longer has is simply not there. */
export function orderDeck(cards: readonly QuizCard[], deck: readonly string[]): QuizCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return deck.map((id) => byId.get(id)).filter((c): c is QuizCard => !!c);
}

/** The run against the cards that actually came back, or null when too
 * little of it is left to resume.
 *
 * The library moves under a saved run: a word is retired, a fact is renamed.
 * The deck drops what is gone, the answers go with it, and the position is
 * clamped. A run whose every remaining card is answered is not a run any
 * more, and neither is an empty one. */
export function trimRun(run: SavedRun, have: readonly string[]): SavedRun | null {
  const kept = new Set(have);
  const deck = run.deck.filter((id) => kept.has(id));
  if (deck.length === 0) return null;
  const answers = run.answers.filter((a) => kept.has(a.cardId));
  if (answers.length >= deck.length) return null;
  const wasOn = run.deck[run.at];
  const at = Math.max(0, deck.indexOf(wasOn));
  return { ...run, deck, answers, at };
}

/** Where a resumed run opens: the card it was left on, unless that one has
 * since been answered, in which case the next one that has not. */
export function resumeAt(run: SavedRun): number {
  const done = new Set(run.answers.map((a) => a.cardId));
  for (let step = 0; step < run.deck.length; step++) {
    const n = (run.at + step) % run.deck.length;
    if (!done.has(run.deck[n])) return n;
  }
  return run.at;
}

/** The run as it should be written after an answer, or null when there is
 * nothing worth keeping: a deck with no answers in it yet is not something
 * to come back to, and a finished one has its record instead. */
export function runToKeep(deck: readonly string[], at: number, answers: readonly QuizAnswer[], from: RunSource, now: number): SavedRun | null {
  if (answers.length === 0 || answers.length >= deck.length) return null;
  return { deck, at, answers, from, leftAt: now };
}
