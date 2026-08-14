// UNIT SCHEDULER CORE — the pure lesson walk, factored out of unit-scheduler.ts
// so it can run WITHOUT the content dictionary.
//
// WHY THIS FILE EXISTS. The lesson walk itself (dueness, cost, budget, the depth
// gate, prereq bundling) reads only a unit's SCHEDULING data: `kind`, `scheduling`,
// `cost`, `facts`, and `item.{entry, glyph, prereqs, blockedBy}`. None of that is
// content — no glosses, no readings prose, no frequency tables. But the ORIGINAL
// unit-scheduler.ts reached three things through content modules: `resolveItem` +
// the primary-unit build (to pull a prereq's unit into the lesson), `factsOf` (to
// tell whether a blocking prerequisite is learned), and `isFactFresh` (dueness).
//
// This core takes those three as INJECTED DEPS instead. unit-scheduler.ts binds
// them to the content-backed originals (unchanged behaviour, unchanged public API);
// the /learn loader (learn-index.ts) binds them to a PRECOMPUTED index, so /learn
// runs the exact same walk over the exact same numbers without importing the
// dictionary. The control flow below is a verbatim port of the original
// `planUnitLesson`/`prereqChain` — only the three content touch-points became deps.
//
// GENERIC over the unit type `U`. The content path threads the full `TeachingUnit`
// through (so its callers keep the concrete type); the /learn path threads the
// serialized `IndexUnit`. Both satisfy `SchedulableUnit`, which is all the walk
// reads.

import { effectiveState } from "@/lib/claims";
import type { EntryId, FactId, HistoryFile } from "@/types";
import type { LessonRange } from "@/lib/lesson-sizing";

/** The scheduling-only view of a content item — the fields the walk reads, and
 * NOTHING a content module has to build. Both `ContentItem` and the serialized
 * `IndexItem` satisfy it. */
export interface SchedulableItem {
  readonly entry: EntryId;
  readonly glyph: string;
  readonly prereqs: readonly EntryId[];
  readonly blockedBy: readonly EntryId[];
}

/** The scheduling-only view of a teaching unit. `TeachingUnit` (content) and
 * `IndexUnit` (precomputed) both satisfy it; the walk never reaches for a
 * type-specific field (meanings, rule, …). `reading` is present only on
 * pronunciation units and used solely for the dedupe key, so it is optional. */
export interface SchedulableUnit {
  readonly kind: string;
  readonly scheduling?: "cost" | "unit";
  readonly reading?: string | null;
  readonly cost: number;
  readonly facts: readonly FactId[];
  readonly item: SchedulableItem;
}

/** A prerequisite entry resolved to the PRIMARY unit the learner meets it
 * through, plus the data the chain walk needs to recurse: the component's glyph
 * (dedupe key) and its own prerequisites. Mirrors, per entry, what the original
 * `resolveItem(p)` + `primaryUnit(pg)` + `buildGlyphItem(pg).prereqs` produced. */
export interface ResolvedPrereq<U extends SchedulableUnit> {
  readonly glyph: string;
  readonly prereqs: readonly EntryId[];
  readonly unit: U;
}

/** The three content touch-points the walk needs, injected. The content-backed
 * bindings live in unit-scheduler.ts; the precomputed ones in learn-index.ts. */
export interface SchedulerDeps<U extends SchedulableUnit> {
  /** A fact the app has no record of — the one definition of "new". */
  isFactFresh(fact: FactId, history: HistoryFile): boolean;
  /** Resolve a prereq entry to its primary unit, or undefined when the corpus
   * can't reach it (then it is not a gate — skipped, exactly as before). */
  resolvePrereq(entry: EntryId): ResolvedPrereq<U> | undefined;
  /** Whether a BLOCKING prerequisite entry is learned — it has facts and all of
   * them are claimed. An entry with no facts is never learned. */
  isLearned(entry: EntryId, history: HistoryFile): boolean;
}

/** The default depth gate — an untaught-prereq chain deeper than this defers the
 * unit. Kept in sync with `MAX_PREREQ_DEPTH` in scheduler.ts. */
export const MAX_PREREQ_DEPTH = 3;

/** A fact the app has no record of — never answered, claimed, or "quiz me"'d.
 * The one definition of "new", identical to scheduler.ts's `isFactFresh` but
 * carrying no content import, so both the content and precomputed deps share it. */
export function isFactFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

/** A unit is DUE (not yet learned) when any of its facts is still fresh. */
function isUnitDue<U extends SchedulableUnit>(
  unit: U,
  history: HistoryFile,
  isFresh: SchedulerDeps<U>["isFactFresh"],
): boolean {
  return unit.facts.some((id) => isFresh(id, history));
}

/** The dedupe identity of a unit within one lesson. A pronunciation unit is one
 * reading of its item (entry + reading); every other kind is one unit per item,
 * so its entry is enough. A reading-null (meaning-only) unit gets a stable key.
 * Byte-identical to the original `unitKey`. */
