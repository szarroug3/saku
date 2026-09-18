// The constellation: where every star of one item sits, seeded by the item,
// so a word looks the same on every screen. Tracked as SAK-296.
//
// Takes the graph's shape (src/sky/lib/graph.ts: every node once, its depth,
// every edge) and gives back normalized positions in a unit box: the root at
// the center, its parts on a ring around it, their parts fanned out beyond,
// and a shared piece placed once, between the parents that share it, with a
// line from each. `placeConstellation` turns that into absolute positions for
// a given center and radius: the only thing that differs between the home sky,
// the Planetarium's preview, the lesson, an Atlas tile and the Practice pool
// is the scale.
//
// Never Math.random: every number comes from a hash of the root's id and a
// key, so the shape is the same tonight, tomorrow and in every test.

import type { Constellation } from "./graph";
import type { Standing } from "./standing";
import type { SkyItem, SkyKind } from "./types";

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
 * biggest, a kanji next, a piece smallest. Not by depth: a kanji-centered
 * tile still draws its kanji at kanji size. */
export type StarRole = "word" | "kanji" | "piece";

export function roleOf(kind: SkyKind): StarRole {
  if (kind === "kanji") return "kanji";
  if (kind === "radical") return "piece";
  return "word";
}

/** What kind of body a thing is drawn as (Sam's call, 2026-09-05, revised
 * 2026-09-17): kana, pieces, kanji and words are stars; a counter is an
 * asteroid; a verb pair is a binary star, two suns round one center. Keigo
 * are words, so stars.
 *
 * The three grammar bodies are the 2026-09-17 revision. Every grammar
 * pattern and every sentence type used to be a ringed planet, so five
 * particles picked for one night were five planets in a cluster, and the
 * biggest body in the sky was also its most common one (Sam: "planets
 * should be rarer"). How many there are now decides the body:
 *
 *   a particle (は, が, を, に, で, だけ and the rest), six or so   a moon
 *   a grammar pattern (〜ている, 〜たい and the rest), 111          a comet
 *   a sentence type (Simple and the other nine), ten              a planet
 *
 * so a planet is the rare thing it looks like, and a moon beside it reads
 * as the small piece a particle is. */
export type Body = "star" | "moon" | "comet" | "asteroid" | "binary" | "planet";

/** Every body, once, rarest first: ten sentence types, sixty-nine verb
 * pairs, fifteen counters, a hundred and eleven grammar patterns, six
 * particles, and then the thousands of stars. The one list of the bodies, so
 * nothing writes their names out a second time, and the order the home walks
 * to decide which body to open the sky on (sky-home.tsx). */
export const BODY_ORDER: readonly Body[] = ["planet", "binary", "asteroid", "comet", "moon", "star"];

/** What a kind is drawn as. `particle` is the flag a grammar item carries
 * when its pattern is a bare particle (see SkyItem.particle); it is ignored
 * on every other kind. Asked through `bodyOfItem`, which is what every
 * caller actually holds. */
function bodyOf(kind: SkyKind, particle = false): Body {
  switch (kind) {
    case "grammar": return particle ? "moon" : "comet";
    case "sentence": return "planet";
    case "counter": return "asteroid";
    case "verbPair": return "binary";
    default: return "star";
  }
}

/** The body an item is drawn as. Every caller in the sky holds an item that
 * may be missing (a star whose item never arrived draws as a word would), so
 * they ask this rather than unpacking the kind and the flag themselves. */
export function bodyOfItem(item: Pick<SkyItem, "kind" | "particle"> | undefined): Body {
  return bodyOf(item?.kind ?? "word", item?.particle);
}

/** How far a body reaches from its center at unit scale: the hit area and
 * the room it needs. A star's is its dot; a planet's is its ring; a comet's
 * is the tip of its tail, which is the farthest it is ever drawn. */
export function bodyRadius(body: Body, role: StarRole): number {
  switch (body) {
    case "planet": return PLANET.ring;
    case "moon": return MOON.r * 1.15;
    case "comet": return COMET.tail;
    case "asteroid": return ASTEROID.r * 1.15;
    case "binary": return BINARY.b.x + BINARY.b.r;
    default: return STAR_RADIUS[role];
  }
}

