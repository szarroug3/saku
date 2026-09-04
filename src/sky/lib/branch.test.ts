import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildBranches } from "@/sky/lib/branch";
import type { SkyItem } from "@/sky/lib/types";

function item(id: string, overrides: Partial<SkyItem> = {}): SkyItem {
  return {
    id,
    kind: "word",
    glyph: id,
    english: id,
    status: "planted",
    ...overrides,
  };
}

describe("buildBranches", () => {
  test("empty cart yields no branches", () => {
    assert.deepEqual(buildBranches([]), []);
  });

  test("an item with no components is a single leaf branch", () => {
    const radical = item("radical-a", { kind: "radical" });

    const branches = buildBranches([radical]);

    assert.equal(branches.length, 1);
    assert.equal(branches[0].item, radical);
    assert.deepEqual(branches[0].branches, []);
  });

  test("nests components recursively, word -> kanji -> radical", () => {
    const radicalA = item("radical-a", { kind: "radical" });
    const radicalB = item("radical-b", { kind: "radical" });
    const kanjiA = item("kanji-a", {
      kind: "kanji",
      components: ["radical-a", "radical-b"],
    });
    const word = item("word-a", { kind: "word", components: ["kanji-a"] });

    const branches = buildBranches([word, kanjiA, radicalA, radicalB]);

    assert.equal(branches.length, 1);
    const [wordBranch] = branches;
    assert.equal(wordBranch.item, word);
    assert.equal(wordBranch.branches.length, 1);

    const [kanjiBranch] = wordBranch.branches;
    assert.equal(kanjiBranch.item, kanjiA);
    assert.deepEqual(
      kanjiBranch.branches.map((b) => b.item),
      [radicalA, radicalB],
    );
  });

  test("only items nobody references as a component become top-level branches", () => {
    const radical = item("radical-a", { kind: "radical" });
    const kanji = item("kanji-a", { kind: "kanji", components: ["radical-a"] });

    const branches = buildBranches([radical, kanji]);

    assert.deepEqual(
      branches.map((b) => b.id),
      ["kanji-a"],
    );
  });

  test("an item shared by two parents is cloned into a branch under each", () => {
    const sharedRadical = item("radical-shared", { kind: "radical" });
    const kanjiA = item("kanji-a", {
      kind: "kanji",
      components: ["radical-shared"],
    });
    const kanjiB = item("kanji-b", {
      kind: "kanji",
      components: ["radical-shared"],
    });

    const branches = buildBranches([kanjiA, kanjiB, sharedRadical]);

    assert.equal(branches.length, 2);
    assert.equal(branches[0].branches[0].item, sharedRadical);
    assert.equal(branches[1].branches[0].item, sharedRadical);
    assert.notEqual(branches[0].branches[0], branches[1].branches[0]);
  });

  test("a component ID missing from the cart is skipped, not thrown", () => {
    const kanji = item("kanji-a", {
      kind: "kanji",
      components: ["radical-missing"],
    });

    const branches = buildBranches([kanji]);

    assert.equal(branches.length, 1);
    assert.deepEqual(branches[0].branches, []);
  });

  test("a cycle with no root produces no branches", () => {
    const a = item("a", { kind: "kanji", components: ["b"] });
    const b = item("b", { kind: "kanji", components: ["a"] });

    const branches = buildBranches([a, b]);

    // Neither is a root once each already appears in the other's components.
    assert.deepEqual(branches, []);
  });

  test("a cycle below a real root does not recurse forever", () => {
    const root = item("root", { kind: "word", components: ["a"] });
    const a = item("a", { kind: "kanji", components: ["b"] });
    const b = item("b", { kind: "kanji", components: ["a"] });

    const branches = buildBranches([root, a, b]);

    assert.equal(branches.length, 1);
    const branchA = branches[0].branches[0];
    assert.equal(branchA.item, a);
    const branchB = branchA.branches[0];
    assert.equal(branchB.item, b);
    // b's own "a" component is where the cycle closes: it renders once more
    // as a leaf (no further branches), instead of recursing forever.
    assert.equal(branchB.branches.length, 1);
    assert.equal(branchB.branches[0].item, a);
    assert.deepEqual(branchB.branches[0].branches, []);
  });
});
