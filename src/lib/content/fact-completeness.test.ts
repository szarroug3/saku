// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/fact-completeness.test.ts
//
// THE invariant the whole Stage-1 fix rests on (docs/architecture-refactor.md §4):
// a taught item's fact-set is EXACTLY factsOf(entry) — no fact dropped, none
// invented. This is why a number can't lose its reading: buildItem takes ALL the
// entry's facts, so "meaning without reading" is unrepresentable. Locking it here
// means a future refactor of buildItem can't quietly narrow the set the way the
// old counters path did (it hand-picked a meaning fact and left the reading out).

import assert from "node:assert/strict";
import test from "node:test";

import { buildItem } from "./build-item.ts";
import { factsOf } from "@/lib/facts";
import { kanjiEntry } from "@/data/kanji";
import { wordEntry } from "@/data/vocab";
import type { ContentKind } from "./item";

const CASES: ReadonlyArray<{ entry: ReturnType<typeof kanjiEntry>; kind: ContentKind; note: string }> = [
  { entry: kanjiEntry("三"), kind: "kanji", note: "a kanji (meaning + readings)" },
  { entry: wordEntry("三"), kind: "number", note: "a number-word (meaning + reading)" },
  { entry: kanjiEntry("日"), kind: "kanji", note: "a many-fact kanji" },
  { entry: wordEntry("先生"), kind: "word", note: "an ordinary multi-kanji word" },
];

for (const { entry, kind, note } of CASES) {
  test(`fact completeness — ${note}: item facts == factsOf(entry)`, () => {
    const item = buildItem(entry, kind);
    assert.ok(item, `${entry} has facts to build from`);
    const got = item!.facts.map((f) => f.id);
    const want = factsOf(entry);
    // No fact dropped, none invented, no duplicates.
    assert.equal(got.length, want.length, "same count");
    assert.deepEqual(new Set(got), new Set(want), "same set of fact ids");
  });
}

test("fact completeness — a number-word's set spans both meaning and reading", () => {
  // The exact drop we are guarding against: the reading fact must be present, not
  // just some meaning fact. jp2enResponse classifies them as romaji vs definition.
  const item = buildItem(wordEntry("三"), "number")!;
  const kinds = new Set(item.facts.map((f) => f.kind));
  assert.ok(kinds.has("definition"), "carries a meaning fact");
  assert.ok(kinds.has("romaji"), "carries a reading fact — the one that used to vanish");
});