function unitKey<U extends SchedulableUnit>(unit: U): string {
  const entry = String(unit.item.entry);
  return unit.kind === "pronunciation" ? `${entry}␟${unit.reading ?? ""}` : entry;
}

/**
 * An item's still-untaught prerequisite PRIMARY units, in dependency order
 * (prereqs first), or null if any untaught branch runs deeper than `maxDepth`.
 * A verbatim port of the original `prereqChain`: a learned component stops the
 * walk (it doesn't extend the chain), so an item's effective depth shrinks as its
 * components are learned. The item's OWN unit is not included — the caller appends
 * the specific due unit it is scheduling. The only change from the original is that
 * `resolveItem(p)?.glyph` + `primaryUnit(pg)` + `buildGlyphItem(pg).prereqs` are
 * now the single injected `deps.resolvePrereq(p)`.
 */
function prereqChain<U extends SchedulableUnit>(
  item: SchedulableItem,
  history: HistoryFile,
  maxDepth: number,
  deps: SchedulerDeps<U>,
): U[] | null {
  const chain: U[] = [];
  const seen = new Set<string>();
  if (item.glyph) seen.add(item.glyph); // the item itself never re-enters as a prereq
  const visit = (prereqs: readonly EntryId[], depth: number): boolean => {
    for (const p of prereqs) {
      const resolved = deps.resolvePrereq(p);
      if (!resolved) continue; // not in the corpus we can reach → not a gate
      const pu = resolved.unit;
      if (!isUnitDue(pu, history, deps.isFactFresh)) continue; // already learned
      if (seen.has(resolved.glyph)) continue;
      seen.add(resolved.glyph);
      if (depth + 1 > maxDepth) return false; // this component sits too deep
      if (!visit(resolved.prereqs, depth + 1)) return false; // its own prereqs first…
      chain.push(pu); //                                        …then the component's primary unit
    }
    return true;
  };
  return visit(item.prereqs, 0) ? chain : null;
}

/**
 * The pure core of the lesson walk — a verbatim port of the original
 * `planUnitLesson`, with the three content touch-points taken as `deps`. Walk
 * `order`; for each DUE unit gather its item's untaught prereq primary units
 * (dependency order), DEPTH-GATE anything whose untaught chain runs past
 * `maxDepth`, and fill toward the `range` floor — never past its ceiling except a
 * lone bundle oversized on its own. Dedupe by unit key. Uniform over the base unit.
 */
export function planUnitLessonCore<U extends SchedulableUnit>(
  order: readonly U[],
  history: HistoryFile,
  range: LessonRange,
  deps: SchedulerDeps<U>,
  maxDepth: number = MAX_PREREQ_DEPTH,
  start: number = 0,
): U[] {
  const out: U[] = [];
  const emitted = new Set<string>();
  let spent = 0;
  for (let i = start; i < order.length; i++) {
    const unit = order[i];
    if (!isUnitDue(unit, history, deps.isFactFresh)) continue;
    // BLOCKING gate: a unit whose item is blocked by an unlearned dependency is
    // deferred and its blockers are NOT pulled in.
    if (unit.item.blockedBy.some((e) => !deps.isLearned(e, history))) continue;
    // A "unit"-scheduled unit IS a whole lesson: never combined with others.
    const soloLesson = unit.scheduling === "unit";
    if (soloLesson && out.length > 0) break;
    const chain = prereqChain(unit.item, history, maxDepth, deps);
    if (!chain) continue; // untaught-prereq chain too deep → defer this unit
    const bundle: U[] = [...chain, unit];
    const fresh = bundle.filter((u) => !emitted.has(unitKey(u)));
    const add = fresh.reduce((n, u) => n + u.cost, 0);
    // Never cross the ceiling — but a lone bundle bigger than the whole range is
    // taught anyway, so a due unit can't yield an empty lesson.
    if (out.length > 0 && spent + add > range.max) break;
    for (const u of fresh) {
      out.push(u);
      emitted.add(unitKey(u));
    }
    spent += add;
    if (soloLesson) break; // this unit is the entire lesson
    if (spent >= range.min) break; // floor reached → stop
  }
  return out;
}

/** One lesson's worth of teaching units, in teach order (prereqs first). Generic
 * so each path keeps its own unit type. */
export interface UnitLessonOf<U extends SchedulableUnit> {
  readonly units: readonly U[];
}

/**
 * The next lesson's units for a track's own ORDERED units, wired to history and
 * the injected deps. A PURE function of history. Returns the units in teach order,
 * or null when nothing in `order` is due. The core of both `nextTrackLesson`
 * (content) and the /learn frontier (precomputed).
 */
export function nextTrackLessonCore<U extends SchedulableUnit>(
  order: readonly U[],
  history: HistoryFile,
  range: LessonRange,
  deps: SchedulerDeps<U>,
  start: number = 0,
): UnitLessonOf<U> | null {
  const units = planUnitLessonCore(order, history, range, deps, MAX_PREREQ_DEPTH, start);
  return units.length ? { units } : null;
}
