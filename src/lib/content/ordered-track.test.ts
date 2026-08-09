// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/ordered-track.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { orderedTrack } from "./ordered-track.ts";
import { emptyHistory } from "@/lib/history-ops";
import { kanjiEntry } from "@/data/kanji";
import { wordEntry } from "@/data/vocab";

test("orderedTrack — teaches its spec verbatim, each entry built through buildItem", () => {
  const track = orderedTrack("t", [
    { entry: kanjiEntry("一"), kind: "kanji" },
    { entry: wordEntry("三"), kind: "number" },
  ]);
  const items = track.order(emptyHistory());
  assert.deepEqual(items.map((i) => i.glyph), ["一", "三"], "order preserved");
  assert.deepEqual(items.map((i) => i.kind), ["kanji", "number"], "kinds carried through");
  assert.ok(
    items[1].facts.some((f) => f.kind === "romaji"),
    "the number-word carries its reading",
  );
});

test("orderedTrack — a spec entry with no facts is dropped, not hollow", () => {
  const track = orderedTrack("t", [
    { entry: kanjiEntry("三"), kind: "kanji" },
    { entry: "word: nonexistent" as never, kind: "word" },
  ]);
  assert.deepEqual(
    track.order(emptyHistory()).map((i) => i.glyph),
    ["三"],
    "the missing entry leaves no item",
  );
});

test("orderedTrack — order is stable across history (dueness is the scheduler's job)", () => {
  const track = orderedTrack("t", [{ entry: kanjiEntry("一"), kind: "kanji" }]);
  assert.equal(track.order(emptyHistory()), track.order(emptyHistory()), "same built array");
});
