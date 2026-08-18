// Yōon combos, as ROWS the Library entry page can read one at a time.
//
// WHY THIS ISN'T dakuten-rows.ts's SHAPE
// =======================================
// DakutenRow is FIVE rows, each a different consonant shift with its own
// authored hook ("The [k]arate kick smashes the [g]arden gate") and its own
// irregularity (し stays "shi" not "si", ぢ/づ are rare, は takes both marks).
// Five rules, five things to say about each.
//
// Yōon is not that. Every one of the 72 combos (きゃ, しゅ, ちょ, …) follows
// the SAME rule: a small ゃ/ゅ/ょ fuses onto the kana in front of it into one
// beat. There is no per-combo hook to author — the rule is already fully
// written once, for both scripts, in src/data/phase-intros.ts's COMBO_H /
// COMBO_K — so a YoonRow carries no `hook` field the way DakutenRow does. What
// IS per-glyph is the BREAKDOWN — which base, which small kana, what the
// result reads — and that is what this file computes.
//
// DERIVED, NOT HAND-TYPED
// ========================
// Every row here is read off CHAR_INDEX (src/data/characters.ts), which is
// itself built from HIRAGANA_ROWS/KATAKANA_ROWS — the one place "every taught
// yōon combo" is enumerated. A combo added there appears here automatically;
// nothing in this file needs to change to keep up.

import { CHAR_INDEX } from "@/data/characters";
import type { CharInfo } from "@/types";

/** One yōon combo — きゃ, as the fields its Library page's composition block
 * needs. No `hook`: unlike DakutenRow, yōon has ONE shared rule (COMBO_H /
 * COMBO_K), not one per row — see this file's header. */
export interface YoonRow {
  /** The combined glyph — きゃ. */
  readonly glyph: string;
  /** The base kana it fuses onto — き. */
  readonly base: string;
  /** The small kana — ゃ. */
  readonly small: string;
  /** Its reading, e.g. "kya" — the entry's own first accepted romaji, so the
   * breakdown line says what the drill says. */
  readonly reading: string;
  readonly setId: "hiragana" | "katakana";
}

function toRow(glyph: string, info: CharInfo): YoonRow | null {
  const parts = Array.from(glyph);
  if (parts.length !== 2) return null;
  if (info.set !== "hiragana" && info.set !== "katakana") return null;
  return { glyph, base: parts[0], small: parts[1], reading: info.r[0], setId: info.set };
}

/** Every taught yōon combo, both scripts, in CHAR_INDEX's own order. */
export const YOON_ROWS: readonly YoonRow[] = Object.entries(CHAR_INDEX)
  .map(([glyph, info]) => toRow(glyph, info))
  .filter((r): r is YoonRow => r !== null);

const BY_GLYPH: Readonly<Record<string, YoonRow>> = Object.fromEntries(
  YOON_ROWS.map((row) => [row.glyph, row]),
);

/** The yōon row for a combined glyph — きゃ → {base: き, small: ゃ, …} — or
 * null for anything that isn't one of the 72 taught combos (a base kana, a
 * dakuten/handakuten kana, an untaught string). A lookup, never a parse, the
 * same contract as dakutenRowFor. */
export function yoonRowFor(glyph: string): YoonRow | null {
  return BY_GLYPH[glyph] ?? null;
}
