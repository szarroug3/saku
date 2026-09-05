// The constellation: where every star of one item sits, seeded by the item,
// so a word looks the same on every screen. Tracked as SAK-296.
//
// Takes the graph's shape (src/sky/lib/graph.ts: every node once, its depth,
// every edge) and gives back normalised positions in a unit box: the root at
// the centre, its parts on a ring around it, their parts fanned out beyond,
// and a shared piece placed once, between the parents that share it, with a
// line from each. `placeConstellation` turns that into absolute positions for
// a given centre and radius: the only thing that differs between the home sky,
// the Planetarium's preview, the lesson, an Atlas tile and the Practice pool
// is the scale.
//
// Never Math.random: every number comes from a hash of the root's id and a
// key, so the shape is the same tonight, tomorrow and in every test.

import type { Constellation } from "./graph";
import type { SkyKind } from "./types";

/** A hash of a string to [0, 1): the prototype's `seeded`, kept as is so the
 * shapes it drew are the shapes the app draws. */
export function hashUnit(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^= h >>> 16) >>> 0) / 4294967296;
}

/** How big a star draws, by what it is: the word (or anything word-like)
 * biggest, a kanji next, a piece smallest. Not by depth: a kanji-centred
 * tile still draws its kanji at kanji size. */
export type StarRole = "word" | "kanji" | "piece";

export function roleOf(kind: SkyKind): StarRole {
  if (kind === "kanji") return "kanji";
  if (kind === "radical") return "piece";
  return "word";
}

/** What kind of body a thing is drawn as (Sam's call, 2026-09-05): kana,
 * pieces, kanji and words are stars; a grammar pattern or a sentence rule
 * is a planet; a counter is an asteroid; a verb pair is a binary star, two
 * suns round one centre. Keigo are words, so stars. */
export type Body = "star" | "planet" | "asteroid" | "binary";

export function bodyOf(kind: SkyKind): Body {
  switch (kind) {
    case "grammar":
    case "sentence": return "planet";
    case "counter": return "asteroid";
    case "verbPair": return "binary";
    default: return "star";
  }
}

/** How far a body reaches from its centre at unit scale: the hit area and
 * the room it needs. A star's is its dot; a planet's is its ring. */
export function bodyRadius(body: Body, role: StarRole): number {
  switch (body) {
    case "planet": return PLANET.ring;
    case "asteroid": return ASTEROID.r * 1.15;
    case "binary": return BINARY.b.x + BINARY.b.r;
    default: return STAR_RADIUS[role];
  }
}

/** The planet: its disc and the ring round it, in star units. Big enough
 * to read as a planet at the smallest scale the sky draws (Sam, 2026-09-05:
 * "I can barely tell this is a planet"). */
export const PLANET = { r: 16, ring: 30, ringDepth: 9.5, tilt: -24 };
/** The asteroid: a lumpy shape of this many corners about this radius. */
export const ASTEROID = { r: 11, corners: 7 };
/** The binary: two suns, offset from the centre, far enough apart to read as two. */
export const BINARY = { a: { x: -8, y: -2.5, r: 7 }, b: { x: 8.5, y: 3.5, r: 5.2 } };

/** The corners of an asteroid, seeded by its id so it is the same lump on
 * every sky: unit radius, to be scaled and offset by the drawer. */
export function asteroidShape(id: string): ReadonlyArray<readonly [number, number]> {
  const spin = hashUnit(`${id}|spin`) * Math.PI * 2;
  return Array.from({ length: ASTEROID.corners }, (_, i) => {
    const a = spin + (i / ASTEROID.corners) * Math.PI * 2;
    const r = 0.72 + hashUnit(`${id}|lump${i}`) * 0.45;
    return [round4(Math.cos(a) * r), round4(Math.sin(a) * r)] as const;
  });
}

export interface Star {
  id: string;
  depth: number;
  /** x and y in [-1, 1]; the root is (0, 0). */
  x: number;
  y: number;
  /** A group's root: a place, not a star. Never drawn, never a hit. */
  group?: boolean;
}

export interface ConstellationLayout {
  root: string;
  stars: readonly Star[];
  /** Pairs of indexes into `stars`, parent first. */
  lines: ReadonlyArray<readonly [number, number]>;
}

const RING = 0.5; // the root's parts
const RING_JITTER = 0.12;
const REACH = 0.42; // a part's own parts, beyond it
const REACH_JITTER = 0.1;
const REACH_FALLOFF = 0.85; // each deeper level reaches a little less
const FAN = 0.8; // radians between sibling parts beyond a part

