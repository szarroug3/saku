// The jōyō components of a kanji — "built from parts you learn on their own".
//
// Lifted out of components/lesson/how-its-written.tsx so the drill's hint
// builder can ask the same question the lesson asks, with the same answer. It
// was a private helper there; it is the same helper here, unchanged, and that
// file now imports it. Two copies of this test would be two chances for the
// lesson and the hint to disagree about what 明 is made of.

import { kanjiRow } from "@/data/kanji";

export interface KanjiPart {
  readonly c: string;
  readonly meaning: string;
}

/**
 * A kanji's components EXCLUDING itself, but ONLY when every one of them is
 * itself a jōyō kanji with a card — the same test kanjiCost uses for a "known
 * radical". Null otherwise, which every caller reads as "there is nothing
 * teachable to say here".
 *
 * Raw KRADFILE comps (｜ ノ マ ユ ヨ ハ) are never returned: they are unreliable
 * for teaching and half of them have no page to link. An all-or-nothing test
 * rather than a filter, because "made of 日" is a false statement about 明.
 */
export function teachableParts(glyph: string): KanjiPart[] | null {
  const row = kanjiRow(glyph);
  if (!row) return null;
  const parts = row.comps.filter((c) => c !== glyph);
  if (!parts.length) return null;
  if (!parts.every((c) => kanjiRow(c) !== undefined)) return null;
  return parts.map((c) => ({ c, meaning: kanjiRow(c)?.meanings[0] ?? "" }));
}
