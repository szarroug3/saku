// Nothing a sky draws is outside the box it is drawn in (SAK-474).
//
// The test builds the scene the way SkyField does -- a box per constellation,
// scattered into a world, every star placed, every body grown by the room its
// marks need -- and then the window the way SkyCanvas does, at every band
// height the lesson's drag allows. What it asserts is the rule itself: every
// body's box is inside the window, on all four sides, with nothing to spare
// being fine and anything missing being the bug.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bodyOfItem, bodyRoom, boxFor, layoutConstellation, placeConstellation, roleOf, unitFor, type Body } from "@/sky/lib/constellation";
import { buildGraph } from "@/sky/lib/graph";
import { scatterInWorld } from "@/sky/lib/scatter";
import { boxAround, EDGE, placeSky, zoomToShow, type SkyBox } from "@/sky/lib/sky-fit";
import type { SkyItem, SkyKind } from "@/sky/lib/types";

const item = (id: string, kind: SkyKind, extra: Partial<SkyItem> = {}): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", ...extra });

/** Where one body is and how much room it needs round it, which is what the
 * field hands `boxAround`. Written out here rather than imported: the shape is
 * the whole contract, and it has no name outside the module. */
interface Spot { x: number; y: number; room: number }

/** One pick of each kind of body, so every reach in `bodyRadius` is tested:
 * a moon (a particle), a comet (a grammar pattern), a planet (a sentence
 * type), an asteroid (a counter), a binary (a verb pair), and two stars -- a
 * radical on its own, and a word with pieces under it. */
const PICKS: ReadonlyArray<{ id: string; body: Body }> = [
  { id: "grammar:wa", body: "moon" },
  { id: "grammar:te-kara", body: "comet" },
  { id: "rule:simple", body: "planet" },
  { id: "counter:tsu", body: "asteroid" },
  { id: "pair:deru", body: "binary" },
  { id: "radical:one", body: "star" },
  { id: "word:train", body: "star" },
];

const ITEMS: readonly SkyItem[] = [
  item("grammar:wa", "grammar", { particle: true }),
  item("grammar:te-kara", "grammar"),
  item("rule:simple", "sentence"),
  item("counter:tsu", "counter"),
  item("pair:deru", "verbPair"),
  item("radical:one", "radical"),
  item("word:train", "word", { components: ["kanji:den", "kanji:sha"] }),
  item("kanji:den", "kanji", { components: ["radical:rain"] }),
  item("kanji:sha", "kanji"),
  item("radical:rain", "radical"),
];

const GRAPH = buildGraph(ITEMS);

/** The scene one sky holds: where every body is, how much room it needs, and
 * the world they were scattered into. Built exactly as SkyField builds it. */
function scene(picks: readonly string[], world: { width: number; height: number }, pad: number, base: number): { bodies: Spot[]; world: { width: number; height: number }; middles: Map<string, { x: number; y: number }> } {
  const layouts = new Map(picks.map((id) => [id, layoutConstellation(GRAPH.constellationOf(id))] as const));
  const boxes = picks.map((id) => {
    const it = GRAPH.itemOf(id);
    return { key: id, size: boxFor(layouts.get(id)!.stars.length, bodyOfItem(it), roleOf(it?.kind ?? "word"), base) };
  });
  const laid = scatterInWorld(boxes, world, pad);
  const bodies: Spot[] = [];
  const middles = new Map<string, { x: number; y: number }>();
  for (const p of laid.placed) {
    const cx = p.x + p.size / 2, cy = p.y + p.size / 2, r = p.size / 2 - 3, u = unitFor(p.size);
    middles.set(p.item.key, { x: cx, y: cy });
    for (const s of placeConstellation(layouts.get(p.item.key)!, cx, cy, r)) {
      if (s.group) continue;
      const it = GRAPH.itemOf(s.id);
      bodies.push({ x: s.px, y: s.py, room: bodyRoom(bodyOfItem(it), roleOf(it?.kind ?? "word")) * u });
    }
  }
  return { bodies, world: laid.world, middles };
}

/** What the box shows, in sky units, the way SkyCanvas works it out: with
 * `fill` the world is sliced to cover the box rather than fitted inside it.
 * `scale` is screen pixels per sky unit at 100%, which is what turns the edge
 * kept clear for the rounded corners into sky units. */
