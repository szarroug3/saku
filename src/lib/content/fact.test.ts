// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/fact.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { jp2enResponse } from "@/lib/ask-forms";
import { meaningFactId } from "@/data/kanji";
import { wordReadingFactId } from "@/data/vocab";
import type { FactKind } from "./fact.ts";

// FactKind IS ResponseKind, and the classifier is the existing jp2enResponse
// (reads FactInfo, no id-parsing). A number is a word whose facts split into a
// meaning (definition) and a reading (romaji) — the reading the counters track
// used to drop. Pin it so the classifier stays the single source of that truth.
test("a number's facts split into meaning (definition) + reading (romaji)", () => {
  for (const k of ["三", "百"]) {
    // The annotations also assert, at compile time, that jp2enResponse's result
    // IS a FactKind — i.e. FactKind === ResponseKind.
    const meaning: FactKind = jp2enResponse(meaningFactId(k));
    const reading: FactKind = jp2enResponse(wordReadingFactId(k));
    assert.equal(meaning, "definition", `${k} meaning is a definition fact`);
    assert.equal(reading, "romaji", `${k} reading is a romaji fact`);
  }
});
