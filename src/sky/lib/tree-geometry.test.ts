import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildBranches, type Branch } from "@/sky/lib/branch";
import { polylinesIntersect } from "@/sky/lib/intersect";
import { canopyRadius, computeTreeGeometry, TRUNK_TOP } from "@/sky/lib/tree-geometry";
import type { SkyItem } from "@/sky/lib/types";

function item(id: string, overrides: Partial<SkyItem> = {}): SkyItem {
  return { id, kind: "radical", glyph: id, english: id, status: "wild", ...overrides };
}

/**
 * Asserts no two branches in `cart` render with crossing curves, except a
 * branch and its own direct parent — those are SUPPOSED to touch at exactly
 * one point (the fork point), which is not a crossing bug.
 *
 * This is the automated version of what the last several rounds of SAK-333
 * visual bugs were caught by eye: rendering the actual tree at real size and
 * looking for tangled lines. Catching it here means a future change to the
 * curve/layout math gets checked against real trees, not just against the
 * numbers a single hand-picked example happened to produce.
 */
function assertNoUnexpectedCrossings(cart: SkyItem[]): void {
  const geometry = computeTreeGeometry(buildBranches(cart));
  const byId = new Map(geometry.map((g) => [g.id, g]));

  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i];
      const b = geometry[j];
      const areDirectlyRelated = a.parentId === b.id || b.parentId === a.id;
      if (areDirectlyRelated) continue;

      assert.equal(
        polylinesIntersect(a.points, b.points),
        false,
        `branches "${a.id}" and "${b.id}" cross (parents: ${a.parentId ?? "trunk"} / ${b.parentId ?? "trunk"})`,
      );
    }
  }

  // Sanity: every non-root branch's parent is actually present, so the
  // "directly related" skip above is checking against real relationships,
  // not silently matching nothing.
  for (const g of geometry) {
    if (g.parentId !== null) assert.ok(byId.has(g.parentId), `${g.id}'s parent ${g.parentId} is missing`);
  }
}

const GALLERY_CART: SkyItem[] = [
  item("r-sui"),
  item("r-hi"),
  item("r-tori"),
  item("k-sui", { kind: "kanji", components: ["r-sui"] }),
  item("k-you", { kind: "kanji", components: ["r-hi", "r-tori"] }),
  item("k-hi", { kind: "kanji" }),
  item("w-suiyoubi", { kind: "word", components: ["k-sui", "k-you", "k-hi"] }),
  item("r-ki"),
  item("k-mori", { kind: "kanji", components: ["r-ki"] }),
  item("w-mori", { kind: "word", components: ["k-mori"] }),
];

describe("tree curve geometry — no unwanted crossings", () => {
  test("the dev gallery's sample cart (two words, mixed branch counts)", () => {
    assertNoUnexpectedCrossings(GALLERY_CART);
  });

  test("a single long chain of solo children (word -> kanji -> radical, no fan-out at all)", () => {
    const cart: SkyItem[] = [
      item("r-a"),
      item("k-a", { kind: "kanji", components: ["r-a"] }),
      item("w-a", { kind: "word", components: ["k-a"] }),
    ];
    assertNoUnexpectedCrossings(cart);
  });

  test("a wide sibling group (5 words, all leaves) — the naive-crowding case", () => {
    const cart: SkyItem[] = ["a", "b", "c", "d", "e"].map((id) => item(`w-${id}`, { kind: "word" }));
    assertNoUnexpectedCrossings(cart);
  });

  test("a dense subtree (one word, one kanji, six radicals) forced into a narrow arc", () => {
    const radicalIds = Array.from({ length: 6 }, (_, i) => `r-${i}`);
    const cart: SkyItem[] = [
      ...radicalIds.map((id) => item(id)),
      item("k-dense", { kind: "kanji", components: radicalIds }),
      item("w-dense", { kind: "word", components: ["k-dense"] }),
    ];
    assertNoUnexpectedCrossings(cart);
  });

  test("several unbalanced words side by side (one heavy, several single-leaf)", () => {
    const heavyRadicals = Array.from({ length: 4 }, (_, i) => `r-heavy-${i}`);
    const cart: SkyItem[] = [
      ...heavyRadicals.map((id) => item(id)),
      item("k-heavy", { kind: "kanji", components: heavyRadicals }),
      item("w-heavy", { kind: "word", components: ["k-heavy"] }),
      item("w-light-a", { kind: "word" }),
      item("w-light-b", { kind: "word" }),
      item("w-light-c", { kind: "word" }),
    ];
    assertNoUnexpectedCrossings(cart);
  });
});

describe("tree canopy geometry", () => {
  test("every leaf's tip sits on the canopy rim; every non-leaf's sits inside it", () => {
    const branches = buildBranches(GALLERY_CART);
    const radius = canopyRadius(branches);
    const leafIds = new Set<string>();
    const collect = (b: Branch): void => {
      if (b.branches.length === 0) leafIds.add(b.id);
      b.branches.forEach(collect);
    };
    branches.forEach(collect);

    for (const g of computeTreeGeometry(branches)) {
      const r = Math.hypot(g.tip.x - TRUNK_TOP.x, g.tip.y - TRUNK_TOP.y);
      if (leafIds.has(g.id)) assert.ok(Math.abs(r - radius) < 1e-6, `${g.id} should be on the rim (${r} vs ${radius})`);
      else assert.ok(r < radius, `${g.id} should sit inside the rim (${r} vs ${radius})`);
    }
  });

  test("the canopy grows with the cart", () => {
    const small = canopyRadius(buildBranches([item("w-a", { kind: "word" })]));
    const large = canopyRadius(buildBranches(GALLERY_CART));
    assert.ok(large > small);
  });

  test("every branch's origin lies on its parent's curve", () => {
    const geometry = computeTreeGeometry(buildBranches(GALLERY_CART));
    const byId = new Map(geometry.map((g) => [g.id, g]));
    for (const g of geometry) {
      if (g.parentId === null) continue;
      const parent = byId.get(g.parentId)!;
      // Nearest flattened-polyline vertex is a coarse check; the fork point
      // itself is computed from the exact bezier, so it lands between two
      // vertices — within a segment length of the nearest one.
      const nearest = Math.min(...parent.points.map((p) => Math.hypot(p.x - g.origin.x, p.y - g.origin.y)));
      const segment = parent.length / (parent.points.length - 1);
      assert.ok(nearest <= segment, `${g.id} origin is ${nearest}px from its parent's curve`);
    }
  });
});
