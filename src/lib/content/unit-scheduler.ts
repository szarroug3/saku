// UNIT SCHEDULER — the same lesson walk as `scheduler.ts` (planLesson), but over
// TEACHING UNITS (teach-unit.ts) instead of whole ContentItems. A unit is one
// SKILL: a pronunciation of a glyph, a keigo set, a grammar pattern, a verb pair.
// This schedules "teach 人 ひと (person)" before "teach 人 じん (-ian)" by how often
// each reading is spoken — the grain planLesson's per-item walk can't express —
// and, uniformly, any other track's units in that track's own order.
//
// POLYMORPHIC over the BASE unit. The walk reads only the base contract (`item`,
// `facts`, `cost`) via `isUnitDue`/`unitCost`, so a due unit can be ANY kind. The
// ORDER is the caller's — the pronunciation track interleaves by frequency
// (`orderedUnits`), every other track supplies its curriculum sequence. The
// scheduler never orders; it fills, gates, and dedupes.
//
// It does NOT re-derive anything. Cost, dueness and the unit split come from
// teach-unit.ts; the prereq graph and corpus lookup from build-item and resolve;
// the budget/depth SEMANTICS mirror planLesson exactly (fill toward the floor,
// never past the ceiling save a lone oversized bundle; defer a unit whose
// untaught-prereq chain runs past MAX_PREREQ_DEPTH).
//
// PREREQUISITES ACROSS THE UNIT GRAIN. A prerequisite lives on the ITEM
// (`ContentItem.prereqs`) — 何 is built on 人 and 可 regardless of which reading is
// being taught; a verb pair needs its kanji; a keigo set its plain verb. Every
// prereq edge points at a glyph the learner "meets" through its PRIMARY unit (its
// most-spoken reading), so a prereq is satisfied by that primary pronunciation
// unit. The chain a unit pulls is its item's untaught prereq glyphs, each as its
// primary unit, in dependency order. (A prereq the corpus can't yet resolve — a
// word, until the word track migrates `resolveItem` — is skipped, not a gate.)

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
import type { PronunciationUnit, TeachingUnit, UnitLesson } from "./teach-unit";
import type { ContentItem } from "./item";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { EntryId, HistoryFile } from "@/types";

/** A glyph's PRIMARY unit — its most-spoken reading, the one a learner "meets the
 * glyph" through. Undefined when the glyph builds no teachable item. This is the
 * unit a prerequisite edge onto the glyph is satisfied by. */
function primaryUnit(glyph: string): PronunciationUnit | undefined {
  const item = buildGlyphItem(glyph);
  if (!item) return undefined;
  return [...pronunciationUnitsOf(item)].sort(byFrequencyDesc)[0];
}

/** The dedupe identity of a unit within one lesson. A pronunciation unit is one
 * reading of its item (entry + reading); every other kind is one unit per item,
 * so its entry is enough. A reading-null (meaning-only) unit gets a stable key. */
function unitKey(unit: TeachingUnit): string {
  const entry = String(unit.item.entry);
  return unit.kind === "pronunciation" ? `${entry}␟${unit.reading ?? ""}` : entry;
}

/**
 * An item's still-untaught prerequisite PRIMARY units, in dependency order
 * (prereqs first), or null if any untaught branch runs deeper than `maxDepth`.
 * Mirrors `untaughtChain` in scheduler.ts: a learned component stops the walk (it
 * doesn't extend the chain), so an item's effective depth shrinks as its
 * components are learned and the gate lifts on its own. The item's OWN unit is not
 * included — the caller appends the specific due unit it is scheduling.
 */
function prereqChain(
  item: ContentItem,
  history: HistoryFile,
  maxDepth: number,
): PronunciationUnit[] | null {
  const chain: PronunciationUnit[] = [];
  const seen = new Set<string>();
  if (item.glyph) seen.add(item.glyph); // the item itself never re-enters as a prereq
  const visit = (prereqs: readonly EntryId[], depth: number): boolean => {
    for (const p of prereqs) {
      const pg = resolveItem(p)?.glyph;
      if (pg == null) continue; // not in the corpus we can reach → not a gate
      const pu = primaryUnit(pg);
      if (!pu || !isUnitDue(pu, history)) continue; // unknown, or already learned
      if (seen.has(pg)) continue;
      seen.add(pg);
      if (depth + 1 > maxDepth) return false; // this component sits too deep
      const pit = buildGlyphItem(pg);
      if (pit && !visit(pit.prereqs, depth + 1)) return false; // its own prereqs first…
      chain.push(pu); //                                          …then the component's primary unit
    }
    return true;
  };
  return visit(item.prereqs, 0) ? chain : null;
}

/**
 * The pure core, factored out like `planLesson` so the depth gate is testable at
 * any `maxDepth`. Walk `order`; for each DUE unit gather its item's untaught prereq
 * primary units (dependency order), DEPTH-GATE anything whose untaught chain runs
 * past `maxDepth`, and fill toward the `range` floor — never past its ceiling except
 * a lone bundle that is oversized on its own. Dedupe by unit key so a shared
 * prerequisite (or a re-reached unit) is never taught twice; always emit at least
 * one unit if any is due. Uniform over the base unit — `order` is the track's.
 */
export function planUnitLesson(
  order: readonly TeachingUnit[],
  history: HistoryFile,
  range: LessonRange,
  maxDepth: number = MAX_PREREQ_DEPTH,
): TeachingUnit[] {
  const out: TeachingUnit[] = [];
  const emitted = new Set<string>();
  let spent = 0;
  for (const unit of order) {
    if (!isUnitDue(unit, history)) continue;
    const chain = prereqChain(unit.item, history, maxDepth);
    if (!chain) continue; // untaught-prereq chain too deep → defer this unit
    const bundle: TeachingUnit[] = [...chain, unit];
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
 * The next lesson's units for a track's own ORDERED units, wired to history. The
 * track owns the order (frequency, curriculum sequence, …); the scheduler supplies
 * dueness, cost, prerequisites, budget and the depth gate. A PURE function of
 * history. Returns the units in teach order (prereqs before the unit that needs
 * them), or null when nothing in `order` is due.
 */
export function nextTrackLesson(
  order: readonly TeachingUnit[],
  history: HistoryFile,
  range: LessonRange,
): UnitLesson | null {
  const units = planUnitLesson(order, history, range);
  return units.length ? { units } : null;
}

/**
 * The next lesson's worth of teaching units for a curriculum glyph sequence — the
 * PRONUNCIATION track's entry, ordered by how often each reading is spoken
 * (`orderedUnits`). A thin wrapper over `nextTrackLesson` with that ordering.
 */
export function nextUnitLesson(
  glyphs: readonly string[],
  history: HistoryFile,
  range: LessonRange,
): UnitLesson | null {
  return nextTrackLesson(orderedUnits(glyphs), history, range);
}
