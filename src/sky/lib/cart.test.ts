// The cart never lies: its total is the number of pieces the lesson will
// teach, a shared part is charged once, a learned part is free, and removing
// a pick takes down what it held open.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cartSummary, pickState, withoutPick } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";
import type { SkyItem } from "@/sky/lib/types";

const item = (id: string, kind: SkyItem["kind"], extra: Partial<SkyItem> = {}): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", ...extra });

// 電車 = 電 (雨 田) + 車; 電気 shares 電; a verb pair hangs off the word 開く; a
// kana row holds five kana and the ky row builds on the k row
const ITEMS: SkyItem[] = [
  item("雨", "radical"), item("田", "radical"), item("車", "kanji"), item("気", "kanji"),
  item("電", "kanji", { components: ["雨", "田"] }),
  item("電車", "word", { components: ["電", "車"] }),
  item("電気", "word", { components: ["電", "気"] }),
  item("開く", "word"), item("pair:開", "verbPair", { headword: "開く" }),
  ...["か", "き", "く", "け", "こ"].map((k) => item(k, "kana")),
  item("row:k", "kana", { group: true, components: ["か", "き", "く", "け", "こ"] }),
  item("row:ky", "kana", { group: true, components: ["row:k"] }),
];
const graph = buildGraph(ITEMS);
const none = new Set<string>();

describe("the cart", () => {
  it("prices a pick in real pieces and its total equals what the lesson teaches", () => {
    const one = cartSummary(graph, ["電車"], none);
    assert.equal(one.pieces, 5); // 雨 田 電 車 電車
    assert.equal(one.lines[0].cost.pieces.length, 5);
    const two = cartSummary(graph, ["電車", "電気"], none);
    assert.equal(two.pieces, 7); // + 気 電気; 電 and its parts charged once
    assert.equal(two.lines[1].cost.pieces.length, 2);
    assert.deepEqual(new Set(two.lines[1].cost.shared), new Set(["田", "電", "雨"]));
    assert.equal(two.lines.reduce((n, l) => n + l.cost.pieces.length, 0), two.pieces, "the rows add up to the total");
  });

  it("charges nothing for what is already in the sky, and names it", () => {
    const learned = new Set(["雨", "田", "車"]);
    const s = cartSummary(graph, ["電車"], learned);
    assert.equal(s.pieces, 2); // 電 電車
    assert.deepEqual(new Set(s.lines[0].cost.pieces), new Set(["電", "電車"]));
    assert.deepEqual(new Set(s.lines[0].cost.free), new Set(["田", "車", "雨"]));
  });

  it("warns past the cap and never blocks", () => {
    const picks = ["電車", "電気", "row:k"];
    const s = cartSummary(graph, picks, none, 8);
    assert.equal(s.pieces, 12);
    assert.equal(s.over, 4);
  });

  it("parts never lock; a headword or a row does, and the cart can open it", () => {
    // What locks is read through pickState, which is the caller's question:
    // a prerequisite picked as its own thing shows up in `needs`, and one
    // that only rides along never does.
    assert.deepEqual(pickState(graph, "電車", none, []).needs, [], "a kanji and its radicals ride along");
    assert.equal(pickState(graph, "電車", none, []).available, true);
    assert.deepEqual(pickState(graph, "row:k", none, []).needs, [], "a row's own five sounds are parts");
    assert.deepEqual(pickState(graph, "row:ky", none, []).needs, ["row:k"], "a row built on a row locks on it");
    assert.equal(pickState(graph, "pair:開", none, []).available, false);
    assert.deepEqual(pickState(graph, "pair:開", none, []).needs, ["開く"]);
    assert.equal(pickState(graph, "pair:開", none, ["開く"]).available, true);
    assert.deepEqual(pickState(graph, "pair:開", none, ["開く"]).openedByCart, ["開く"]);
    assert.equal(pickState(graph, "pair:開", new Set(["開く"]), []).available, true);
  });

  it("removing a pick takes down what it held open, and nothing else", () => {
    const picks = ["電車", "開く", "pair:開", "row:k", "row:ky"];
    assert.deepEqual(withoutPick(graph, picks, "開く", none), ["電車", "row:k", "row:ky"]);
    assert.deepEqual(withoutPick(graph, picks, "row:k", none), ["電車", "開く", "pair:開"]);
    assert.deepEqual(withoutPick(graph, picks, "電車", none), ["開く", "pair:開", "row:k", "row:ky"]);
  });

  it("a row costs its sounds, never itself", () => {
    const s = cartSummary(graph, ["row:k"], new Set(["き", "こ"]));
    assert.equal(s.pieces, 3);
    assert.deepEqual(new Set(s.lines[0].cost.pieces), new Set(["か", "く", "け"]));
    assert.deepEqual(new Set(s.lines[0].cost.free), new Set(["き", "こ"]));
  });
});
