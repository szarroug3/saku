// What a word's Atlas page says it is (SAK-428).
//
// The forms folds listed every form a word takes without ever naming the group
// those forms come from, so a learner could read the whole of 知れる and still
// not know it was a る-verb. `wordFormKind` has named the group all along and
// nothing in the Sky read it. The block carries it now, with the entry that
// explains the group, and the Atlas sends that entry along so the chip has
// somewhere to go.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { grammarConceptEntry } from "@/data/grammar-concepts";
import { emptyHistory } from "@/lib/history-ops";
import { libEntry } from "@/lib/library/entries";
import type { EntryId } from "@/types";

import { atlasEntryFromHistory } from "./atlas";

const NOW = Date.UTC(2026, 8, 8);
const VERBS = grammarConceptEntry("verb-classes");
const ADJECTIVES = grammarConceptEntry("adjective-types");

const kindOf = (glyph: string) => atlasEntryFromHistory(emptyHistory(), `word:${glyph}`, NOW)?.teach?.wordKind;

describe("a word's page names the kind of word it is", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["知れる", "る-verb", VERBS],
    ["食べる", "る-verb", VERBS],
    ["知る", "う-verb", VERBS],
    ["する", "irregular verb", VERBS],
    ["来る", "irregular verb", VERBS],
    ["静か", "な-adjective", ADJECTIVES],
    ["高い", "い-adjective", ADJECTIVES],
  ];
  for (const [glyph, label, readAbout] of cases) {
    it(`calls ${glyph} ${label === "irregular verb" ? "an" : "a"} ${label}`, () => {
      assert.deepEqual(kindOf(glyph), { label, readAbout });
    });
  }

  it("says nothing about a word that does not conjugate", () => {
    assert.equal(kindOf("猫"), undefined);
    assert.equal(kindOf("勉強"), undefined);
  });

  it("sends the page the chip opens along with the word", () => {
    const entry = atlasEntryFromHistory(emptyHistory(), "word:知れる", NOW);
    assert.ok(entry, "no entry for 知れる");
    assert.ok(entry.items.some((x) => x.id === VERBS), "the verb classes page did not travel with the word");
  });

  it("points at pages that exist", () => {
    for (const id of [VERBS, ADJECTIVES]) assert.ok(libEntry(id as EntryId), `${id} is not an entry`);
  });
});
