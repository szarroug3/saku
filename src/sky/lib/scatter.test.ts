// The scatter is seeded and clean: a word keeps its place, and nothing overlaps.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraph } from "@/sky/lib/graph";
import { anyOverlap, overlaps, scatterInWorld, scatterLayout, worldFor, type ScatterItem } from "@/sky/lib/scatter";
import { bySizeDesc, skyRoots, skyStars, tallyStandings } from "@/sky/lib/sky-scene";
import type { SkyItem } from "@/sky/lib/types";

describe("scatter layout", () => {
  const twelve = Array.from({ length: 12 }, (_, i) => ({ key: `word${i}`, size: 60 + (i % 4) * 18 }));

  it("places the sample learner's twelve constellations with no overlaps", () => {
    const placed = scatterLayout(twelve, 1120, 460, 26);
    assert.equal(placed.length, 12);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i], placed[j], 26), `${placed[i].item.key} overlaps ${placed[j].item.key}`);
    for (const p of placed) assert.ok(p.x >= 26 && p.y >= 26 && p.x + p.size <= 1120 - 26 && p.y + p.size <= 460 - 26, "inside the sky");
  });

  it("is seeded by the key: the same word lands in the same place, alone or first", () => {
    const alone = scatterLayout([twelve[3]], 1120, 460, 26)[0];
    const first = scatterLayout([twelve[3], ...twelve.slice(0, 3)], 1120, 460, 26)[0];
    assert.deepEqual([alone.x, alone.y], [first.x, first.y]);
    assert.deepEqual(scatterLayout(twelve, 1120, 460, 26), scatterLayout(twelve, 1120, 460, 26));
  });

  it("gives up gracefully when the sky is full, rather than hanging or dropping anything", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `w${i}`, size: 120 }));
    const placed = scatterLayout(many, 400, 300, 10);
    assert.equal(placed.length, 40);
    for (const p of placed) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });

  it("shrinks a box that could never fit the sky", () => {
    const [p] = scatterLayout([{ key: "huge", size: 900 }], 300, 200, 10);
    assert.equal(p.size, 180);
  });
});

describe("the sky scene", () => {
  const item = (id: string, kind: SkyItem["kind"], standing: SkyItem["standing"], components?: string[]): SkyItem => ({ id, kind, glyph: id, english: id, standing, components });
  const items = [
    item("日本", "word", "solid", ["日", "本"]), item("日", "kanji", "solid"), item("本", "kanji", "shaky", ["木"]), item("木", "kanji", "solid"),
    item("時間", "word", "not-seen", ["時", "間"]), item("時", "kanji", "claimed", ["日"]), item("間", "kanji", "not-seen"),
    item("あ", "kana", "solid"),
  ];
  const g = buildGraph(items);
  const standing = (id: string) => items.find((i) => i.id === id)?.standing;

  it("a met item under another met item is a star, not a constellation of its own", () => {
    const met = new Set(["日本", "日", "本", "木", "時", "あ"]);
    assert.deepEqual(skyRoots(g, met).sort(), ["あ", "日本", "時"].sort(), "日, 本 and 木 sit inside 日本; 時 is met but 時間 is not, so 時 stands alone");
    assert.deepEqual(skyRoots(g, new Set(["ghost"])), [], "an id the graph does not know is not a star");
  });

  it("the stars are the roots and everything under them, each once", () => {
    const stars = skyStars(g, ["日本", "時"]);
    assert.deepEqual([...stars].sort(), ["日", "日本", "時", "木", "本"].sort(), "日 is under both roots and counted once");
  });

  it("tallies standings and sorts largest first, stably", () => {
    assert.deepEqual(tallyStandings(["日本", "日", "本", "木", "時", "間"], standing), { solid: 3, shaky: 1, claimed: 1, "not-seen": 1 });
    assert.deepEqual(bySizeDesc(["a", "bb", "cc", "d"], (s) => s.length), ["bb", "cc", "a", "d"]);
  });
});

describe("a small sky", () => {
  it("grows until its rows fit clean, and lands the same way whatever order they came in", () => {
    const rows = ["kana-row:h-vowels", "kana-row:h-k", "kana-row:h-s"].map((key) => ({ key, size: 76 }));
    const min = { width: 340, height: 230 };
    const a = scatterInWorld(rows, min, 16);
    assert.ok(!anyOverlap(a.placed, 16));
    for (const order of [[rows[0], rows[2], rows[1]], [rows[2], rows[1], rows[0]]]) {
      const b = scatterInWorld(order, min, 16);
      assert.ok(!anyOverlap(b.placed, 16));
      assert.deepEqual(b.world, a.world);
      assert.deepEqual(b.placed.map((p) => [p.item.key, p.x, p.y]), a.placed.map((p) => [p.item.key, p.x, p.y]));
    }
  });

  it("a sky that is genuinely full still gives up gracefully", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `w${i}`, size: 120 }));
    const { placed } = scatterInWorld(many, { width: 400, height: 300 }, 10);
    assert.equal(placed.length, 40);
  });
});

describe("worldFor", () => {
  it("keeps the minimum world for a small sky, and grows it to fit a large one", () => {
    const min = { width: 1120, height: 900 };
    const few = Array.from({ length: 30 }, (_, i) => ({ key: `w${i}`, size: 60 }));
    assert.deepEqual(worldFor(few, 26, min), min);
    const many = Array.from({ length: 500 }, (_, i) => ({ key: `w${i}`, size: 60 }));
    const world = worldFor(many, 26, min);
    assert.ok(world.width > min.width && world.height > min.height);
    assert.ok(Math.abs(world.width / world.height - 1120 / 900) < 0.01, "keeps the shape");
    const placed = scatterLayout(many, world.width, world.height, 26);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i], placed[j], 26), `${placed[i].item.key} overlaps ${placed[j].item.key}`);
  });
});

describe("scatter near the centre", () => {
  it("keeps items marked near within their band about the centre, and places them first", () => {
    const items: ScatterItem[] = [
      ...Array.from({ length: 30 }, (_, i) => ({ key: `star${i}`, size: 40 })),
      ...Array.from({ length: 6 }, (_, i) => ({ key: `body${i}`, size: 50, near: 0.2 })),
    ];
    const { placed, world } = scatterInWorld(items, { width: 1600, height: 1200 }, 20);
    assert.ok(!anyOverlap(placed, 20));
    for (const p of placed.filter((p) => p.item.near !== undefined)) {
      const cx = p.x + p.size / 2, cy = p.y + p.size / 2;
      assert.ok(Math.abs(cx - world.width / 2) <= world.width * 0.1 + p.size, `${p.item.key} x ${cx} of ${world.width}`);
      assert.ok(Math.abs(cy - world.height / 2) <= world.height * 0.1 + p.size, `${p.item.key} y ${cy} of ${world.height}`);
    }
    assert.ok(placed.slice(0, 6).every((p) => p.item.near !== undefined));
  });
});
