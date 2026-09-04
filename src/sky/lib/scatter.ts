// Scatter placement: where each constellation lands on a sky. Tracked as
// SAK-333.
//
// Every constellation gets a square box sized by its star count and a place
// seeded by its own key, nudged until it overlaps nothing placed before it,
// so a word keeps its place night after night and a new word finds a gap
// without moving the others. Rejection sampling with a bounded number of
// tries; if no clean spot turns up the first candidate stands, which is the
// honest failure for a sky that is simply full.

import { hashUnit } from "./constellation";

export interface ScatterItem {
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

const TRIES = 60;

/** Places items in order into a w by h sky, keeping `pad` between boxes and
 * from the edges. Larger items should come first: they are the hardest to fit. */
export function scatterLayout<T extends ScatterItem>(items: readonly T[], w: number, h: number, pad: number): Placed<T>[] {
  const placed: Placed<T>[] = [];
  for (const item of items) {
    const size = Math.min(item.size, Math.max(1, Math.min(w, h) - pad * 2));
    let first: { x: number; y: number } | null = null;
    let found: { x: number; y: number } | null = null;
    for (let t = 0; t < TRIES && !found; t++) {
      const x = pad + hashUnit(`${item.key}#x${t}`) * Math.max(0, w - size - pad * 2);
      const y = pad + hashUnit(`${item.key}#y${t}`) * Math.max(0, h - size - pad * 2);
      first ??= { x, y };
      const clash = placed.some((p) => x < p.x + p.size + pad && x + size + pad > p.x && y < p.y + p.size + pad && y + size + pad > p.y);
      if (!clash) found = { x, y };
    }
    const at = found ?? first ?? { x: pad, y: pad };
    placed.push({ item, x: at.x, y: at.y, size });
  }
  return placed;
}

/** True when two placed boxes overlap, allowing for the padding. */
export function overlaps(a: Placed, b: Placed, pad = 0): boolean {
  return a.x < b.x + b.size + pad && a.x + a.size + pad > b.x && a.y < b.y + b.size + pad && a.y + a.size + pad > b.y;
}
