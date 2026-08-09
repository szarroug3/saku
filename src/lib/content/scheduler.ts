// The ONE scheduler — every track shares it. It never re-implements per-track
// logic; it walks the prerequisite DAG (edges live on each ContentItem, see
// item.ts) and fills a lesson budget. This is what collapses ~8 hand-rolled
// `nextXLesson` functions into one, and where the ordering bugs (a rule card
// reachable before its prereqs; 10+ taught before 5) stop being possible.
//
// ALGORITHM (Stage 3 implements; the contract is fixed here):
//   1. Walk the active track's order (Track.order) for the next UNKNOWN items.
//   2. For each, gather its UNTAUGHT prerequisites transitively — from ANY track;
//      a number freely pulls a non-number kanji owned by the word track, and the
//      scheduler teaches it here regardless of which track "owns" it.
//   3. Emit items in dependency order, each preceded by its untaught prereqs,
//      until the LessonRange budget is full (always at least one item).
//   4. DEPTH GATE: defer an item whose untaught-prereq chain is deeper than
//      MAX_PREREQ_DEPTH — too much cascade to teach in one sitting. It resurfaces
//      once its deep prereqs are learned (on their own, or in earlier lessons)
//      and the chain is shallow enough. This one rule replaces the counters
//      track's prepOnly/marker machinery.
//
// Stage 0 of docs/architecture-refactor.md: the contract and the gate constant.
// Additive, not yet consumed.

import { effectiveState } from "@/lib/claims";
import { glyphDifficulty } from "@/lib/difficulty";
import type { EntryId, FactId, HistoryFile } from "@/types";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { ContentItem } from "./item";
import type { Track } from "./track";

/**
 * The deepest chain of UNTAUGHT prerequisites the scheduler will teach at once.
 * A>B>C>D>E with nothing known is too much cascade for one lesson, so the item
 * requesting it is deferred until enough of the chain is learned that the
 * remaining depth is within this bound.
 */
export const MAX_PREREQ_DEPTH = 3;

/** One lesson: items to teach in dependency order (each prereq before the item
 * that needs it). The shared viewport renders them, and preview / HUD / resume
 * read this SAME array, so none of them can disagree with what is taught. */
export interface Lesson {
  readonly items: readonly ContentItem[];
}

/**
 * The single scheduler. A track supplies only its order; `resolve` maps an entry
 * to its item so cross-track prerequisites can be looked up. A PURE function of
 * history — the resume position is derived from the same walk, never re-computed
 * elsewhere.
 */
export type NextLesson = (
  track: Track,
  resolve: (entry: EntryId) => ContentItem | undefined,
  history: HistoryFile,
  range: LessonRange,
) => Lesson | null;

/**
 * The pure heart of the scheduler, factored out of history so it can be tested on
 * its own. `nextLesson` (next piece) supplies `isDue` (a fresh fact) and `cost`
 * (reading-units) from history and calls this.
 *
 * Walk `order`; for each DUE item gather its untaught-prereq chain (dependency
 * order, prereqs first, following `resolve` across tracks); DEPTH-GATE anything
 * whose untaught chain runs past `maxDepth`; and fill toward the `range` floor,
 * never past its ceiling except a lone bundle that is oversized on its own — the
 * same two-number semantics the kanji/word packers already use (lesson-sizing.ts).
 */
export function planLesson(
  order: readonly ContentItem[],
  resolve: (entry: EntryId) => ContentItem | undefined,
  isDue: (item: ContentItem) => boolean,
  cost: (item: ContentItem) => number,
  range: LessonRange,
  maxDepth: number = MAX_PREREQ_DEPTH,
): ContentItem[] {
  const out: ContentItem[] = [];
  const emitted = new Set<EntryId>();
  let spent = 0;
  for (const item of order) {
    if (!isDue(item)) continue;
    const chain = untaughtChain(item, resolve, isDue, maxDepth);
    if (!chain) continue; // untaught-prereq chain too deep → defer this item
    const fresh = chain.filter((i) => !emitted.has(i.entry));
    const add = fresh.reduce((n, i) => n + cost(i), 0);
    // Never cross the ceiling — but a lone bundle bigger than the whole range is
    // taught anyway, so a due item can't yield an empty lesson.
    if (out.length > 0 && spent + add > range.max) break;
    for (const i of fresh) {
      out.push(i);
      emitted.add(i.entry);
    }
    spent += add;
    if (spent >= range.min) break; // floor reached → stop
  }
  return out;
}

/**
 * An item preceded by its still-untaught prerequisites, in dependency order, or
 * null if any untaught branch runs deeper than `maxDepth`. Learned prereqs stop
 * the walk (they don't extend the chain), so an item's depth shrinks as its
 * prereqs are learned — the gate lifts on its own.
 */
function untaughtChain(
  item: ContentItem,
  resolve: (entry: EntryId) => ContentItem | undefined,
  isDue: (item: ContentItem) => boolean,
  maxDepth: number,
): ContentItem[] | null {
  const chain: ContentItem[] = [];
  const seen = new Set<EntryId>();
  const visit = (it: ContentItem, depth: number): boolean => {
    if (seen.has(it.entry)) return true;
    seen.add(it.entry);
    if (depth > maxDepth) return false;
    for (const p of it.prereqs) {
      const pi = resolve(p);
      if (!pi || !isDue(pi)) continue; // unknown to us, or already learned
      if (!visit(pi, depth + 1)) return false;
    }
    chain.push(it); // after its prereqs
    return true;
  };
  return visit(item, 0) ? chain : null;
}

/**
 * The one scheduler, wired to history. It supplies `planLesson`'s two injectables
 * from existing sources — nothing new is modeled here:
 *   - DUE = the item has a FRESH fact (`lastTested === 0` off `effectiveState`,
 *     the same rule every track reads per fact);
 *   - COST = `glyphDifficulty` (reading-units), the packers' own pricing.
 * A track supplies only its order; `resolve` reaches items in any track so a
 * number can pull a word-track kanji as a prerequisite.
 */
export const nextLesson: NextLesson = (track, resolve, history, range) => {
  const isDue = (item: ContentItem) =>
    item.facts.some((f) => isFactFresh(f.id, history));
  const cost = (item: ContentItem) => glyphDifficulty(item.glyph);
  const items = planLesson(track.order(history), resolve, isDue, cost, range);
  return items.length ? { items } : null;
};

/** A fact the app has no record of — never answered, claimed, or "quiz me"'d.
 * The one definition of "new", shared with the per-track schedulers. */
function isFactFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}
