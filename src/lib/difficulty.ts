// One number for how much learning a glyph is, in READING-UNITS.
//
// WHY THIS EXISTS
// ===============
// Three schedulers price a glyph three different ways, and until now the curriculum
// packer and the keigo packer each measured a glyph by DRAW-AND-ASSEMBLY cost
// (kanjiCost / radicalCost — strokes to place and strokes to draw from scratch).
// That is the right axis for "learn to write this shape" and the wrong axis for
// "how much is there to KNOW here". The owner's difficulty model counts, instead,
// the number of distinct things a learner has to attach to the glyph:
//
//   plays the RADICAL role  -> 1  (its one radical meaning)
//   plays the KANJI  role   -> 1  (its one kanji meaning; its READINGS are not
//                                  counted here — they are attributed to the words
//                                  that attest them)
//   plays the WORD   role   -> readingUnits(row).length  (one per reading, each
//                                  reading carrying the union of glosses read that
//                                  way; "day, days" under one reading is still 1)
//
// summed across EVERY role the glyph plays. So 日 is a radical AND a kanji AND a
// two-reading word and is worth 1 + 1 + 2 = 4, wherever it turns up — the full
// role-sum is a property of the glyph, not of the context it is priced in.
//
// ROLES COME FROM THE ONE SPINE
// =============================
// The roles are read straight off CURRICULUM_SEQUENCE, so glyphDifficulty and the
// curriculum packer's costOf cannot disagree about what a glyph IS: they are the
// same `roles` set. A glyph the spine never teaches (a keigo prereq can be one)
// falls back to the same membership questions curriculum-order.ts asks — a radical
// row, a kanji row, a vocabulary row — which is what the spine itself would have
// used had the glyph been on it. A both-role character (人, 日) carries BOTH the
// radical and the kanji role and is counted for both, exactly as the spine records
// it; there is no "taught as kanji" folding here, because the owner's model does
// count the radical meaning as its own thing to learn (日 = 4, not 3).
//
// Imports are kept to the spine and the three data tables on purpose: this is a
// leaf the lesson packers pull in, and the codebase has had module-load-order
// hazards when a sizing file reaches the @/lib/engine barrel. Nothing here touches
// it.

import { kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
import { readingUnits, vocabRow } from "@/data/vocab";
import {
  CURRICULUM_SEQUENCE,
  curriculumPosition,
  type CurriculumRole,
} from "@/lib/curriculum-order";

/**
 * The difficulty of a glyph given the roles it plays: 1 per shape role (radical,
 * kanji) plus one per reading-unit for the word role. The glyph is needed to read
 * the word's reading-units; a role set with no word role never touches it.
 *
 * This is the exact arithmetic curriculum-order.ts's costOf wants over an item's
 * own `roles`, so the packer can call it with the item it already has and get a
 * number that agrees with glyphDifficulty by construction.
 */
export function rolesDifficulty(
  roles: readonly CurriculumRole[],
  glyph: string,
): number {
  let d = 0;
  if (roles.includes("radical")) d += 1;
  if (roles.includes("kanji")) d += 1;
  if (roles.includes("word")) {
    const row = vocabRow(glyph);
    // A word role always has a vocabulary row on the spine; the guard is only for
    // a fallback role set (below) that named "word" off a row that then went
    // missing. No row means no reading-units to count.
    if (row) d += readingUnits(row).length;
  }
  return d;
}

/**
 * The full role-sum difficulty of one glyph.
 *
 * Prefer the spine's own roles, so this and the curriculum packer price the glyph
 * identically. Off the spine, ask the same three membership questions the spine
 * asks (a radical, a kanji, a vocabulary word) — the roles it would have carried.
 */
export function glyphDifficulty(glyph: string): number {
  const pos = curriculumPosition(glyph);
  const roles =
    pos >= 0 ? CURRICULUM_SEQUENCE[pos].roles : detectRoles(glyph);
  return rolesDifficulty(roles, glyph);
}

/** The roles a glyph plays, by membership alone — the same question rolesOf asks
 * in curriculum-order.ts, for a glyph the spine does not carry. */
function detectRoles(glyph: string): CurriculumRole[] {
  const roles: CurriculumRole[] = [];
  if (radicalByGlyph(glyph) !== undefined) roles.push("radical");
  if (kanjiRow(glyph) !== undefined) roles.push("kanji");
  if (vocabRow(glyph) !== undefined) roles.push("word");
  return roles;
}