/** The planet: its disc and the ring round it, in star units. Big enough
 * to read as a planet at the smallest scale the sky draws (Sam, 2026-09-05:
 * "I can barely tell this is a planet"). */
export const PLANET = { r: 16, ring: 30, ringDepth: 9.5, tilt: -24 };
/** The moon: a disc three times a word star wide, with a crescent of shadow
 * lying along one limb. `shadow` is how far the shadow's inner edge bulges
 * back over the lit half, as a share of the radius: near zero is a half moon,
 * and this leaves a little over half the disc lit with a curved edge between
 * the two. The six candidates were drawn side by side at every scale the sky
 * uses and looked at; this is the one that still reads as a moon at 0.7,
 * where the disc is 14 screen pixels across. Much smaller than a planet on
 * purpose: a particle is a small thing. */
export const MOON = { r: 10, shadow: 0.18, tilt: -25 };
/** The comet: a bright head, and a tail this long from the head's center,
 * tapering to a point away from the constellation's middle. The head is
 * smaller than a counter's rock and well under a planet's disc; only the
 * tail reaches far, and it reaches one way. */
export const COMET = { head: 5.5, tail: 18 };
/** The asteroid: a lumpy shape of this many corners about this radius. */
export const ASTEROID = { r: 11, corners: 7 };
/** The binary: two suns, offset from the center, far enough apart to read as two. */
export const BINARY = { a: { x: -8, y: -2.5, r: 7 }, b: { x: 8.5, y: 3.5, r: 5.2 } };

/** Which way a comet's tail points, as a unit vector: away from the middle
 * of its own constellation, which is what (dx, dy) says. A comet sitting AT
 * that middle (a grammar pattern is usually the root of its own
 * constellation) has no such direction, so it takes one seeded by its id and
 * keeps it on every sky. Rounded like every other number the sky draws with,
 * so the server and the browser agree to the last digit. */
export function cometAway(id: string, dx: number, dy: number): readonly [number, number] {
  const angle = Math.hypot(dx, dy) < 1e-6 ? hashUnit(`${id}|tail`) * Math.PI * 2 : Math.atan2(dy, dx);
  return [round4(Math.cos(angle)), round4(Math.sin(angle))];
}

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

interface Star {
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

