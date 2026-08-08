// The prereq walk shared by the keigo and counters schedulers.
//
// WHY THIS IS ITS OWN MODULE
// ==========================
// Two tracks now teach a kanji the same way: before the material that USES the
// kanji, they teach the smaller radicals and kanji it is built from, so a new
// character reads as pieces the learner already knows rather than an arbitrary
// shape. Keigo does this for the kanji inside its politeness verbs; the
// numbers-and-counters track does it for the number kanji (一…十) and each
// counter kanji (人 本 匹 …). The walk that resolves a kanji to its unknown
// components is identical for both, so it lives here and both import it rather
// than keeping two copies that could drift.
//
// WHAT THE WALK PRODUCES
// ======================
// `collectPrereqs(c, …)` appends, in teaching order, the tiles a lesson must
// teach before it can teach `c`: the unknown radical-only components (and those
// of any unknown kanji components, recursively), then `c` itself. Each tile
// carries the FACT the lesson seeds and a COST in reading-units (difficulty.ts)
// so the caller can budget a sitting. `seenKanji` / `seenRadicals` are threaded
// across calls so a sitting that teaches several kanji never emits the same
// piece twice.

import { effectiveState } from "@/lib/claims";
import { builtPieces } from "@/data/kanji-etymology";
import { kanjiRow, meaningFactId, variantOriginal } from "@/data/kanji";
import {
  isRadicalTaughtAsKanji,
  radicalByWrittenForm,
  radicalMeaningFactId,
  type RadicalRow,
} from "@/data/radicals";
import { kanjiKnown } from "@/lib/kanji-known";
import { glyphDifficulty } from "@/lib/difficulty";
import type { FactId, HistoryFile } from "@/types";

/** One prereq piece in the collection buffer: the glyph, whether it is being
 * taught in its kanji or radical role, the fact the lesson seeds for it, and its
 * reading-unit cost (see difficulty.ts) for the sitting's budget. */
export interface PrereqItem {
  glyph: string;
  type: "Kanji" | "Radical";
  fact: FactId;
  cost: number;
}

/** The render-facing slice of a PrereqItem — a tile above a lesson preview. */
export interface PrereqTile {
  glyph: string;
  type: "Kanji" | "Radical";
}

/**
 * Collect the prereq tiles needed before kanji `c` can be taught: its unknown
 * radical-only components (and those of any unknown kanji components,
 * recursively), then `c` itself if unknown. Mirrors curriculum-order.ts's
 * component walk.
 *
 * `seenKanji` / `seenRadicals` prevent duplicate emission across calls.
 *
 * `isLeaf`, when passed, marks glyphs the CALLER teaches as atomic wholes: such a
 * glyph is emitted as its own tile but its components are NOT walked. The numbers
 * track passes it for the number kanji 一…十 (memorised wholes whose shape-only
 * pieces mislead — see src/data/number-kanji.ts); keigo passes nothing, so its
 * kanji decompose exactly as before. It threads through recursion, so a number
 * kanji reached as a sub-component is a leaf too (本's 一 stays a single tile with
 * no pieces of its own — which it never had).
 */
export function collectPrereqs(
  c: string,
  history: HistoryFile,
  seenKanji: Set<string>,
  seenRadicals: Set<string>,
  out: PrereqItem[],
  isLeaf?: (glyph: string) => boolean,
): void {
  if (seenKanji.has(c)) return;
  seenKanji.add(c);
  const row = kanjiRow(c);
  if (!row) return;
  // Already known — it and its components were taught by the curriculum earlier.
  if (kanjiKnown(c, history)) return;

  // A caller-declared atomic whole (the numbers track's number kanji): teach the
  // tile itself, but do not walk its shape-only components or its filed-under
  // radical. Same cost/fact as the tail push below, taken early so nothing
  // recurses beneath it.
  if (isLeaf?.(c)) {
    out.push({ glyph: c, type: "Kanji", fact: meaningFactId(c), cost: glyphDifficulty(c) });
    return;
  }

  // THE PIECES ARE THE ETYMOLOGY PIECES NOW, not the raw shape decomposition.
  // What a lesson must teach first is what the "Built from" box SHOWS: the
  // semantic and phonetic pieces (`builtPieces`), not every drawn stroke-shape.
  // So this walks those, resolving each drawn form the same way it always did — a
  // jōyō kanji is an ordered kanji prereq, a bound form (氵, 亻) is the debt of the
  // character it stands for (水, 人), a Kangxi radical (囗, 气) is a welded radical
  // prereq. A memorised whole — `builtPieces` empty — owes NO pieces, and the loop
  // and the filed-under-radical safety net below both fall away with it: it is
  // taught whole, which is the agreed fallback. This keeps the prereqs in
  // agreement with what Built from, the Library and the hint all now show.
  for (const { glyph: part } of builtPieces(c)) {
    if (part === c) continue;
    if (kanjiRow(part) !== undefined) {
      collectPrereqs(part, history, seenKanji, seenRadicals, out, isLeaf);
    } else {
      const rad = radicalByWrittenForm(part);
      if (rad && !isRadicalTaughtAsKanji(rad.num)) {
        addRadicalIfNew(rad, history, seenRadicals, out);
      } else {
        const orig = variantOriginal(part);
        if (orig !== undefined && orig !== c) {
          if (kanjiRow(orig) !== undefined) {
            collectPrereqs(orig, history, seenKanji, seenRadicals, out, isLeaf);
          } else {
            const origRad = radicalByWrittenForm(orig);
            if (origRad && !isRadicalTaughtAsKanji(origRad.num)) {
              addRadicalIfNew(origRad, history, seenRadicals, out);
            }
          }
        }
      }
    }
  }

  // Priced by reading-units, the whole role-sum of the glyph, so a prereq kanji
  // that is also a radical and a word (日 = 4) is budgeted at its full difficulty
  // even though this tile only teaches its kanji meaning. See difficulty.ts and
  // the owner's worked example. Its filed-under radical, when that radical is a
  // separate glyph, is a different tile with its own reading-unit cost; the two
  // never double-count the SAME glyph's role because glyphDifficulty(c) covers
  // c's own radical role and addRadicalIfNew is skipped for a radical taught as
  // this very kanji.
  out.push({ glyph: c, type: "Kanji", fact: meaningFactId(c), cost: glyphDifficulty(c) });
}

export function addRadicalIfNew(
  rad: RadicalRow,
  history: HistoryFile,
  seenRadicals: Set<string>,
  out: PrereqItem[],
): void {
  if (seenRadicals.has(rad.glyph)) return;
  seenRadicals.add(rad.glyph);
  const fact = radicalMeaningFactId(rad.glyph);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  if (state.lastTested > 0) return;
  out.push({ glyph: rad.glyph, type: "Radical", fact, cost: glyphDifficulty(rad.glyph) });
}

/** The render-facing tiles for a run of collected prereqs — glyph and role only,
 * dropping the fact and cost the scheduler used internally. */
export function toPrereqTiles(items: readonly PrereqItem[]): PrereqTile[] {
  return items.map(({ glyph, type }) => ({ glyph, type }));
}
