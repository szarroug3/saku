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

export interface ScatterItem {
  /** Seeds the placement. The item's id. */
  key: string;
  /** The box's side, in sky units. */
  size: number;
  /** Keep it near the middle of the sky: candidates fall within this
   * fraction of the world's width and height around the centre (0.12 puts
   * everything so marked within a window of the sky). The planets and
   * asteroids sit together at the heart of the sky; the stars go anywhere. */
  near?: number;
}

export interface Placed<T extends ScatterItem = ScatterItem> {
  item: T;
  /** Top-left corner and side of the box, in sky units. */
  x: number;
  y: number;
  size: number;
}

const TRIES = 100;

/** Places items in order into a w by h sky, keeping `pad` between boxes and
 * from the edges. Larger items should come first: they are the hardest to fit. */
export function scatterLayout<T extends ScatterItem>(items: readonly T[], w: number, h: number, pad: number): Placed<T>[] {
  const placed: Placed<T>[] = [];
  for (const item of items) {
    const size = Math.min(item.size, Math.max(1, Math.min(w, h) - pad * 2));
    let first: { x: number; y: number } | null = null;
    let found: { x: number; y: number } | null = null;
    for (let t = 0; t < TRIES && !found; t++) {
      const { x, y } = candidate(item, t, size, w, h, pad);
      first ??= { x, y };
      const clash = placed.some((p) => x < p.x + p.size + pad && x + size + pad > p.x && y < p.y + p.size + pad && y + size + pad > p.y);
      if (!clash) found = { x, y };
    }
    const at = found ?? sweep(item.key, size, w, h, pad, placed) ?? first ?? { x: pad, y: pad };
    placed.push({ item, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100, size });
  }
  return placed;
}

/** The t-th seeded spot for an item: anywhere in the sky, or within its
 * `near` band about the centre, always inside the padded edges. */
function candidate(item: ScatterItem, t: number, size: number, w: number, h: number, pad: number): { x: number; y: number } {
  const ux = hashUnit(`${item.key}#x${t}`), uy = hashUnit(`${item.key}#y${t}`);
  const maxX = Math.max(0, w - size - pad * 2), maxY = Math.max(0, h - size - pad * 2);
  if (item.near === undefined) return { x: pad + ux * maxX, y: pad + uy * maxY };
  const x = (w - size) / 2 + (ux - 0.5) * w * item.near;
  const y = (h - size) / 2 + (uy - 0.5) * h * item.near;
  return { x: Math.min(pad + maxX, Math.max(pad, x)), y: Math.min(pad + maxY, Math.max(pad, y)) };
}

/** Every spot on a grid across the sky, starting from a seeded corner of
 * it, until one is clear. Deterministic, so a word still keeps its place. */
function sweep(key: string, size: number, w: number, h: number, pad: number, placed: readonly Placed[]): { x: number; y: number } | null {
  const step = Math.max(4, Math.round(Math.min(size, pad * 2) / 2));
  const xs: number[] = [], ys: number[] = [];
  for (let x = pad; x <= w - size - pad + 1e-6; x += step) xs.push(x);
  for (let y = pad; y <= h - size - pad + 1e-6; y += step) ys.push(y);
  if (!xs.length || !ys.length) return null;
  const ox = Math.floor(hashUnit(`${key}#sx`) * xs.length), oy = Math.floor(hashUnit(`${key}#sy`) * ys.length);
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const x = xs[(i + ox) % xs.length], y = ys[(j + oy) % ys.length];
    const clash = placed.some((p) => x < p.x + p.size + pad && x + size + pad > p.x && y < p.y + p.size + pad && y + size + pad > p.y);
    if (!clash) return { x, y };
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

/** True when any two placed boxes overlap, allowing for the padding. */
export function anyOverlap(placed: readonly Placed[], pad: number): boolean {
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (overlaps(placed[i], placed[j], pad)) return true;
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
  // what must sit near the centre goes first, so it gets the centre
  const ordered = [...items].sort((a, b) => Number(b.near !== undefined) - Number(a.near !== undefined) || b.size - a.size || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
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
