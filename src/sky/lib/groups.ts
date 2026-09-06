// The collections a sky can be cut by: the Atlas's own names, over the
// Sky's kinds. Tracked under Sky: Home.
//
// EVERY STAR ANSWERS TO ITS OWN COLLECTION (Sam, 2026-09-06). A word
// constellation is a word, the kanji it is written with and the pieces
// under those, so with Words and Radicals on and Kanji off it draws the
// word and the pieces and leaves the kanji dark. A constellation whose
// ROOT is left out goes entirely, since the constellation is that root.
// The pages to read (a term, a writing rule, a concept) are never stars.

import type { SkyKind } from "./types";

export type SkyGroup = "kana" | "radicals" | "kanji" | "words" | "counting" | "grammar" | "sentences" | "verb-pairs" | "keigo";

export const SKY_GROUPS: readonly { id: SkyGroup; label: string }[] = [
  { id: "kana", label: "Kana" },
  { id: "radicals", label: "Radicals" },
  { id: "kanji", label: "Kanji" },
  { id: "words", label: "Words" },
  { id: "counting", label: "Counting" },
  { id: "grammar", label: "Grammar" },
  { id: "sentences", label: "Sentences" },
  { id: "verb-pairs", label: "Verb pairs" },
  { id: "keigo", label: "Keigo" },
];

export const ALL_GROUPS: readonly SkyGroup[] = SKY_GROUPS.map((g) => g.id);

/** Which collection a star answers to, or null for a kind that is never a
 * star at all. */
export function groupOf(kind: SkyKind): SkyGroup | null {
  switch (kind) {
    case "kana": return "kana";
    case "radical": return "radicals";
    case "kanji": return "kanji";
    case "word": return "words";
    case "counter": return "counting";
    case "grammar": return "grammar";
    case "sentence": return "sentences";
    case "verbPair": return "verb-pairs";
    case "keigo": return "keigo";
    default: return null;
  }
}