  // normalize so the farthest star touches the unit box, and round: the
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

/** Each member to the next, and the last back to the first. Two members are
 * not a ring: their parent already joins them, and a third line between
 * them drew a sliver of a triangle that read as a bundle (Sam, 2026-09-08). */
function ring(members: readonly number[]): Array<readonly [number, number]> {
  if (members.length < 3) return [];
  const out = members.slice(0, -1).map((m, i) => [m, members[i + 1]] as const);
  if (members.length >= 3) out.push([members[members.length - 1], members[0]] as const);
  return out;
}

interface PlacedStar extends Star {
  /** Absolute position. */
  px: number;
  py: number;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The same shape at a place and size: center (cx, cy), reach r. Positions
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

// ---------------------------------------------------------------------------
// The paint (SAK-338)
// ---------------------------------------------------------------------------
//
// Two rules decide all of it. THE LINES CARRY THE SHAPE and nothing else, so
// every line is one color and one weight, and only two things change it: a
// line reaching into what has not been discovered fades to fog, and the
// lesson's accent takes over a line at the star it is showing. THE STARS
// CARRY THE STATE: how far a star's glow reaches says how well it is going,
// and the two marks a star can wear say the rest. Slipping is a star going
// out, so it loses its glow and dims; picked for
// tonight is a wide soft halo round whatever the star already is, because
// being on the list is a mark, not a state.
//
// This lives in the model rather than in the drawing so the rules can be
// held to in a unit test, and so the lesson's own clickable stars and the
// legend's key wear exactly what the sky wears.

/** What one star looks like. Standing first; the lesson's looks are marks on
 * top of it, except `lit` and `emphasis`, which take the star over. */
export interface StarLook {
  role: StarRole;
  /** What it is drawn as: a star unless said otherwise (see bodyOf). */
  body?: Body;
  standing: Standing;
  /** Picked for tonight and not yet learned: a wide halo round its own paint. */
  tonight?: boolean;
  /** Opened during this lesson: bright, and it stays that way. */
  lit?: boolean;
  /** The star the panel is showing: the learner's accent. */
  emphasis?: boolean;
  /** Faded right back, while something else is singled out. */
  muted?: boolean;
  /** Not drawn at all, nor its lines: the legend is showing only others. */
  hidden?: boolean;
}

/** A wide soft disc behind a body. `grow` is how far past the body's own
 * reach it goes, at unit scale. */
interface Halo { fill: string; grow: number; opacity: number }
/** A thin ring round a body, drawn over it. */
interface Ring { stroke: string; grow: number; opacity: number; width: number }

/** The paint for one look: what the body is filled with and how brightly,
 * how far its glow reaches, and the marks it wears. */
export interface Paint {
  fill: string;
  /** The body's own fill. 1 unless the standing dims it. */
  opacity: number;
  /** Extra radius on the soft glow under the body; 0 for no glow. */
  glow: number;
  halo?: Halo;
  ring?: Ring;
}

/** Being on tonight's list: a wide, soft halo, the same on every standing. */
export const TONIGHT_HALO: Halo = { fill: "var(--sky-star-mid)", grow: 3, opacity: 0.14 };

const BY_STANDING: Record<Standing, Paint> = {
  solid: { fill: "var(--sky-solid)", opacity: 1, glow: 4 },
  "getting-there": { fill: "var(--sky-getting-there)", opacity: 1, glow: 2.5 },
  shaky: { fill: "var(--sky-shaky)", opacity: 1, glow: 1 },
  // a star going out: dimmed and with no glow at all. That is the whole mark
  // (Sam, 2026-09-08: no ring), so nothing here is dashed or drawn over.
  slipping: { fill: "var(--sky-slipping)", opacity: 0.7, glow: 0 },
  // untested: nothing has been proved, so no glow; a faint halo says it has
  // been met.
  claimed: { fill: "var(--sky-claimed)", opacity: 1, glow: 0, halo: { fill: "var(--sky-star-mid)", grow: 2, opacity: 0.15 } },
  // undiscovered: a bare dim dot, and the lines into it are fog.
  "not-seen": { fill: "var(--sky-not-seen)", opacity: 1, glow: 0 },
};
const LIT: Paint = { fill: "var(--sky-star)", opacity: 1, glow: 3 };
const EMPHASIS: Paint = { fill: "var(--sky-accent)", opacity: 1, glow: 4 };

/** The paint a look resolves to. Exported so the lesson's own clickable
 * stars and the legend's key wear the same paint the sky does. */
export function paintFor(look: StarLook): Paint {
  if (look.emphasis) return EMPHASIS;
  if (look.lit) return LIT;
  const base = BY_STANDING[look.standing];
  return look.tonight ? { ...base, halo: TONIGHT_HALO } : base;
}

/** Nothing has been opened or claimed here, and the lesson is not showing
 * it either: the sky's own word is "undiscovered". */
function isUndiscovered(look: StarLook): boolean {
  return !look.emphasis && !look.lit && !look.tonight && look.standing === "not-seen";
}

/** How one line between two stars is drawn. */
interface LinePaint { stroke: string; width: number; opacity: number }

/** Every line is the same line: one color, one weight, never dashed. A
 * line to an undiscovered star is not drawn at all (Sam, 2026-09-08: solid
 * for anything discovered, nothing for anything not), except on a sky that
 * asks for `fog`: the lesson's, where the shape of what you are about to
 * learn is the point, so the line is there, faint, and turns solid the
 * moment the star is discovered. The accent is the only other color, and
 * something singled out elsewhere takes every other line right back. */
const LINE = { stroke: "var(--sky-link)", width: 1.25, opacity: 0.8 } as const;
const LINE_FOG = 0.35;
const LINE_MUTED = 0.12;
const LINE_EMPHASIS = { stroke: "var(--sky-accent)", width: 1.4, opacity: 0.9 } as const;

export function linePaintFor(a: StarLook, b: StarLook, fog = false): LinePaint | null {
  if (isUndiscovered(a) || isUndiscovered(b)) return fog ? { ...LINE, opacity: LINE_FOG } : null;
  if (a.muted || b.muted) return { ...LINE, opacity: LINE_MUTED };
  if (a.emphasis || b.emphasis) return { ...LINE_EMPHASIS };
  return { ...LINE };
}
