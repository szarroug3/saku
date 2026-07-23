// What ROLE a character plays — radical, kanji, or both — in one label the whole
// app can print the same way.
//
// The combined track (see kanji-lesson.ts) teaches radicals and kanji together,
// and a learner needs to know, for any character, whether to expect it INSIDE A
// WORD (a kanji), ONLY AS A BUILDING BLOCK (a radical-only shape), or BOTH. That
// is three answers, and they must read identically on a lesson tile and on the
// character's Library page — so the label lives here once rather than being
// re-phrased at each call site (which is how "Kanji · also radical 5" and
// "Radical · in 1 kanji" drifted into two shapes for one idea).
//
// IT IS PURE GLYPH MEMBERSHIP, not the teaching classification. A character is a
// kanji if it has a kanji row, a radical if it has a radical row; both, one, or
// neither follows. isRadicalTaughtAsKanji (src/data/radicals.ts) decides WHERE a
// both-role character is taught — 乙 as its kanji, 火 with an early radical card —
// but the ROLE is the same for both: they are each a radical AND a kanji, and the
// label says so. The number ("radical 5") and the count ("in 1 kanji") are
// deliberately dropped: they are catalogue trivia, not the one thing the learner
// is asking, which is which of the three this is.

import { kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";

/** The three role labels, lowercase with a middot for the both-role case, so the
 * tile and the entry page print the identical string. */
export type CharacterRole = "radical · kanji" | "radical" | "kanji";

/**
 * The role a character plays, or null when it is neither a radical nor a kanji
 * (a kana, a grammar pattern — nothing this label is about).
 *
 * "radical · kanji" for a character that is both a Kangxi radical and a standalone
 * jōyō kanji (乙, 人, 大, and the early-taught 火, 玉 …); "radical" for a radical-
 * only shape that is not a kanji (气, 宀); "kanji" for a kanji that is not a
 * radical (乞, and the great majority).
 */
export function characterRole(glyph: string): CharacterRole | null {
  const isKanji = kanjiRow(glyph) !== undefined;
  const isRadical = radicalByGlyph(glyph) !== undefined;
  if (isKanji && isRadical) return "radical · kanji";
  if (isRadical) return "radical";
  if (isKanji) return "kanji";
  return null;
}
