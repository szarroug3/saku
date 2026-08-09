// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/ordered-track.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { orderedTrack } from "./ordered-track.ts";
import { emptyHistory } from "@/lib/history-ops";
import { wordEntry } from "@/data/vocab";

// orderedTrack is for entry-list tracks (multi-char words, a grammar syllabus) —
// single glyphs are cohesive `character` items built by buildGlyphItem, not here.
test("orderedTrack — teaches its spec verbatim, each entry built through buildItem", () => {
  const track = orderedTrack("t", [
    { entry: wordEntry("先生"), kind: "word" },
    { entry: wordEntry("学生"), kind: "word" },
  ]);
  const items = track.order(emptyHistory());
  assert.deepEqual(items.map((i) => i.glyph), ["先生", "学生"], "order preserved");
  assert.deepEqual(items.map((i) => i.kind), ["word", "word"], "kinds carried through");
  assert.ok(items[0].facts.some((f) => f.kind === "romaji"), "先生 carries its reading");
});

test("orderedTrack — a spec entry with no facts is dropped, not hollow", () => {
  const track = orderedTrack("t", [
    { entry: wordEntry("先生"), kind: "word" },
    { entry: "word: nonexistent" as never, kind: "word" },
  ]);
  assert.deepEqual(
    track.order(emptyHistory()).map((i) => i.glyph),
    ["先生"],
    "the missing entry leaves no item",
  );
});

test("orderedTrack — order is stable across history (dueness is the scheduler's job)", () => {
  const track = orderedTrack("t", [{ entry: wordEntry("先生"), kind: "word" }]);
  assert.equal(track.order(emptyHistory()), track.order(emptyHistory()), "same built array");
});