function windowOf(box: { w: number; h: number }, world: { width: number; height: number }, fill: boolean): { w: number; h: number; scale: number } {
  const scale = (fill ? Math.max : Math.min)(box.w / world.width, box.h / world.height);
  return { w: box.w / scale, h: box.h / scale, scale };
}

/** The world rectangle a box of this size shows, for a sky that is never
 * panned: the canvas's own opening view, in world units. */
function shows(box: { w: number; h: number }, world: { width: number; height: number }, contain: SkyBox, openOn: { x: number; y: number } | undefined, fill: boolean): SkyBox {
  const win = windowOf(box, world, fill);
  const edge = EDGE / win.scale;
  const k = zoomToShow({ w: win.w - 2 * edge, h: win.h }, contain, Math.min(1, win.w / world.width));
  const wanted = openOn ? { x: win.w / 2 - openOn.x * k, y: win.h / 2 - openOn.y * k } : { x: 0, y: 0 };
  const at = placeSky(win, world, k, wanted, contain, edge);
  // in world units, less the corners kept clear at each end: what a body may
  // be drawn in, which is the panel's box minus its rounded corners
  return { x: (-at.x + edge) / k, y: -at.y / k, w: (win.w - 2 * edge) / k, h: win.h / k };
}

/** Which bodies are not wholly inside the window, and by how much. */
function outside(bodies: readonly Spot[], win: SkyBox): string[] {
  const off: string[] = [];
  bodies.forEach((b, i) => {
    const over = Math.max(win.x - (b.x - b.room), win.y - (b.y - b.room), b.x + b.room - (win.x + win.w), b.y + b.room - (win.y + win.h));
    if (over > 1e-6) off.push(`body ${i} at ${b.x},${b.y} is ${over.toFixed(1)} units outside`);
  });
  return off;
}

describe("the box round what a sky draws", () => {
  it("holds every body, its reach and its widest mark", () => {
    const bodies: Spot[] = [{ x: 100, y: 50, room: 10 }, { x: 40, y: 80, room: 4 }];
    assert.deepEqual(boxAround(bodies), { x: 36, y: 40, w: 74, h: 44 });
    assert.equal(boxAround([]), null);
  });

  it("is wider than the reach alone, by the widest glow a body can gain", () => {
    // the hit area is the reach; the room is what the panel's edge is kept
    // from, so a star hovered at the edge has somewhere to put its glow
    for (const { body } of PICKS) assert.ok(bodyRoom(body, "word") > 0);
    assert.ok(bodyRoom("comet", "word") > bodyRoom("star", "piece"), "a comet's tail needs more room than a piece's dot");
    assert.ok(bodyRoom("star", "word") - 3.2 >= 3, "a word star has room for the halo it wears tonight");
  });

  it("never draws a body outside a box it was told to fill", () => {
    const world = { width: 1120, height: 400 };
    const contain = { x: 500, y: 180, w: 60, h: 60 };
    const win = windowOf({ w: 1392, h: 48 }, world, true);
    const k = zoomToShow(win, contain, Math.min(1, win.w / world.width));
    assert.ok(k < 1, "a band shorter than the constellation is drawn further out");
    assert.ok(contain.h * k <= win.h + 1e-6, "and far enough out to hold it");
  });

  it("never zooms IN to fill a box: showing everything is a reason to draw smaller", () => {
    const win = { w: 1120, h: 300 };
    assert.equal(zoomToShow(win, { x: 0, y: 0, w: 60, h: 60 }, 1), 1);
    assert.equal(zoomToShow(win, { x: 0, y: 0, w: 60, h: 60 }, 0.5), 0.5);
  });

  it("leaves a window with no size alone, so no NaN reaches a transform", () => {
    assert.equal(zoomToShow({ w: 0, h: 0 }, { x: 0, y: 0, w: 10, h: 10 }, 0.4), 0.4);
    assert.deepEqual(placeSky({ w: 0, h: 0 }, { width: 100, height: 100 }, 0, { x: -5, y: -5 }), { x: 0, y: 0 });
  });

  it("moves the sky as little as it takes, so a band still opens where it was told to", () => {
    const world = { width: 1120, height: 400 };
    const win = { w: 900, h: 100 };
    // the rectangle is already in the window where the sky wanted to open: it
    // is left exactly there, rather than dragged to one end of the band
    const wanted = { x: -100, y: -150 };
    assert.deepEqual(placeSky(win, world, 1, wanted, { x: 140, y: 170, w: 60, h: 60 }), wanted);
    // and when it is not, only the axis that has to move does, and only far
    // enough: the rectangle's far edge comes to rest on the window's
    const pushed = placeSky(win, world, 1, wanted, { x: 140, y: 170, w: 60, h: 90 });
    assert.equal(pushed.x, wanted.x, "nothing was wrong across the band");
    assert.equal(pushed.y + (170 + 90), win.h, "and the sky slid up until the last of it showed");
  });
});

