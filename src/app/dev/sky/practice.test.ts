// Practice's adapter: what a recipe resolves to, and which asks a pool
// carries. The "reading in a word" ask is the one that was never lit
// (Sam, 2026-09-05): a kanji's word-anchored readings are its own facts,
// gated on the learner having met a word that carries them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { practicePreview } from "./practice";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 5);

describe("practicePreview", () => {
  const history = sampleHistory(NOW);

  it("lights the reading-in-a-word ask once a kanji's word has been met", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, collections: ["kanji"], size: "all" }, {}, NOW);
    assert.equal(preview.asksAvailable["reading-in-word"], true);
    const inWord = preview.items.flatMap((p) => p.facts).filter((f) => /^kanji:.\/reading@../.test(f));
    assert.ok(inWord.length > 0);
  });

  it("never asks a kanji how it is said on its own", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, collections: ["kanji"], asks: ["reading"], size: "all" }, {}, NOW);
    assert.equal(preview.asksAvailable.reading, false);
    assert.equal(preview.matched, 0);
  });

  it("caps the deck at the size asked for, shakiest first", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, size: 5 }, {}, NOW);
    assert.equal(preview.items.length, 5);
    assert.ok(preview.matched > 5);
    const misses = preview.items.map((p) => p.misses);
    assert.deepEqual([...misses].sort((a, b) => b - a), misses);
  });
});
