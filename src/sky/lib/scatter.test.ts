// The scatter is seeded and clean: a word keeps its place, and nothing overlaps.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraph } from "@/sky/lib/graph";
import { scatterInWorld, type Placed } from "@/sky/lib/scatter";
import { bySizeDesc, skyRoots, skyStars, tallyStandings } from "@/sky/lib/sky-scene";
import type { SkyItem } from "@/sky/lib/types";

/** The test's own overlap test, deliberately not the module's: a scatter that
 * checked itself with the same predicate it places by would agree with itself
 * whatever either of them did. This is the plain pairwise rectangle test. */
const overlaps = (a: Placed, b: Placed, pad = 0): boolean =>
  a.x < b.x + b.size + pad && a.x + a.size + pad > b.x && a.y < b.y + b.size + pad && a.y + a.size + pad > b.y;

/** No two of them, over every pair. */
function anyPairOverlaps(placed: readonly Placed[], pad: number): string | null {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (overlaps(placed[i], placed[j], pad)) return `${placed[i].item.key} overlaps ${placed[j].item.key}`;
    }
  }
  return null;
}

describe("scatter layout", () => {
  const twelve = Array.from({ length: 12 }, (_, i) => ({ key: `word${i}`, size: 60 + (i % 4) * 18 }));
  const sky = { width: 1120, height: 460 };

  it("places the sample learner's twelve constellations with no overlaps", () => {
    const { placed, world } = scatterInWorld(twelve, sky, 26);
    assert.equal(placed.length, 12);
    assert.equal(anyPairOverlaps(placed, 26), null);
    for (const p of placed) assert.ok(p.x >= 26 && p.y >= 26 && p.x + p.size <= world.width - 26 && p.y + p.size <= world.height - 26, "inside the sky");
  });

  it("is seeded by the key: the same word lands in the same place twice over", () => {
    const a = scatterInWorld(twelve, sky, 26);
    const b = scatterInWorld(twelve, sky, 26);
    assert.deepEqual(b.placed, a.placed);
    assert.deepEqual(b.world, a.world);
  });

  it("gives up gracefully when the sky is full, rather than hanging or dropping anything", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `w${i}`, size: 120 }));
    const { placed } = scatterInWorld(many, { width: 400, height: 300 }, 10);
    assert.equal(placed.length, 40);
    for (const p of placed) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });

  it("sizes the world to the box rather than shrinking the box", () => {
    // The old test here reached scatterLayout directly and handed it a sky too
    // small for its one box, to watch the box clamp. Through the only caller
    // that cannot happen: the world is sized from the boxes first, so a box
    // keeps the size it asked for and the sky grows around it (SAK-433).
    const { placed, world } = scatterInWorld([{ key: "huge", size: 900 }], { width: 300, height: 200 }, 10);
    assert.equal(placed[0].size, 900);
    assert.ok(world.width >= 900 + 20 && world.height >= 900 + 20, "the sky opened up for it");
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
    assert.equal(anyPairOverlaps(a.placed, 16), null);
    for (const order of [[rows[0], rows[2], rows[1]], [rows[2], rows[1], rows[0]]]) {
      const b = scatterInWorld(order, min, 16);
      assert.equal(anyPairOverlaps(b.placed, 16), null);
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

describe("the world a scatter asks for", () => {
  it("keeps the minimum world for a small sky, and grows it to fit a large one", () => {
    const min = { width: 1120, height: 900 };
    const few = Array.from({ length: 30 }, (_, i) => ({ key: `w${i}`, size: 60 }));
    assert.deepEqual(scatterInWorld(few, min, 26).world, min);
    const many = Array.from({ length: 500 }, (_, i) => ({ key: `w${i}`, size: 60 }));
    const { placed, world } = scatterInWorld(many, min, 26);
    assert.ok(world.width > min.width && world.height > min.height);
    assert.ok(Math.abs(world.width / world.height - 1120 / 900) < 0.01, "keeps the shape");
    assert.equal(anyPairOverlaps(placed, 26), null);
  });
});
