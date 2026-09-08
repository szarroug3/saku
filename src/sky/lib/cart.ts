// The Planetarium's cart: what tonight's picks cost, what each brings, what
// is locked and what the cart itself opens. Tracked as SAK-303 and SAK-304.
//
// Reads the prerequisite graph and adds no arithmetic of its own: a pick
// costs every distinct piece it adds (graph.costOf), the cart's total is
// graph.pieceCount, and the two must agree, which the test pins. What this
// file adds is the RULES of picking:
//
//   - a part (a kanji, a radical, one kana of a row) never locks anything:
//     it comes along with the pick and is charged. What locks is a
//     prerequisite that is picked as its own thing: the word a verb pair or
//     keigo form attaches to, or a kana row another row builds on. Such a
//     pick is available once that prerequisite is learned OR in the cart.
//   - removing a pick removes whatever it was holding open.
//   - the cap applies to one lesson, never to the sky. Going over is
//     allowed and warned (Sam's rule; a placeholder of 12 until there is data).

import type { PickCost, PrerequisiteGraph, Learned } from "./graph";
import type { SkyKind, SkyItem } from "./types";

/** A comfortable lesson, in pieces. A placeholder until there is data on how
 * often people go over and how long picked-but-unlearned things sit. */
export const COMFORTABLE_PIECES = 12;

/** Kinds that are picked as their own thing, and so can lock what needs them. */
const PICKED_AS_OWN: ReadonlySet<SkyKind> = new Set(["word", "counter", "grammar", "sentence", "verbPair", "keigo"]);

/** True when an item is chosen on its own in the Planetarium, rather than
 * riding along under something else: every kind but the parts, plus a kana
 * row (a kana with components), but not a single kana. */
export function isPickable(item: SkyItem): boolean {
  if (PICKED_AS_OWN.has(item.kind)) return true;
  return item.kind === "kana" && (item.components?.length ?? 0) > 0;
}

/** The direct prerequisites of `id` that lock it: those picked as their own thing. */
export function locksOn(graph: PrerequisiteGraph, id: string): string[] {
  return graph.prerequisitesOf(id).filter((p) => { const it = graph.itemOf(p); return !!it && isPickable(it); });
}

interface PickState {
  /** Can be picked now: every locking prerequisite is learned or in the cart. */
  available: boolean;
  /** Locking prerequisites neither learned nor in the cart. */
  needs: string[];
  /** Locking prerequisites the cart supplies: this pick is open only because of them. */
  openedByCart: string[];
}

const has = (learned: Learned, id: string) => (typeof learned === "function" ? learned(id) : learned.has(id));

export function pickState(graph: PrerequisiteGraph, id: string, learned: Learned, picks: readonly string[]): PickState {
  const needs: string[] = [], openedByCart: string[] = [];
  for (const p of locksOn(graph, id)) {
    if (has(learned, p)) continue;
    if (picks.includes(p)) openedByCart.push(p);
    else needs.push(p);
  }
  return { available: needs.length === 0, needs, openedByCart };
}

interface PickLine {
  id: string;
  /** Beside what is learned and what earlier picks bring. */
  cost: PickCost;
}

interface CartSummary {
  lines: PickLine[];
  /** Distinct new pieces for the whole cart: what the lesson will teach. */
  pieces: number;
  /** How far past the cap, or 0. */
  over: number;
}

export function cartSummary(graph: PrerequisiteGraph, picks: readonly string[], learned: Learned, cap = COMFORTABLE_PIECES): CartSummary {
  const lines = picks.map((id, i) => ({ id, cost: graph.costOf(id, learned, picks.slice(0, i)) }));
  const pieces = graph.pieceCount(picks, learned);
  return { lines, pieces, over: Math.max(0, pieces - cap) };
}

/** The cart with `id` removed, and with it every pick that was open only
 * because `id` was there (and so on down). Order is kept. */
export function withoutPick(graph: PrerequisiteGraph, picks: readonly string[], id: string, learned: Learned): string[] {
  let next = picks.filter((p) => p !== id);
  for (;;) {
    const kept = next.filter((p) => pickState(graph, p, learned, next).available);
    if (kept.length === next.length) return kept;
    next = kept;
  }
}

/** What a pick brings, by kind, not counting the pick itself: "1 kanji, 2
 * pieces under it". `free` are the learned prerequisites it would have
 * needed; `shared` the ones an earlier pick already brings. */
interface PickBreakdown {
  brings: Partial<Record<SkyKind, number>>;
  free: SkyItem[];
  shared: SkyItem[];
}

export function pickBreakdown(graph: PrerequisiteGraph, line: PickLine): PickBreakdown {
  const brings: Partial<Record<SkyKind, number>> = {};
  for (const p of line.cost.pieces) {
    if (p === line.id) continue;
    const kind = graph.itemOf(p)?.kind;
    if (kind) brings[kind] = (brings[kind] ?? 0) + 1;
  }
  const items = (ids: readonly string[]) => ids.map((i) => graph.itemOf(i)).filter((x): x is SkyItem => !!x);
  return { brings, free: items(line.cost.free), shared: items(line.cost.shared) };
}
