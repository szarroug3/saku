// The app's words for its own numbers.
//
// Two helpers, and they live here rather than in a component because three
// screens say these phrases and only one of them was ever a card. They used to
// sit in home/deck-card.tsx, whose DeckCard and Shelf died with the char-keyed
// selection — results and stats were importing a Home component for a string
// function, which was fine while Home had shelves and is nonsense now.

import type { AccuracyMetric } from "@/types";

/** How this metric's number should be read aloud in a subtitle. */
export function metricWord(metric: AccuracyMetric): string {
  return metric === "firstTry" ? "first try" : "of attempts";
}

/** "1 character" / "12 characters". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
