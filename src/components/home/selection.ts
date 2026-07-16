// What Home's cards mean, and how the start bar reads them back.
//
// THE ONE IDEA: a card does not own a selection, it DESCRIBES one. The
// selection itself is cfg.enabled — a flat char→bool map, the same one the
// picker edits. So a card is not a checkbox with state of its own; it is a
// question asked of that map ("are all my characters on?"), and toggling it
// writes the answer back. Three consequences fall straight out, and each one
// is a bug we would otherwise have had to fix by hand:
//
//   1. UNION AND DEDUP ARE FREE. Toggling two overlapping cards on sets the
//      same key true twice. Weakest 20 ∪ Hiragana Basic is 74, not 66 — not
//      because anything merges lists, but because a map cannot hold a key
//      twice. There is no union code below to get wrong.
//   2. PARTIAL IS UNAVOIDABLE, so it is designed. Untick ツ in the picker and
//      Katakana Basic is neither on nor off. Same all/some/none the picker's
//      rows already have — deliberately, so the cards and the picker say the
//      same thing about the same map.
//   3. THE CARDS AND THE SENTENCE CANNOT DISAGREE. Both are computed from the
//      map, so the start bar names exactly the cards that are lit.
//
// Pure: no React, no DOM. Home renders these answers; it does not define them.

import type { QuizConfig } from "@/types";

/** A card's relationship to the selection. Mirrors the picker's row logic. */
export type CardState =
  /** Every one of its characters is on. */
  | "on"
  /** Some but not all — you have disagreed with the card in the picker. */
  | "partial"
  /** None of them. */
  | "none";

/** The shape Home's shelves hand to the namer: anything with chars and a name. */
export interface Selectable {
  id: string;
  label: string;
  chars: string[];
}

/** How many of `chars` are currently on. */
export function countOn(
  chars: string[],
  enabled: Record<string, boolean>,
): number {
  let n = 0;
  for (const c of chars) if (enabled[c]) n++;
  return n;
}

/** Where `chars` stands against the selection. An empty deck is never "on":
 * "all zero of them are selected" is true and useless. */
export function stateOf(
  chars: string[],
  enabled: Record<string, boolean>,
): CardState {
  if (!chars.length) return "none";
  const on = countOn(chars, enabled);
  if (on === chars.length) return "on";
  return on === 0 ? "none" : "partial";
}

/**
 * The map with `chars` all on or all off.
 *
 * Only the keys named are touched — every other selection on the page survives
 * a toggle untouched. That is what makes the cards multi-select rather than
 * radio buttons, and it is why a card can never clear another card's work.
 */
export function toggled(
  cfg: QuizConfig,
  chars: string[],
  on: boolean,
): QuizConfig {
  const enabled = { ...cfg.enabled };
  for (const c of chars) enabled[c] = on;
  return { ...cfg, enabled };
}

/** What clicking a card should do: anything short of fully-on turns fully on.
 * Same rule as a picker row, so a half-lit card fills rather than empties —
 * the click that "does nothing visible" is the one users report as broken. */
export function nextValue(state: CardState): boolean {
  return state !== "on";
}

function isSubsetOf(a: string[], b: Set<string>): boolean {
  return a.every((c) => b.has(c));
}

/**
 * The names of the cards the selection currently IS, smallest honest list.
 *
 * Fully-on cards only — a partial card is not a name for the selection, it is
 * a disagreement with it, and the count is the truth in that case.
 *
 * Then subsumption: a card wholly inside another named card is dropped. This
 * is not tidying, it is the difference between a true sentence and a silly
 * one. Turn on Everything and all nine cards are legitimately "on" — the
 * sentence must say "Everything", not "Weakest 20 + Confusions + 7 more".
 * Likewise Weakest 20 is usually a subset of Hiragana Basic, so selecting the
 * deck alone must not claim you also picked the weakness card. Ties (two cards
 * with identical characters) keep the earlier, so shelf order breaks them.
 */
export function namedSelection(
  cards: Selectable[],
  enabled: Record<string, boolean>,
): string[] {
  const on = cards.filter(
    (c) => c.chars.length && stateOf(c.chars, enabled) === "on",
  );
  const sets = on.map((c) => new Set(c.chars));
  return on
    .filter((card, i) =>
      !on.some(
        (other, j) =>
          i !== j &&
          isSubsetOf(card.chars, sets[j]) &&
          // Strictly bigger wins; same size falls back to shelf order so the
          // pair doesn't eliminate each other and leave nothing named.
          (other.chars.length > card.chars.length || j < i),
      ),
    )
    .map((c) => c.label);
}

/** "1 character" / "46 characters". */
function chars(n: number): string {
  return `${n} character${n === 1 ? "" : "s"}`;
}

/**
 * The WHAT half of the start bar: what you are about to drill.
 *
 * Degrades because it must — two selections can name themselves, nine cannot:
 *   1  → "Hiragana Basic · 46 characters"
 *   2  → "Weakest 20 + Hiragana Basic · 74 characters"
 *   3+ → "Weakest 20 + Hiragana Basic + 2 more · 131 characters"
 *
 * `count` is passed in rather than derived from the labels, and that is the
 * whole point: it is selectedChars(cfg).length — exact, deduped, and true even
 * when the names above it have degraded to "+ 2 more" or vanished into
 * "Custom". The names are a summary and are allowed to blur; the number never
 * is.
 */
export function whatSentence(labels: string[], count: number): string {
  if (!count) return "nothing selected";
  const head =
    labels.length <= 2
      ? labels.join(" + ")
      : `${labels[0]} + ${labels[1]} + ${labels.length - 2} more`;
  return `${head} · ${chars(count)}`;
}

/**
 * The card names for a selection, with "Custom" standing in for the rest.
 *
 * Characters that no fully-on card accounts for — five you ticked by hand in
 * the picker — are real and must appear in the sentence, or it would name a
 * deck and then print a count that doesn't match it. "Custom" is just another
 * label, so it degrades through whatSentence with everything else.
 */
export function selectionLabels(
  cards: Selectable[],
  enabled: Record<string, boolean>,
  count: number,
): string[] {
  const labels = namedSelection(cards, enabled);
  const covered = new Set<string>();
  for (const card of cards) {
    if (labels.includes(card.label)) for (const c of card.chars) covered.add(c);
  }
  return count > covered.size ? [...labels, "Custom"] : labels;
}
