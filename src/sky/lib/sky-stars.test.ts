// The stars are seeded: the same knobs give the same sky everywhere, and each
// knob does what its name says.
//
// Everything here goes through the two things the wash file and the bake
// script actually call, `stardustPixels` and `milkyStarfield`, and reads the
// answer back out of the tile's pixels or the field's SVG. The dot lists and
// the band geometry underneath them are private (SAK-433), and a knob that
// only moved a private number would not be worth a knob.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_STARS, milkyStarfield, stardustPixels, TILE_PX } from "@/sky/lib/sky-stars";
import { parseWashFile, resolvedStarfield, validateModel } from "@/sky/lib/sky-wash-file";

/** The band's knobs, named off the function that takes them: the interface is
 * private, and exporting it for a test is what this round is undoing. */
type MilkyStars = Parameters<typeof milkyStarfield>[0];

const MILKY: MilkyStars = { angle: 112, shift: 0, stars: 0.5, starSize: [0.4, 1.3], starBright: [0.3, 0.9], starWidth: 0.075, starX: 0 };

type Dot = { x: number; y: number; r: number; a: number };

/** The field the module wrote, read back: its box, and every dot in it. The
 * SVG is percent-escaped into a CSS url(), so this unescapes first. */
function field(m: MilkyStars): { w: number; h: number; dots: Dot[] } {
  const url = milkyStarfield(m);
  if (url === "none") return { w: 0, h: 0, dots: [] };
  const svg = url.replace(/%3C/g, "<").replace(/%3E/g, ">");
  const box = /viewBox='0 0 (\d+) (\d+)'/.exec(svg);
  assert.ok(box, "the field names its box");
  const dots: Dot[] = [];
  for (const g of svg.matchAll(/<g opacity='([\d.]+)'>([\s\S]*?)<\/g>/g)) {
    for (const c of g[2].matchAll(/<circle cx='(-?[\d.]+)' cy='(-?[\d.]+)' r='([\d.]+)'\/>/g)) {
      dots.push({ x: Number(c[1]), y: Number(c[2]), r: Number(c[3]), a: Number(g[1]) });
    }
  }
  return { w: Number(box[1]), h: Number(box[2]), dots };
}

/** The direction a CSS linear-gradient angle runs, in screen coordinates.
 * The test's own copy, so it measures the band against the definition rather
 * than against the module's reading of it. */
const gradientDirection = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
const gradientLength = (deg: number, w: number, h: number) => Math.abs(w * Math.sin((deg * Math.PI) / 180)) + Math.abs(h * Math.cos((deg * Math.PI) / 180));

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const sd = (v: number[]) => Math.sqrt(mean(v.map((x) => (x - mean(v)) ** 2)));

/** The tile's lit pixels: how many, and their alphas. */
function tile(spec: Parameters<typeof stardustPixels>[0]): { lit: number; alphas: number[]; allWhite: boolean } {
  const px = stardustPixels(spec);
  const alphas: number[] = [];
  let allWhite = true;
  for (let o = 0; o < px.length; o += 4) {
    if (px[o + 3] === 0) continue;
    alphas.push(px[o + 3]);
    if (px[o] !== 255 || px[o + 1] !== 255 || px[o + 2] !== 255) allWhite = false;
  }
  return { lit: alphas.length, alphas, allWhite };
}

describe("stardust", () => {
  it("is seeded: the same spec gives the same tile, a new seed a different one", () => {
    assert.deepEqual(stardustPixels(DEFAULT_STARS), stardustPixels({ ...DEFAULT_STARS }));
    assert.notDeepEqual(stardustPixels(DEFAULT_STARS), stardustPixels({ ...DEFAULT_STARS, seed: 8 }));
  });

  it("density paints more of the tile, and nothing at all at zero", () => {
    const spec = { density: 50, size: [0.5, 1.5] as [number, number], brightness: [0.2, 0.8] as [number, number], seed: 3 };
    assert.equal(tile({ ...spec, density: 0 }).lit, 0);
    const few = tile(spec).lit, many = tile({ ...spec, density: 200 }).lit;
    assert.ok(few > 0);
    assert.ok(many > few * 2, `200 dots should light far more than 50, got ${many} against ${few}`);
    assert.ok(few < TILE_PX * TILE_PX * 0.01, "a field of dots, not a wash");
  });

  it("brightness is the range it paints within, and every dot is white", () => {
    const spec = { density: 200, size: [0.5, 1.5] as [number, number], brightness: [0.2, 0.8] as [number, number], seed: 3 };
    const { alphas, allWhite } = tile(spec);
    assert.ok(allWhite, "dots are white, and the colour comes from what is under them");
    assert.ok(Math.max(...alphas) <= Math.ceil(0.8 * 255), "nothing brighter than the top of the range");
    assert.ok(Math.max(...alphas) >= 0.7 * 255, "something reaches near it");
    assert.ok(Math.max(...tile({ ...spec, brightness: [0.1, 0.3] }).alphas) < Math.max(...alphas), "a dimmer range is dimmer");
  });

  it("anti-aliases: a dot's edge is partly covered, not a hard disc", () => {
    const { alphas } = tile({ density: 20, size: [1, 1], brightness: [1, 1], seed: 5 });
    const top = Math.max(...alphas);
    assert.ok(alphas.some((a) => a > 0 && a < top * 0.6), "an edge pixel takes a fraction of the dot's alpha");
  });

  it("size is the range at 2x: bigger dots light more of the tile", () => {
    const spec = { density: 60, size: [0.5, 1] as [number, number], brightness: [1, 1] as [number, number], seed: 4 };
    assert.ok(tile({ ...spec, size: [2, 3] }).lit > tile(spec).lit * 3, "radius drawn at 2x, area with the square of it");
  });
});

