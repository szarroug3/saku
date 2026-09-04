// The stars are seeded: the same knobs give the same sky everywhere, and each
// knob does what its name says.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bandDirection, bandSpan, DEFAULT_STARS, FIELD_H, FIELD_W, gradientDirection, gradientLength, milkyDots, milkyStarfield, rasterise, stardustDots, TILE_PX, type MilkyStars } from "@/sky/lib/sky-stars";
import { parseWashFile, resolvedStarfield, validateModel } from "@/sky/lib/sky-wash-file";

const MILKY: MilkyStars = { angle: 112, shift: 0, stars: 0.5, starSize: [0.4, 1.3], starBright: [0.3, 0.9], starWidth: 0.075, starX: 0 };

describe("stardust", () => {
  it("is seeded: the same spec gives the same dots, a new seed different ones", () => {
    assert.deepEqual(stardustDots(DEFAULT_STARS), stardustDots({ ...DEFAULT_STARS }));
    assert.notDeepEqual(stardustDots(DEFAULT_STARS), stardustDots({ ...DEFAULT_STARS, seed: 8 }));
  });

  it("density is the count, and size and brightness are the ranges", () => {
    const spec = { density: 50, size: [0.5, 1.5] as [number, number], brightness: [0.2, 0.8] as [number, number], seed: 3 };
    const dots = stardustDots(spec);
    assert.equal(dots.length, 50);
    for (const d of dots) {
      assert.ok(d.x >= 0 && d.x < TILE_PX && d.y >= 0 && d.y < TILE_PX);
      assert.ok(d.r >= 1 && d.r <= 3, "radius is the range at 2x"); // 0.5..1.5 CSS px drawn at 2x
      assert.ok(d.a >= 0.2 && d.a <= 0.8);
    }
    assert.equal(stardustDots({ ...spec, density: 0 }).length, 0);
  });

  it("rasterises a dot as white with coverage in its alpha, and nothing elsewhere", () => {
    const px = rasterise([{ x: 10, y: 10, r: 2, a: 1 }], 20, 20);
    const at = (x: number, y: number) => px[(y * 20 + x) * 4 + 3];
    assert.ok(at(10, 10) > 200, "the centre is bright");
    assert.ok(at(9, 10) > 200 && at(10, 9) > 200, "the dot spreads");
    assert.equal(at(0, 0), 0, "far away is clear");
    assert.equal(px[(10 * 20 + 10) * 4], 255, "white");
  });
});

describe("the Milky Way's stars", () => {
  it("has none at 0, and a field at more", () => {
    assert.equal(milkyStarfield({ ...MILKY, stars: 0 }), "none");
    const field = milkyStarfield(MILKY);
    assert.ok(field.startsWith('url("data:image/svg+xml,'));
    assert.ok(field.includes("%3Ccircle"));
    assert.ok(field.includes("xMidYMid slice"), "covers the box like the baked bitmap");
    assert.equal(field, milkyStarfield({ ...MILKY }), "seeded");
  });

  it("more density means more dots; all inside the box", () => {
    const few = milkyDots({ ...MILKY, stars: 0.2 }), many = milkyDots({ ...MILKY, stars: 0.8 });
    assert.ok(many.length > few.length * 2);
    for (const d of many) assert.ok(d.x >= -4 && d.x <= FIELD_W + 4 && d.y >= -4 && d.y <= FIELD_H + 4);
  });

  it("the dots cluster on the band's line and slide with the shift", () => {
    const [dx, dy] = gradientDirection(MILKY.angle);
    const L = gradientLength(MILKY.angle, FIELD_W, FIELD_H);
    const meanT = (m: MilkyStars) => {
      const dots = milkyDots(m);
      const sum = dots.reduce((s, d) => s + ((d.x - FIELD_W / 2) * dx + (d.y - FIELD_H / 2) * dy) / L + 0.5, 0);
      return sum / dots.length;
    };
    assert.ok(Math.abs(meanT(MILKY) - 0.49) < 0.02, `centred on the band, got ${meanT(MILKY).toFixed(3)}`);
    assert.ok(Math.abs(meanT({ ...MILKY, shift: 15 }) - 0.64) < 0.02, "a +15% shift moves the mean by 15% of the line");
  });

  it("width tightens the stars across the band; slide moves the whole field left or right", () => {
    const [dx, dy] = gradientDirection(MILKY.angle);
    const across = (m: MilkyStars) => milkyDots(m).map((d) => (d.x - FIELD_W / 2) * dx + (d.y - FIELD_H / 2) * dy);
    const ys = (m: MilkyStars) => milkyDots(m).map((d) => d.y);
    const sd = (v: number[]) => { const mean = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length); };
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    assert.ok(sd(across({ ...MILKY, starWidth: 0.02 })) < sd(across({ ...MILKY, starWidth: 0.2 })) / 3, "a narrow width is a much tighter band");
    // the stars always run the band's whole visible length
    const span = bandSpan(MILKY, FIELD_W, FIELD_H);
    assert.ok(span.to - span.from > 800 && span.to - span.from < 1200, `the band's run through a 16:9 frame at 112deg is about the frame's height, got ${(span.to - span.from).toFixed(0)}`);
    assert.ok(sd(ys(MILKY)) > 0.2 * FIELD_H, "the stars span the frame top to bottom");
    assert.ok(milkyDots(MILKY).length > 0.9 * 450, "nearly every star lands in the frame");
    // a slide of -20% moves every star 20% of the width left; the shape is unchanged
    const slid = milkyDots({ ...MILKY, starX: -20 });
    const still = milkyDots(MILKY);
    assert.ok(Math.abs(mean(slid.map((d) => d.x)) - (mean(still.map((d) => d.x)) - 0.2 * FIELD_W)) < 0.02 * FIELD_W, "slide is a horizontal move");
    assert.ok(Math.abs(sd(slid.map((d) => d.y)) - sd(still.map((d) => d.y))) < 0.03 * FIELD_H, "slide does not change the vertical shape");
    assert.ok(Math.abs(mean(slid.map((d) => d.y)) - mean(still.map((d) => d.y))) < 0.03 * FIELD_H, "slide does not move the stars up or down");
    assert.equal(bandSpan({ angle: 90, shift: 200 }, 100, 100).to, 0, "a band that misses the frame has no run");
    assert.ok(bandDirection(112)[1] > 0 && bandDirection(90)[0] > 0, "along the band points down for a mostly vertical band, right for a horizontal one");
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
