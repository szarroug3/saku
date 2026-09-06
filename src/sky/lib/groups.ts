// The collections a sky can be cut by: the Atlas's own names, over the
// Sky's kinds. Tracked under Sky: Home.
//
// A CONSTELLATION belongs to a collection, not a star: the filter is about
// what is up there, so it takes whole constellations out rather than
// hollowing them. A piece has no constellation of its own (it is drawn
// inside the kanji it builds) and so follows that kanji, and the pages to
// read (a term, a writing rule, a concept) are never stars at all.

import type { SkyKind } from "./types";

export type SkyGroup = "kana" | "kanji" | "words" | "counting" | "grammar" | "sentences" | "verb-pairs" | "keigo";

export const SKY_GROUPS: readonly { id: SkyGroup; label: string }[] = [
  { id: "kana", label: "Kana" },
  { id: "kanji", label: "Kanji" },
  { id: "words", label: "Words" },
  { id: "counting", label: "Counting" },
  { id: "grammar", label: "Grammar" },
  { id: "sentences", label: "Sentences" },
  { id: "verb-pairs", label: "Verb pairs" },
  { id: "keigo", label: "Keigo" },
];

export const ALL_GROUPS: readonly SkyGroup[] = SKY_GROUPS.map((g) => g.id);

/** Which collection a constellation belongs to, by the kind of its root, or
 * null for a kind that is never a constellation. */
export function groupOf(kind: SkyKind): SkyGroup | null {
  switch (kind) {
    case "kana": return "kana";
    case "radical":
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