describe("the Milky Way's stars", () => {
  it("has none at 0, and a field at more", () => {
    assert.equal(milkyStarfield({ ...MILKY, stars: 0 }), "none");
    const url = milkyStarfield(MILKY);
    assert.ok(url.startsWith('url("data:image/svg+xml,'));
    assert.ok(url.includes("%3Ccircle"));
    assert.ok(url.includes("xMidYMid slice"), "covers the box like the baked bitmap");
    assert.equal(url, milkyStarfield({ ...MILKY }), "seeded");
  });

  it("more density means more dots; all inside the box", () => {
    const few = field({ ...MILKY, stars: 0.2 }).dots, many = field({ ...MILKY, stars: 0.8 });
    assert.ok(many.dots.length > few.length * 2);
    for (const d of many.dots) assert.ok(d.x >= -4 && d.x <= many.w + 4 && d.y >= -4 && d.y <= many.h + 4);
  });

  it("the dots cluster on the band's line and slide with the shift", () => {
    const [dx, dy] = gradientDirection(MILKY.angle);
    const meanT = (m: MilkyStars) => {
      const { w, h, dots } = field(m);
      const L = gradientLength(m.angle, w, h);
      return mean(dots.map((d) => ((d.x - w / 2) * dx + (d.y - h / 2) * dy) / L + 0.5));
    };
    assert.ok(Math.abs(meanT(MILKY) - 0.49) < 0.02, `centred on the band, got ${meanT(MILKY).toFixed(3)}`);
    assert.ok(Math.abs(meanT({ ...MILKY, shift: 15 }) - 0.64) < 0.02, "a +15% shift moves the mean by 15% of the line");
  });

  it("width tightens the stars across the band; slide moves the whole field left or right", () => {
    const [dx, dy] = gradientDirection(MILKY.angle);
    const { w, h, dots } = field(MILKY);
    const across = (m: MilkyStars) => field(m).dots.map((d) => (d.x - w / 2) * dx + (d.y - h / 2) * dy);
    assert.ok(sd(across({ ...MILKY, starWidth: 0.02 })) < sd(across({ ...MILKY, starWidth: 0.2 })) / 3, "a narrow width is a much tighter band");
    // the stars always run the band's whole visible length
    assert.ok(sd(dots.map((d) => d.y)) > 0.2 * h, "the stars span the frame top to bottom");
    assert.ok(dots.length > 0.9 * 450, "nearly every star lands in the frame");
    // a slide of -20% moves every star 20% of the width left; the shape is unchanged
    const slid = field({ ...MILKY, starX: -20 }).dots;
    assert.ok(Math.abs(mean(slid.map((d) => d.x)) - (mean(dots.map((d) => d.x)) - 0.2 * w)) < 0.02 * w, "slide is a horizontal move");
    assert.ok(Math.abs(sd(slid.map((d) => d.y)) - sd(dots.map((d) => d.y))) < 0.03 * h, "slide does not change the vertical shape");
    assert.ok(Math.abs(mean(slid.map((d) => d.y)) - mean(dots.map((d) => d.y))) < 0.03 * h, "slide does not move the stars up or down");
  });

  it("a band shifted right off the frame has nothing to draw", () => {
    assert.equal(milkyStarfield({ ...MILKY, shift: 200 }), "none");
  });

  it("the file resolves the field from the visible band only", () => {
    // one declaration per line, the way the file is written and read
    const m = parseWashFile([":root {", "--sky-zenith: #000000;", "--sky-ground: #000000;", "--sky-ground-2: #000000;", "--sky-sweep-mid: 40%;",
      "--sky-milky-lilac: 1, 2, 3;", "--sky-milky-pink: 1, 2, 3;", "--sky-milky-strength: 0.2;", "--sky-milky-stars: 0.4;", "--sky-milky-visible: 1;", "}"].join("\n"));
    assert.ok(resolvedStarfield(m).startsWith("url("));
    assert.equal(resolvedStarfield({ ...m, layers: m.layers.map((l) => ({ ...l, visible: false })) }), "none");
    assert.equal(validateModel({ ...m, stars: { ...m.stars, size: [2, 1] } }), "stars out of range", "min above max is refused");
    assert.equal(validateModel(m), null);
  });
});