/** Positions for one constellation, seeded by its root. */
export function layoutConstellation(shape: Constellation): ConstellationLayout {
  const rnd = (key: string) => hashUnit(`${shape.root}|${key}`);
  const jitter = (key: string, amount: number) => (rnd(key) - 0.5) * 2 * amount;

  const index = new Map<string, number>();
  shape.nodes.forEach((n, i) => index.set(n.id, i));
  const stars: Star[] = shape.nodes.map((n) => ({ id: n.id, depth: n.depth, x: 0, y: 0, ...(n.group || (shape.group && n.id === shape.root) ? { group: true } : {}) }));
  if (stars.length === 0) return { root: shape.root, stars, lines: [] };

  // every parent's parts, in edge order, so a fan has a stable order
  const partsOf = new Map<string, string[]>();
  for (const [from, to] of shape.edges) partsOf.set(from, [...(partsOf.get(from) ?? []), to]);
  const parentsOf = new Map<string, string[]>();
  for (const [from, to] of shape.edges) parentsOf.set(to, [...(parentsOf.get(to) ?? []), from]);

  const base = rnd("base") * Math.PI * 2;
  const maxDepth = Math.max(...stars.map((s) => s.depth));
  for (let depth = 1; depth <= maxDepth; depth++) {
    for (const star of stars) {
      if (star.depth !== depth) continue;
      // one candidate position per parent; a shared piece sits at their mean
      const candidates: Array<[number, number]> = [];
      for (const parentId of parentsOf.get(star.id) ?? []) {
        const parent = stars[index.get(parentId)!];
        const siblings = partsOf.get(parentId) ?? [];
        const i = siblings.indexOf(star.id);
        const key = `${parentId}>${star.id}`;
        if (parentId === shape.root) {
          const a = base + (i / siblings.length) * Math.PI * 2 + jitter(`a${key}`, 0.35);
          const r = RING + jitter(`r${key}`, RING_JITTER);
          candidates.push([Math.cos(a) * r, Math.sin(a) * r]);
        } else {
          const outward = Math.atan2(parent.y, parent.x);
          const fan = siblings.length === 1 ? 0 : (i - (siblings.length - 1) / 2) * FAN;
          const a = outward + fan + jitter(`a${key}`, 0.25);
          const r = (REACH + jitter(`r${key}`, REACH_JITTER)) * REACH_FALLOFF ** (depth - 2);
          candidates.push([parent.x + Math.cos(a) * r, parent.y + Math.sin(a) * r]);
        }
      }
      if (candidates.length) {
        star.x = candidates.reduce((s, [x]) => s + x, 0) / candidates.length;
        star.y = candidates.reduce((s, [, y]) => s + y, 0) / candidates.length;
      }
    }
  }

  // normalise so the farthest star touches the unit box, and round: the
  // trigonometry above can differ in its last digit between the server and
  // the browser, and a coordinate that differs is a hydration mismatch
  const extent = Math.max(0.5, ...stars.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y))));
  for (const s of stars) { s.x = round4(s.x / extent); s.y = round4(s.y / extent); }

  // a group has no star: nothing points at it or out of it, and its parts
  // link to each other round the ring they sit on. A group inside another
  // (the row a row builds on) is drawn the same way, so its sounds never
  // fan out over the ring around them.
  const groups = new Set(stars.filter((s) => s.group).map((s) => s.id));
  const lines: Array<readonly [number, number]> = [
    ...shape.edges.filter(([from, to]) => !groups.has(from) && !groups.has(to)).map(([from, to]) => [index.get(from)!, index.get(to)!] as const),
    ...[...groups].flatMap((g) => ring((partsOf.get(g) ?? []).filter((id) => !groups.has(id)).map((id) => index.get(id)!))),
  ];
  return { root: shape.root, stars, lines };
}

/** Each member to the next, and the last back to the first when there are
 * enough to close. */
function ring(members: readonly number[]): Array<readonly [number, number]> {
  if (members.length < 2) return [];
  const out = members.slice(0, -1).map((m, i) => [m, members[i + 1]] as const);
  if (members.length >= 3) out.push([members[members.length - 1], members[0]] as const);
  return out;
}

export interface PlacedStar extends Star {
  /** Absolute position. */
  px: number;
  py: number;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The same shape at a place and size: centre (cx, cy), reach r. Positions
 * are rounded to hundredths, so the server and the browser agree exactly. */
export function placeConstellation(layout: ConstellationLayout, cx: number, cy: number, r: number): readonly PlacedStar[] {
  return layout.stars.map((s) => ({ ...s, px: round2(cx + s.x * r), py: round2(cy + s.y * r) }));
}

/** The radius of a star's dot at unit scale, by role. */
export const STAR_RADIUS: Record<StarRole, number> = { word: 3.2, kanji: 2.5, piece: 1.9 };

/** How large to draw a constellation, from how many stars it has: the
 * prototype's sizing, so the home sky's scatter and the tiles agree. */
export function sizeFor(starCount: number, base: number): number {
  return base + 9 * Math.max(0, starCount - 1);
}
