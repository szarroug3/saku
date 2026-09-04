import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CANOPY_HALF_SPREAD_DEGREES,
  layoutCanopy,
  seededRandom,
  subtreeHeight,
  subtreeLeafCount,
  type CanopyNode,
} from "@/sky/lib/layout";
import type { Branch } from "@/sky/lib/branch";
import type { SkyItem } from "@/sky/lib/types";

function item(id: string): SkyItem {
  return { id, kind: "radical", glyph: id, english: id, status: "wild" };
}

function leaf(id: string): Branch {
  return { id, item: item(id), branches: [] };
}

function node(id: string, branches: Branch[]): Branch {
  return { id, item: item(id), branches };
}

function flatten(nodes: CanopyNode[]): CanopyNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

describe("subtreeLeafCount", () => {
  test("a leaf counts as 1", () => {
    assert.equal(subtreeLeafCount(leaf("a")), 1);
  });

  test("sums leaves across nested children", () => {
    const tree = node("root", [leaf("a"), node("mid", [leaf("b"), leaf("c")])]);
    assert.equal(subtreeLeafCount(tree), 3);
  });
});

describe("subtreeHeight", () => {
  test("a leaf is 0, a branch of leaves is 1, and so on", () => {
    assert.equal(subtreeHeight(leaf("a")), 0);
    assert.equal(subtreeHeight(node("k", [leaf("a")])), 1);
    assert.equal(subtreeHeight(node("w", [node("k", [leaf("a")]), leaf("b")])), 2);
  });
});

describe("seededRandom", () => {
  test("is deterministic for the same seed", () => {
    assert.equal(seededRandom("branch-a"), seededRandom("branch-a"));
  });

  test("differs across seeds (not a constant function)", () => {
    const values = new Set(["a", "b", "c", "d"].map(seededRandom));
    assert.equal(values.size, 4);
  });

  test("stays within [0, 1)", () => {
    for (const seed of ["x", "y", "a-long-branch-id:angle", ""]) {
      const v = seededRandom(seed);
      assert.ok(v >= 0 && v < 1, `${seed} -> ${v}`);
    }
  });
});