describe("the lesson's band", () => {
  // what sky-lesson.tsx asks SkyField for
  const WORLD = { width: 1120, height: 400 };
  const PAD = 40, BASE = 56;
  // every band height the drag allows: the 48px floor (`MIN_SKY` in
  // lesson-split.ts), the 42% the two by two opens at, and the way between
  const BANDS = [48, 60, 80, 120, 180, 240, 310];
  // the widths Sam looks at the lesson in: the left column at 1440, and the
  // whole width below lg where the four cells are a stack
  const WIDTHS = [1392, 1076, 728];

  for (const count of [1, 2, 5]) {
    it(`draws ${count} pick${count === 1 ? "" : "s"} whole at every band height and width`, () => {
      const picks = PICKS.slice(0, count).map((p) => p.id);
      const { bodies, world, middles } = scene(picks, WORLD, PAD, BASE);
      const contain = boxAround(bodies)!;
      for (const width of WIDTHS) {
        for (const h of BANDS) {
          // the band opens on the constellation the lesson is standing in,
          // whichever of the picks that is (SAK-471)
          for (const on of picks) {
            const win = shows({ w: width, h }, world, contain, middles.get(on), true);
            assert.deepEqual(outside(bodies, win), [], `${count} picks, ${width}x${h}, opened on ${on}`);
          }
        }
      }
    });
  }

  it("is drawn further out only when it has to be", () => {
    const out = (picks: readonly string[], h: number) => {
      const { bodies, world } = scene(picks, WORLD, PAD, BASE);
      const win = windowOf({ w: 1392, h }, world, true);
      const edge = EDGE / win.scale;
      return zoomToShow({ w: win.w - 2 * edge, h: win.h }, boxAround(bodies)!, Math.min(1, win.w / world.width));
    };
    // A night of one or two picks is drawn at 100% in the band at rest and
    // only MOVED to bring them into it. That is why the zoom and the slide are
    // two rules rather than one: most nights use only the second.
    for (const count of [1, 2]) assert.equal(out(PICKS.slice(0, count).map((p) => p.id), 310), 1, `${count} picks at rest`);
    // a lone moon is short enough for the band at its floor as well: it is
    // MOVED into the 48 pixels rather than shrunk to fit them
    assert.equal(out(["grammar:wa"], 48), 1);
    // Five picks are scattered over a world taller than the band shows, so
    // even at rest the sky is drawn a little further out. That is the bug this
    // whole file is about: without it the fifth pick was simply not drawn.
    assert.ok(out(PICKS.slice(0, 5).map((p) => p.id), 310) < 1, "five picks at rest do not fit at 100%");
    assert.ok(out(PICKS.slice(0, 5).map((p) => p.id), 48) < out(PICKS.slice(0, 5).map((p) => p.id), 310), "and the shorter the band, the further out");
  });

  it("holds every kind of body, one pick at a time, at the shortest band there is", () => {
    for (const { id, body } of PICKS) {
      const { bodies, world, middles } = scene([id], WORLD, PAD, BASE);
      const contain = boxAround(bodies)!;
      const win = shows({ w: 1392, h: 48 }, world, contain, middles.get(id), true);
      assert.deepEqual(outside(bodies, win), [], `${id}, drawn as a ${body}`);
    }
  });
});

describe("the Observatory's sky tonight", () => {
  // what sky-observatory.tsx asks SkyField for: a box, not a band, and the
  // world is fitted inside it rather than sliced to cover it
  const WORLD = { width: 340, height: 230 };

  for (const count of [1, 2, 5]) {
    it(`draws ${count} pick${count === 1 ? "" : "s"} whole`, () => {
      const picks = PICKS.slice(0, count).map((p) => p.id);
      const { bodies, world } = scene(picks, WORLD, 16, 40);
      const contain = boxAround(bodies)!;
      for (const box of [{ w: 304, h: 206 }, { w: 268, h: 181 }, { w: 200, h: 135 }]) {
        assert.deepEqual(outside(bodies, shows(box, world, contain, undefined, false)), [], `${count} picks in ${box.w}x${box.h}`);
      }
    });
  }
});
