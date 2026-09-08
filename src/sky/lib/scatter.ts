// Scatter placement: where each constellation lands on a sky. Tracked as
// SAK-333.
//
// Every constellation gets a square box sized by its star count and a place
// seeded by its own key, nudged until it overlaps nothing placed before it,
// so a word keeps its place night after night and a new word finds a gap
// without moving the others. Rejection sampling with a bounded number of
// tries, then a seeded sweep of the whole sky for any free spot (a small
// sky with three boxes has room the random tries can all miss); only when
// there is none does the first candidate stand, which is the honest failure
// for a sky that is simply full.

import { hashUnit } from "./constellation";

interface ScatterItem {
  /** Seeds the placement. The item's id. */
  key: string;
  /** The box's side, in sky units. */
  size: number;
}

export interface Placed<T extends ScatterItem = ScatterItem> {
  item: T;
  /** Top-left corner and side of the box, in sky units. */
  x: number;
  y: number;
  size: number;
}

const TRIES = 100;

/* THE NEIGHBOURHOOD GRID
 *
 * A clash test asks "does this box hit anything already down". Asking every
 * box makes the scatter quadratic, which the sky felt the moment it held
 * every word rather than only kana and kanji (Sam, 2026-09-06: nothing is
 * excluded from the Planetarium): fifteen thousand boxes took 1.7 seconds,
 * on the server for the first paint and again on the client, and again on
 * every change to what is shown.
 *
 * So the sky is divided into cells and each box is registered in EVERY cell
 * it touches. Two boxes that overlap share a point, that point is in one
 * cell, and both are registered there, so a box that would clash is always
 * among the candidates of a cell the query touches. The test itself is
 * unchanged and so is every placement: this only makes the candidate list
 * short. The cell is the biggest box plus the padding, so a query spans at
 * most three cells on a side. */
interface Grid<T extends ScatterItem> {
  cell: number;
  cols: number;
  cells: Map<number, Placed<T>[]>;
}

function makeGrid<T extends ScatterItem>(w: number, cell: number): Grid<T> {
  const c = Math.max(1, cell);
  return { cell: c, cols: Math.ceil(Math.max(0, w) / c) + 2, cells: new Map() };
}

/** The keys of every cell a box touches. Anything below zero clamps to the
 * first cell, which costs nothing: no box is ever placed there. */
function keysOf<T extends ScatterItem>(g: Grid<T>, x: number, y: number, w: number, h: number, into: number[]): number[] {
  into.length = 0;
  const x0 = Math.max(0, Math.floor(x / g.cell)), x1 = Math.max(0, Math.floor((x + w) / g.cell));
  const y0 = Math.max(0, Math.floor(y / g.cell)), y1 = Math.max(0, Math.floor((y + h) / g.cell));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) into.push(cy * g.cols + cx);
  return into;
}

const SCRATCH: number[] = [];

function addToGrid<T extends ScatterItem>(g: Grid<T>, box: Placed<T>): void {
  for (const k of keysOf(g, box.x, box.y, box.size, box.size, SCRATCH)) {
    const cell = g.cells.get(k);
    if (cell) cell.push(box); else g.cells.set(k, [box]);
  }
}

/** Whether a box of `size` at x, y would overlap anything in the grid,
 * `pad` allowed between them. The same test the whole file uses. */
function clashes<T extends ScatterItem>(g: Grid<T>, x: number, y: number, size: number, pad: number): boolean {
  for (const k of keysOf(g, x - pad, y - pad, size + pad * 2, size + pad * 2, SCRATCH)) {
    const cell = g.cells.get(k);
    if (!cell) continue;
    for (const p of cell) if (x < p.x + p.size + pad && x + size + pad > p.x && y < p.y + p.size + pad && y + size + pad > p.y) return true;
  }
  return false;
}

/** Places items in order into a w by h sky, keeping `pad` between boxes and
 * from the edges. Larger items should come first: they are the hardest to fit. */
export function scatterLayout<T extends ScatterItem>(items: readonly T[], w: number, h: number, pad: number): Placed<T>[] {
  const placed: Placed<T>[] = [];
  const biggest = items.reduce((n, i) => Math.max(n, i.size), 0);
  const g = makeGrid<T>(w, biggest + pad * 2);
  for (const item of items) {
    const size = Math.min(item.size, Math.max(1, Math.min(w, h) - pad * 2));
    let first: { x: number; y: number } | null = null;
    let found: { x: number; y: number } | null = null;
    for (let t = 0; t < TRIES && !found; t++) {
      const x = pad + hashUnit(`${item.key}#x${t}`) * Math.max(0, w - size - pad * 2);
      const y = pad + hashUnit(`${item.key}#y${t}`) * Math.max(0, h - size - pad * 2);
      first ??= { x, y };
      if (!clashes(g, x, y, size, pad)) found = { x, y };
    }
    const at = found ?? sweep(item.key, size, w, h, pad, g) ?? first ?? { x: pad, y: pad };
    // rounded before it goes in the grid, so a later test sees the same
    // numbers the caller does and the placement stays exactly reproducible
    const box = { item, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100, size };
    placed.push(box);
    addToGrid(g, box);
  }
  return placed;
}

