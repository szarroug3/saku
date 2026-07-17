// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/slice.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// The bar hides its Drill button on a slice with one thing to learn — a single
// kana IS its one reading, and drilling exactly that proves nothing. The gate is
// `sliceIsDrillable`, and its whole job is to be true for a kanji or word and
// false for a lone kana. These run it against real entry ids the app mints, so
// the rule is pinned to the data's actual fact counts and not to a hand-built
// slice that could drift from what `factsOf` returns.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { factsOf } from "@/lib/facts";
import { LIB_ENTRIES } from "@/lib/library/entries";
import { sliceIsDrillable } from "@/lib/library/slice";

/** One real entry id of each kind, so the assertions run against ids the app
 * actually mints and the fact counts its data actually carries. */
const kana = LIB_ENTRIES.find((e) => e.kind === KANA_SUBJECT)!;
const kanji = LIB_ENTRIES.find((e) => e.kind === KANJI_SUBJECT)!;
const word = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT)!;

describe("sliceIsDrillable — one thing to learn is not a drill", () => {
  test("a single kana has exactly one fact and is NOT drillable", () => {
    // The premise of the whole rule: a kana carries one reading fact, so its
    // slice is a one-question session. If this ever stops being 1, the rule's
    // reason has changed and the gate should be revisited.
    assert.equal(factsOf(kana.id).length, 1, "a kana must be a single fact");
    assert.equal(sliceIsDrillable({ label: kana.glyph, entries: [kana.id] }), false);
  });

  test("a kanji has many facts and IS drillable", () => {
    assert.ok(factsOf(kanji.id).length > 1, "a kanji must be multi-fact");
    assert.equal(sliceIsDrillable({ label: kanji.glyph, entries: [kanji.id] }), true);
  });

  test("a word has at least two facts and IS drillable", () => {
    assert.ok(factsOf(word.id).length > 1, "a word must be multi-fact");
    assert.equal(sliceIsDrillable({ label: word.glyph, entries: [word.id] }), true);
  });

  test("an empty slice is not drillable", () => {
    // No entries, no facts, nothing to ask — the button would be a lie.
    assert.equal(sliceIsDrillable({ label: "", entries: [] }), false);
  });

  test("two single-fact kana together ARE drillable — the gate is fact count, not subject", () => {
    // A multi-select that resolves to two facts is a real two-question drill,
    // even though each part alone would be hidden. The rule is about how many
    // things there are to learn, not about what kind of thing they are.
    const kana2 = LIB_ENTRIES.filter((e) => e.kind === KANA_SUBJECT).slice(0, 2);
    assert.equal(kana2.length, 2, "need two kana for this case");
    assert.equal(
      sliceIsDrillable({ label: "two kana", entries: kana2.map((e) => e.id) }),
      true,
    );
  });
});
