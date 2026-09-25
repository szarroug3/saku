// SAK-477. Each kind adds its own weight to a lesson, so a sentence type is
// not worth the same as the meaning of a word, and the lesson reads as a word
// for where it is rather than as a count.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SkyKind } from "@/sky/lib/types";
import { lessonSize, weightOf } from "@/sky/lib/weight";

// KIND_LABEL is a Record over every kind, so its keys are all of them
const KINDS = Object.keys(KIND_LABEL) as SkyKind[];

describe("the weight of a kind", () => {
  it("every kind has a weight of at least 1", () => {
    assert.ok(KINDS.length >= 12);
    for (const kind of KINDS) assert.ok(weightOf(kind) >= 1, `${kind} weighs ${weightOf(kind)}`);
  });

  it("a sentence type outweighs a grammar pattern, which outweighs a word", () => {
    assert.ok(weightOf("sentence") > weightOf("word"));
    assert.ok(weightOf("sentence") > weightOf("grammar"));
    assert.ok(weightOf("grammar") > weightOf("word"));
    assert.ok(weightOf("kanji") > weightOf("radical"));
  });

  it("is Sam's table", () => {
    const table = Object.fromEntries(["kana", "radical", "word", "kanji", "verbPair", "keigo", "counter", "grammar", "sentence"].map((k) => [k, weightOf(k as SkyKind)]));
    assert.deepEqual(table, { kana: 1, radical: 1, word: 1, kanji: 2, verbPair: 2, keigo: 2, counter: 2, grammar: 3, sentence: 4 });
  });
});

describe("the size of a lesson", () => {
  it("is a word for where the weight is against the cap", () => {
    assert.equal(lessonSize(0, 12), "Nothing yet");
    assert.equal(lessonSize(1, 12), "Light");
    assert.equal(lessonSize(3, 12), "Light");
    assert.equal(lessonSize(4, 12), "Medium", "a third of the cap is Medium");
    assert.equal(lessonSize(7, 12), "Medium");
    assert.equal(lessonSize(8, 12), "Full", "two thirds of the cap is Full");
    assert.equal(lessonSize(12, 12), "Full", "right at the cap is still Full");
    assert.equal(lessonSize(13, 12), "Too much");
  });
});