/** Every spot on a grid across the sky, starting from a seeded corner of
 * it, until one is clear. Deterministic, so a word still keeps its place. */
function sweep<T extends ScatterItem>(key: string, size: number, w: number, h: number, pad: number, g: Grid<T>): { x: number; y: number } | null {
  const step = Math.max(4, Math.round(Math.min(size, pad * 2) / 2));
  const xs: number[] = [], ys: number[] = [];
  for (let x = pad; x <= w - size - pad + 1e-6; x += step) xs.push(x);
  for (let y = pad; y <= h - size - pad + 1e-6; y += step) ys.push(y);
  if (!xs.length || !ys.length) return null;
  const ox = Math.floor(hashUnit(`${key}#sx`) * xs.length), oy = Math.floor(hashUnit(`${key}#sy`) * ys.length);
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const x = xs[(i + ox) % xs.length], y = ys[(j + oy) % ys.length];
    if (!clashes(g, x, y, size, pad)) return { x, y };
  }
  return null;
}

/** How full a scatter can pack its boxes before the tries run out and
 * things start to overlap; the world is sized so the boxes never take more
 * of it than this. */
const PACKING = 0.35;

/** A world big enough for these boxes, in a 4:3 shape, never smaller than
 * `min`. Grows with what the learner has: a sky of thirty words fits the
 * minimum, a sky of five hundred gets the room it needs and is seen by
 * panning and zooming out, not by overlapping. Rounded to whole units. */
export function worldFor(items: readonly ScatterItem[], pad: number, min: { width: number; height: number }): { width: number; height: number } {
  const needed = items.reduce((sum, b) => sum + (b.size + pad) ** 2, 0) / PACKING;
  const aspect = min.width / min.height;
  const width = Math.max(min.width, Math.ceil(Math.sqrt(needed * aspect)));
  return { width, height: Math.max(min.height, Math.ceil(width / aspect)) };
}

/** True when any two placed boxes overlap, allowing for the padding. Each
 * box is tested against the neighbourhood of those before it, so the answer
 * is the same as comparing every pair and the cost is not. */
export function anyOverlap(placed: readonly Placed[], pad: number): boolean {
  let biggest = 0, width = 0;
  for (const p of placed) { biggest = Math.max(biggest, p.size); width = Math.max(width, p.x + p.size); }
  const g = makeGrid<ScatterItem>(width, biggest + pad * 2);
  for (const p of placed) {
    if (clashes(g, p.x, p.y, p.size, pad)) return true;
    addToGrid(g, p);
  }
  return false;
}

/** How much the world grows each time a scatter comes out overlapping. */
const GROWTH = 1.25;
const GROWTH_STEPS = 8;

/** Boxes scattered into a world at least `min` in size, grown until they
 * all fit clean: the area rule (`worldFor`) says roughly how big, and the
 * scatter says whether that was enough. Boxes are placed largest first and,
 * at a size, by key, so the same set lands the same way whatever order it
 * came in. Deterministic throughout. */
export function scatterInWorld<T extends ScatterItem>(items: readonly T[], min: { width: number; height: number }, pad: number): { placed: Placed<T>[]; world: { width: number; height: number } } {
  const ordered = [...items].sort((a, b) => b.size - a.size || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let world = worldFor(ordered, pad, min);
  let placed = scatterLayout(ordered, world.width, world.height, pad);
  for (let step = 0; step < GROWTH_STEPS && anyOverlap(placed, pad); step++) {
    world = { width: Math.ceil(world.width * GROWTH), height: Math.ceil(world.height * GROWTH) };
    placed = scatterLayout(ordered, world.width, world.height, pad);
  }
  return { placed, world };
}

/** True when two placed boxes overlap, allowing for the padding. */
export function overlaps(a: Placed, b: Placed, pad = 0): boolean {
  return a.x < b.x + b.size + pad && a.x + a.size + pad > b.x && a.y < b.y + b.size + pad && a.y + a.size + pad > b.y;
}
