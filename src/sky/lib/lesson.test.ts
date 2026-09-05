// The lesson teaches bottom up, once each, skips what is in the sky, and
// opens one step at a time.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraph } from "@/sky/lib/graph";
import { isUnlocked, lessonSteps, starState } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

const item = (id: string, kind: SkyItem["kind"], extra: Partial<SkyItem> = {}): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", ...extra });

// train = 電 (雨 田) + 車; fireworks = 花 (艹 化) + 火; the sky already has 雨 田 車 艹 火
const graph = buildGraph([
  item("雨", "radical"), item("田", "radical"), item("車", "kanji"), item("艹", "radical"), item("化", "kanji"), item("火", "kanji"),
  item("電", "kanji", { components: ["雨", "田"] }), item("花", "kanji", { components: ["艹", "化"] }),
  item("電車", "word", { components: ["電", "車"] }), item("花火", "word", { components: ["花", "火"] }),
  ...["か", "き"].map((k) => item(k, "kana")), item("row:k", "kana", { group: true, components: ["か", "き"] }),
]);
const sky = new Set(["雨", "田", "車", "艹", "火"]);

describe("the lesson", () => {
  it("teaches the pieces, then the character, then the word, skipping what is in the sky", () => {
    const steps = lessonSteps(graph, ["電車", "花火"], sky);
    assert.deepEqual(steps.map((s) => s.id), ["電", "電車", "化", "花", "花火"]);
    assert.deepEqual(steps.map((s) => s.pick), ["電車", "電車", "花火", "花火", "花火"]);
  });

  it("a shared piece is taught once, at its first use", () => {
    const g = buildGraph([item("a", "radical"), item("X", "kanji", { components: ["a"] }), item("Y", "kanji", { components: ["a"] })]);
    assert.deepEqual(lessonSteps(g, ["X", "Y"], new Set()).map((s) => s.id), ["a", "X", "Y"]);
  });

  it("a kana row's sounds are the steps; the row itself is not", () => {
    assert.deepEqual(lessonSteps(graph, ["row:k"], new Set()).map((s) => s.id), ["か", "き"]);
  });

  it("opens one step at a time, and known stars are open for reference", () => {
    const steps = lessonSteps(graph, ["電車"], sky);
    const opened = new Set<string>();
    assert.equal(isUnlocked(steps, 0, opened), true);
    assert.equal(isUnlocked(steps, 1, opened), false);
    assert.equal(starState(steps, "電", opened, "電"), "selected");
    assert.equal(starState(steps, "電車", opened, "電"), "locked");
    assert.equal(starState(steps, "雨", opened, "電"), "open");
    opened.add("電");
    assert.equal(starState(steps, "電", opened, "電車"), "lit");
    assert.equal(starState(steps, "電車", opened, "電車"), "selected");
    opened.add("雨");
    assert.equal(starState(steps, "雨", opened, null), "lit");
  });
});
