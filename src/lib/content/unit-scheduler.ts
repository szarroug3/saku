// UNIT SCHEDULER — the same lesson walk as `scheduler.ts` (planLesson), but over
// TEACHING UNITS (teach-unit.ts) instead of whole ContentItems. A unit is one
// pronunciation of a glyph and the meaning(s) read that way, so this schedules
// "teach 人 ひと (person)" before "teach 人 じん (-ian)" by how often each reading
// is spoken — the grain planLesson's per-item walk can't express.
//
// It does NOT re-derive anything. The order, cost, dueness and unit split all come
// from teach-unit.ts; the prereq graph and the corpus lookup come from build-item
// and resolve; the budget/depth SEMANTICS mirror planLesson exactly (fill toward
// the floor, never past the ceiling save a lone oversized bundle; defer an item
// whose untaught-prereq chain runs past MAX_PREREQ_DEPTH). Only the atom differs.
//
// PREREQUISITES ACROSS THE UNIT GRAIN. A glyph's Built-from components live on the
// ITEM (ContentItem.prereqs), not the unit — 何 is built on 人 and 可 regardless of
// which reading of 何 is being taught. So a due unit's prerequisite is satisfied by
// the component glyph's PRIMARY unit (its most-spoken reading): you have "met" 人
// once 人 ひと is learned. The chain a unit pulls is therefore its glyph's untaught
// component glyphs, each represented by its primary unit, in dependency order.

import { MAX_PREREQ_DEPTH } from "./scheduler";
import { buildGlyphItem } from "./build-item";
import { resolveItem } from "./resolve";
import {
  orderedUnits,
  pronunciationUnitsOf,
  unitCost,
  isUnitDue,
  byFrequencyDesc,
} from "./teach-unit";
import type { PronunciationUnit, UnitLesson } from "./teach-unit";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { HistoryFile } from "@/types";

/** A glyph's PRIMARY unit — its most-spoken reading, the one a learner "meets the
 * glyph" through. Undefined when the glyph builds no teachable item. This is the
 * unit a prerequisite edge onto the glyph is satisfied by. */
function primaryUnit(glyph: string): PronunciationUnit | undefined {
  const item = buildGlyphItem(glyph);
  if (!item) return undefined;
  return [...pronunciationUnitsOf(item)].sort(byFrequencyDesc)[0];
}

/** The dedupe identity of a unit within one lesson: glyph + reading. One unit per
 * pronunciation per glyph, so this is unique; a reading-null (meaning-only) unit
 * gets its own stable key. */
function unitKey(unit: PronunciationUnit): string {
  return `${unit.glyph}␟${unit.reading ?? ""}`;
}

/**
 * A glyph's still-untaught prerequisite PRIMARY units, in dependency order
 * (prereqs first), or null if any untaught branch runs deeper than `maxDepth`.
 * Mirrors `untaughtChain` in scheduler.ts: a learned component stops the walk (it
 * doesn't extend the chain), so a glyph's effective depth shrinks as its
 * components are learned and the gate lifts on its own. The glyph's OWN unit is
 * not included — the caller appends the specific due unit it is scheduling.
 */
function prereqChain(
  glyph: string,
  history: HistoryFile,
  maxDepth: number,
): PronunciationUnit[] | null {
  const chain: PronunciationUnit[] = [];
  const seen = new Set<string>([glyph]); // the glyph itself never re-enters
  const visit = (g: string, depth: number): boolean => {
    const item = buildGlyphItem(g);
    if (!item) return true;
    for (const p of item.prereqs) {
      const pg = resolveItem(p)?.glyph;
      if (pg == null) continue; // not in the corpus we can reach
      const pu = primaryUnit(pg);
      if (!pu || !isUnitDue(pu, history)) continue; // unknown, or already learned
      if (seen.has(pg)) continue;
      seen.add(pg);
      if (depth + 1 > maxDepth) return false; // this component sits too deep
      if (!visit(pg, depth + 1)) return false; // its own prereqs first…
      chain.push(pu); //                          …then the component's primary unit
    }
    return true;
  };
  return visit(glyph, 0) ? chain : null;
}

/**
 * The pure core, factored out like `planLesson` so the depth gate is testable at
 * any `maxDepth`. Walk `order`; for each DUE unit gather its glyph's untaught
 * prereq primary units (dependency order), DEPTH-GATE anything whose untaught
 * chain runs past `maxDepth`, and fill toward the `range` floor — never past its
 * ceiling except a lone bundle that is oversized on its own. Dedupe by unit key so
 * a shared prerequisite (or a re-reached unit) is never taught twice; always emit
 * at least one unit if any is due.
 */
export function planUnitLesson(
  order: readonly PronunciationUnit[],
  history: HistoryFile,
  range: LessonRange,
  maxDepth: number = MAX_PREREQ_DEPTH,
): PronunciationUnit[] {
  const out: PronunciationUnit[] = [];
  const emitted = new Set<string>();
  let spent = 0;
  for (const unit of order) {
    if (!isUnitDue(unit, history)) continue;
    const chain = prereqChain(unit.glyph, history, maxDepth);
    if (!chain) continue; // untaught-prereq chain too deep → defer this unit
    const bundle = [...chain, unit];
    const fresh = bundle.filter((u) => !emitted.has(unitKey(u)));
    const add = fresh.reduce((n, u) => n + unitCost(u), 0);
    // Never cross the ceiling — but a lone bundle bigger than the whole range is
    // taught anyway, so a due unit can't yield an empty lesson.
    if (out.length > 0 && spent + add > range.max) break;
    for (const u of fresh) {
      out.push(u);
      emitted.add(unitKey(u));
    }
    spent += add;
    if (spent >= range.min) break; // floor reached → stop
  }
  return out;
}

/**
 * The next lesson's worth of teaching units for a curriculum glyph sequence, wired
 * to history. `orderedUnits` supplies the frequency walk; dueness/cost come from
 * teach-unit.ts; prerequisites resolve across the whole corpus (`resolveItem`). A
 * PURE function of history — nothing is memoised or mutated.
 *
 * Returns the units in teach order (prereqs before the unit that needs them), or
 * null when nothing in `glyphs` is due.
 */
export function nextUnitLesson(
  glyphs: readonly string[],
  history: HistoryFile,
  range: LessonRange,
): UnitLesson | null {
  const units = planUnitLesson(orderedUnits(glyphs), history, range);
  return units.length ? { units } : null;
}
