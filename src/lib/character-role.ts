// What ROLES a character plays — radical, kanji, word, or any mix of them — in
// one label the whole app can print the same way.
//
// The combined track (see kanji-lesson.ts) teaches radicals and kanji together,
// and a learner needs to know, for any character, whether to expect it INSIDE A
// WORD, ONLY AS A BUILDING BLOCK, or ALREADY AS A WORD BY ITSELF. A character
// can be doing all three at once (山 is a Kangxi radical, a jōyō kanji, and the
// word やま), so the answer is a SET, not one of a fixed handful of strings. The
// label lives here once rather than being re-phrased at each call site (which is
// how "Kanji · also radical 5" and "Radical · in 1 kanji" drifted into two shapes
// for one idea).
//
// IT IS PURE GLYPH MEMBERSHIP, not the teaching classification. A character is a
// kanji if it has a kanji row, a radical if it has a radical row, a word if the
// words track teaches it as a one-character word; any mix follows.
// isRadicalTaughtAsKanji (src/data/radicals.ts) decides WHERE a radical-and-kanji
// character is taught — 乙 as its kanji, 火 with an early radical card — but the
// ROLES are the same either way, and the label says so. The number ("radical 5")
// and the count ("in 1 kanji") are deliberately dropped: they are catalogue
// trivia, not the thing the learner is asking, which is what this character is
// for.

import { kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
import { isSingleCharWordGlyph } from "@/data/vocab";
import { isNumberKanji } from "@/data/number-kanji";

/** The roles themselves, in the ONE order every label prints them: a radical is
 * the smallest thing, a kanji is built of radicals, a word is made of kanji. */
export const ROLE_ORDER = ["radical", "kanji", "word"] as const;

export type RoleName = (typeof ROLE_ORDER)[number];

/** Every role set a character can have, lowercase, middot-joined in ROLE_ORDER —
 * so the tile, the badge and the entry page print the identical string. */
export type CharacterRole =
  | "radical"
  | "kanji"
  | "word"
  | "radical · kanji"
  | "radical · word"
  | "kanji · word"
  | "radical · kanji · word";

/**
 * The roles a character plays, in ROLE_ORDER — empty for a character that plays
 * none (a kana, a multi-character word, a grammar pattern: nothing this label is
 * about).
 *
 * This is the source of role membership; everything else here formats it.
 */
export function characterRoles(glyph: string): RoleName[] {
  const roles: RoleName[] = [];
  if (radicalByGlyph(glyph) !== undefined) roles.push("radical");
  if (kanjiRow(glyph) !== undefined) roles.push("kanji");
  // A single Han character that is a dictionary word carries the word role, so a
  // character the curriculum teaches as a radical/kanji that is ALSO a word on
  // its own (十, 千, 羊) is taught whole. Kana and multi-character forms are
  // excluded by the predicate; see isSingleCharWordGlyph. This used to read off
  // CURRICULUM_WORDS (the scheduled word track) alone, which left ~93 such
  // characters showing only their shape and never their word.
  if (isSingleCharWordGlyph(glyph)) roles.push("word");
  return roles;
}

/**
 * The same roles as one lowercase label, or null when the character plays none.
 *
 * "radical · kanji · word" for 山 (a Kangxi radical, a jōyō kanji, and a word on
 * its own); "kanji · word" for 何; "radical · kanji" for a both-role character
 * that is not itself a word; "radical" for a radical-only shape (气, 宀);
 * "kanji" for a kanji that is neither a radical nor a word of its own (乞, and
 * the great majority).
 */
export function characterRole(glyph: string): CharacterRole | null {
  const roles = characterRoles(glyph);
  // The cast is total: characterRoles returns a subset of ROLE_ORDER in order,
  // and CharacterRole spells out all seven non-empty joins of exactly that.
  return roles.length ? (roles.join(" · ") as CharacterRole) : null;
}

/** The same roles, Title Cased for a heading or a tile label: "Radical · Kanji ·
 * Word", "Kanji · Word", "Radical". The lowercase form reads well mid-sentence;
 * a label wants the capital. Both spell the identical roles in the identical
 * order, so they stay one source. */
export function characterRoleTitle(glyph: string): string | null {
  // A number kanji reads as one thing — "Number" — not its raw "Kanji · Word"
  // role mix, so its lesson/preview tiles name it the way the learner thinks of it.
  if (isNumberKanji(glyph)) return "Number";
  const roles = characterRoles(glyph);
  if (!roles.length) return null;
  return roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(" · ");
}

/**
 * Does this glyph play the radical role at all — a radical-only shape (气) OR a
 * character that is also a kanji or a word (人, 大, 火)?
 *
 * True exactly when the character is a radical, whatever else it is; false for a
 * kanji that is no radical (乞) and for anything that is neither (a kana). This
 * is the trigger the "What a radical is" concept card rides in on: it lands
 * ahead of the FIRST character that plays a radical role, which is a both-role
 * character at the very first kanji set, not the first building-block-only
 * shape. Membership only, the same pure glyph question `characterRoles` answers.
 */
export function playsRadicalRole(glyph: string): boolean {
  return radicalByGlyph(glyph) !== undefined;
}
