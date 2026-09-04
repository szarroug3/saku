// The prerequisite graph, on the example Sam gave: word A is kanji A and
// kanji B; kanji A is radicals A and B; kanji B is radicals A and C. Six
// stars, radical A once.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraph } from "@/sky/lib/graph";
import type { SkyItem } from "@/sky/lib/types";

const item = (id: string, kind: SkyItem["kind"], components?: string[], extra: Partial<SkyItem> = {}): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", components, ...extra });

const ITEMS: SkyItem[] = [
  item("wordA", "word", ["kanjiA", "kanjiB"]),
  item("kanjiA", "kanji", ["radA", "radB"]),
  item("kanjiB", "kanji", ["radA", "radC"]),
  item("radA", "radical"),
  item("radB", "radical"),
  item("radC", "radical"),
  // a second word sharing kanji A, and a verb pair attached to it with its own kanji
  item("wordB", "word", ["kanjiA", "kanjiC"]),
  item("kanjiC", "kanji", ["radC"]),
  item("pairB", "verbPair", ["kanjiD"], { headword: "wordB" }),
  item("kanjiD", "kanji", ["radB"]),
];
const g = buildGraph(ITEMS);
const none = new Set<string>();

describe("the prerequisite graph", () => {
  it("is well-formed on good data", () => {
    assert.equal(g.size, 10);
    assert.deepEqual(g.dangling, []);
    assert.deepEqual(g.cycles, []);
    assert.deepEqual(g.prerequisitesOf("wordA"), ["kanjiA", "kanjiB"]);
    assert.deepEqual(g.dependentsOf("radA"), ["kanjiA", "kanjiB"]);
    assert.deepEqual(g.dependentsOf("kanjiA"), ["wordA", "wordB"]);
  });

  it("orders a lesson pieces first, then kanji, then the word, each piece once", () => {
    assert.deepEqual(g.orderOf("wordA"), ["radA", "radB", "kanjiA", "radC", "kanjiB", "wordA"]);
    assert.equal(g.orderOf("wordA").length, 6, "six stars: one per prerequisite plus the word");
    assert.deepEqual(g.closureOf("radA"), []);
    assert.deepEqual(g.orderOf("nope"), []);
  });

  it("a shared piece is one node, drawn at its deepest use, with a line from each parent", () => {
    const c = g.constellationOf("wordA");
    assert.equal(c.nodes.length, 6);
    assert.equal(c.nodes.filter((n) => n.id === "radA").length, 1);
    assert.deepEqual(c.nodes.find((n) => n.id === "radA"), { id: "radA", depth: 2 });
    assert.deepEqual(c.nodes[0], { id: "wordA", depth: 0 });
    assert.equal(c.edges.length, 6);
    assert.deepEqual(c.edges.filter(([, to]) => to === "radA").map(([from]) => from), ["kanjiA", "kanjiB"]);
  });

  it("availability is every direct prerequisite learned; unmet is the transitive rest, in order", () => {
    assert.equal(g.isAvailable("radA", none), true, "a radical needs nothing");
    assert.equal(g.isAvailable("kanjiA", none), false);
    assert.equal(g.isAvailable("kanjiA", new Set(["radA", "radB"])), true);
    assert.equal(g.isAvailable("wordA", new Set(["kanjiA", "kanjiB"])), true, "direct prerequisites only");
    assert.deepEqual(g.unmetPrerequisites("wordA", new Set(["radA", "kanjiB"])), ["radB", "kanjiA", "radC"], "kanji B being claimed says nothing about radical C");
    assert.deepEqual(g.unmetPrerequisites("wordA", new Set(["wordA"])), ["radA", "radB", "kanjiA", "radC", "kanjiB"], "claiming the word claims only the word");
    assert.equal(g.isAvailable("nope", none), false);
  });

  it("wouldUnlock says what opening this makes available, and nothing already open or learned", () => {
    assert.deepEqual(g.wouldUnlock("kanjiB", new Set(["kanjiA"])), ["wordA"]);
    assert.deepEqual(g.wouldUnlock("kanjiB", none), [], "word A still waits on kanji A");
    assert.deepEqual(g.wouldUnlock("radA", new Set(["radB", "radC"])), ["kanjiA", "kanjiB"]);
    assert.deepEqual(g.wouldUnlock("kanjiA", new Set(["kanjiB", "wordA"])), [], "word A is learned already");
    assert.deepEqual(g.wouldUnlock("kanjiA", new Set(["kanjiB", "kanjiC"])), ["wordA", "wordB"]);
  });

  it("a pick's cost skips what is learned and what earlier picks already bring", () => {
    assert.deepEqual(g.costOf("wordA", none), { pieces: ["radA", "radB", "kanjiA", "radC", "kanjiB", "wordA"], free: [], shared: [] });
    const withKnown = g.costOf("wordA", new Set(["radA", "kanjiA"]));
    assert.deepEqual(withKnown.free, ["radA", "kanjiA"]);
    assert.deepEqual(withKnown.pieces, ["radB", "radC", "kanjiB", "wordA"], "radical B is still charged: knowing kanji A is not knowing its parts");
    const second = g.costOf("wordB", none, ["wordA"]);
    assert.deepEqual(second.shared, ["radA", "radB", "kanjiA", "radC"]);
    assert.deepEqual(second.pieces, ["kanjiC", "wordB"]);
    assert.deepEqual(g.costOf("nope", none), { pieces: [], free: [], shared: [] });
  });

  it("pieceCount is the distinct new pieces of a whole cart", () => {
    assert.equal(g.pieceCount(["wordA"], none), 6);
    assert.equal(g.pieceCount(["wordA", "wordB"], none), 8, "kanji A and its radicals counted once across both");
    assert.equal(g.pieceCount(["wordA", "wordB"], new Set(["radA", "radB", "radC"])), 5);
    assert.equal(g.pieceCount(["wordA"], new Set(["kanjiA", "kanjiB"])), 4, "with both kanji known, the word and the three radicals are still new");
    assert.equal(g.pieceCount(["wordA"], new Set(["wordA"])), 5, "a claimed word still brings everything under it");
    assert.equal(g.pieceCount(["wordA", "wordA"], none), 6, "the same pick twice is still one");
    assert.equal(g.pieceCount([], none), 0);
    // a cart total equals the picks' costs added in order
    const total = ["wordA", "wordB"].reduce((sum, id, i, all) => sum + g.costOf(id, none, all.slice(0, i)).pieces.length, 0);
    assert.equal(total, g.pieceCount(["wordA", "wordB"], none));
  });

  it("a verb pair needs its headword and carries its own kanji and radicals", () => {
    assert.deepEqual(g.prerequisitesOf("pairB"), ["wordB", "kanjiD"]);
    assert.deepEqual(g.orderOf("pairB"), ["radA", "radB", "kanjiA", "radC", "kanjiC", "wordB", "kanjiD", "pairB"]);
    assert.equal(g.isAvailable("pairB", new Set(["wordB", "kanjiD"])), true);
    assert.deepEqual(g.wouldUnlock("kanjiD", new Set(["wordB"])), ["pairB"]);
    assert.equal(g.pieceCount(["pairB"], new Set(["wordB", "kanjiA", "kanjiC", "radA", "radB", "radC"])), 2, "just kanji D and the pair");
  });

  it("takes a predicate as well as a set", () => {
    assert.equal(g.isAvailable("kanjiA", (id) => id.startsWith("rad")), true);
    assert.equal(g.pieceCount(["wordA"], (id) => id.startsWith("rad")), 3);
  });

  it("reports dangling references and cut cycles instead of hanging or hiding them", () => {
    const bad = buildGraph([
      item("w", "word", ["k", "ghost"]),
      item("k", "kanji", ["r"]),
      item("r", "radical", ["k"]), // a cycle
      item("self", "kanji", ["self"]),
    ]);
    assert.deepEqual(bad.dangling, ["ghost"]);
    assert.equal(bad.cycles.length, 1);
    assert.deepEqual(bad.prerequisitesOf("w"), ["k"]);
    assert.deepEqual(bad.prerequisitesOf("self"), [], "an item is never its own prerequisite");
    assert.ok(bad.orderOf("w").length === 3, "the walk still terminates and reaches every node once");
  });
});