describe("layoutCanopy", () => {
  test("an empty cart lays out to nothing", () => {
    assert.deepEqual(layoutCanopy([]), []);
  });

  test("is stable across calls (seeded, not truly random)", () => {
    const branches = [leaf("a"), node("b", [leaf("b1"), leaf("b2")])];
    assert.deepEqual(layoutCanopy(branches), layoutCanopy(branches));
  });

  test("top-level wedges tile the whole fan, contiguously and in order", () => {
    const nodes = layoutCanopy([leaf("a"), leaf("b"), leaf("c")]);
    assert.equal(nodes[0].wedge[0], -CANOPY_HALF_SPREAD_DEGREES);
    assert.equal(nodes[nodes.length - 1].wedge[1], CANOPY_HALF_SPREAD_DEGREES);
    for (let i = 1; i < nodes.length; i++) {
      assert.ok(Math.abs(nodes[i].wedge[0] - nodes[i - 1].wedge[1]) < 1e-9, "wedges should abut");
    }
  });

  test("every tip sits inside its own wedge, at every depth", () => {
    const nodes = layoutCanopy([
      node("w1", [node("k1", [leaf("r1"), leaf("r2")]), leaf("k2")]),
      node("w2", [node("k3", [leaf("r3")])]),
    ]);
    for (const n of flatten(nodes)) {
      assert.ok(n.tipAngle >= n.wedge[0] && n.tipAngle <= n.wedge[1], `${n.branch.id} tip ${n.tipAngle} outside ${n.wedge}`);
    }
  });

  test("a child's wedge lies inside its parent's", () => {
    const nodes = layoutCanopy([node("w", [node("k", [leaf("r1"), leaf("r2")]), leaf("k2")])]);
    for (const parent of flatten(nodes)) {
      for (const child of parent.children) {
        assert.ok(child.wedge[0] >= parent.wedge[0] - 1e-9 && child.wedge[1] <= parent.wedge[1] + 1e-9);
      }
    }
  });

  test("siblings' wedges never overlap", () => {
    const nodes = layoutCanopy([node("w", [leaf("a"), leaf("b"), leaf("c"), leaf("d")])]);
    const kids = nodes[0].children;
    for (let i = 1; i < kids.length; i++) {
      assert.ok(kids[i].wedge[0] >= kids[i - 1].wedge[1] - 1e-9);
    }
  });

  test("a heavier subtree gets a wider wedge than a single-leaf sibling", () => {
    const nodes = layoutCanopy([node("heavy", [leaf("h1"), leaf("h2"), leaf("h3"), leaf("h4")]), leaf("light")]);
    const width = (n: CanopyNode) => n.wedge[1] - n.wedge[0];
    assert.ok(width(nodes[0]) > width(nodes[1]));
  });

  test("leaves sit on the rim; each generation above sits further in", () => {
    const nodes = layoutCanopy([node("w", [node("k", [leaf("r")]), leaf("k2")])]);
    const [w] = nodes;
    const [k, k2] = w.children;
    const [r] = k.children;
    assert.equal(r.tipRadiusRatio, 1);
    assert.equal(k2.tipRadiusRatio, 1);
    assert.ok(k.tipRadiusRatio < 1);
    assert.ok(w.tipRadiusRatio < k.tipRadiusRatio);
  });

  test("a lone child does not sit straight ahead of its parent", () => {
    const nodes = layoutCanopy([node("w", [node("k", [leaf("r")])])]);
    const [w] = nodes;
    const [k] = w.children;
    const [r] = k.children;
    assert.ok(Math.abs(k.tipAngle - w.tipAngle) > 3, `kanji should kink off its word, got ${k.tipAngle - w.tipAngle}`);
    assert.ok(Math.abs(r.tipAngle - k.tipAngle) > 3, `radical should kink off its kanji, got ${r.tipAngle - k.tipAngle}`);
  });

  test("fork positions stay strictly inside (0, 1) and never collide among siblings", () => {
    const nodes = layoutCanopy([node("w", Array.from({ length: 6 }, (_, i) => leaf(`r${i}`)))]);
    for (const n of flatten(nodes)) assert.ok(n.forkT > 0 && n.forkT < 1);
    const forkTs = nodes[0].children.map((c) => c.forkT).sort((a, b) => a - b);
    for (let i = 1; i < forkTs.length; i++) assert.ok(forkTs[i] > forkTs[i - 1], `collision: ${forkTs}`);
  });

  test("the child swinging farthest from its parent's heading forks earliest", () => {
    const nodes = layoutCanopy([node("w", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]), leaf("other")]);
    const [w] = nodes;
    const bySwing = [...w.children].sort(
      (x, y) => Math.abs(y.tipAngle - w.tipAngle) - Math.abs(x.tipAngle - w.tipAngle),
    );
    for (let i = 1; i < bySwing.length; i++) {
      assert.ok(
        bySwing[i].forkT > bySwing[i - 1].forkT,
        `${bySwing[i].branch.id} swings less than ${bySwing[i - 1].branch.id} so should fork later`,
      );
    }
  });

  test("a branch's children never straddle its own continuation", () => {
    // The parent's tip sits in its own stub slice; every child's whole
    // sub-wedge lies entirely on one side of it — see the header for why.
    const nodes = layoutCanopy([node("w", [node("k", [leaf("r1"), leaf("r2"), leaf("r3")])]), leaf("other")]);
    for (const parent of flatten(nodes)) {
      for (const child of parent.children) {
        const clearOfTip = child.wedge[1] <= parent.tipAngle + 1e-9 || child.wedge[0] >= parent.tipAngle - 1e-9;
        assert.ok(clearOfTip, `${child.branch.id}'s wedge ${child.wedge} straddles ${parent.branch.id}'s tip ${parent.tipAngle}`);
      }
    }
  });
});
