// confusionKnownFacts — the entry-complete confusion search space, and task 20's
// silent drop of a typed-READING confusion.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/confusion-search.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { confusionKnownFacts } from "@/lib/confusion-search";
import { knownFactIds } from "@/lib/known-facts";
import { confusedWith } from "@/lib/engine/index";
import { entryOf } from "@/lib/facts";
import { applySeen } from "@/lib/history-ops";
import { wordReadingFactId, wordMeaningFactId, wordEntry } from "@/data/vocab";
import type { HistoryFile } from "@/types";

const emptyHist = (): HistoryFile =>
  ({ sessions: [], facts: {} }) as unknown as HistoryFile;

const NANI_R = wordReadingFactId("何"); // shown card: 何's reading
const KA_R = wordReadingFactId("可"); // answers ["か"]
const KA_M = wordMeaningFactId("可"); // answers ["acceptable", …]

test("root cause: a known set holding only 可's MEANING drops a reading confusion", () => {
  // Sam met the word 可 by its meaning but not (yet) its reading — two separate
  // facts, two separate records. She then typed か (可's reading) on 何's reading
  // card. Over deck-plus-known-FACTS, no known fact answers か, so the confusion
  // is invisible: this is the bug exactly.
  const h = applySeen(emptyHist(), [KA_M], 1);
  assert.deepEqual(knownFactIds(h), [KA_M]);
  assert.equal(confusedWith(NANI_R, "か", [NANI_R], knownFactIds(h)), null);
});

test("fix: entry-complete space surfaces 可 from its meaning alone", () => {
  // Same history — only word:可/meaning recorded — but the search space now
  // expands each known fact to its entry's facts, so 可's READING (answers か)
  // becomes a candidate and the confusion is claimed.
  const h = applySeen(emptyHist(), [KA_M], 1);
  const space = confusionKnownFacts(h);
  assert.ok(space.includes(KA_R), "可's reading fact is in the search space");
  assert.ok(space.includes(KA_M), "可's meaning fact is still there");
  assert.equal(
    confusedWith(NANI_R, "か", [NANI_R], space),
    entryOf(KA_R),
    "typing か on 何's reading card names 可",
  );
});

test("the meaning confusion still works from the meaning fact", () => {
  // The originally-shipped case (task 20's first half): typing 可's gloss on a
  // meaning card. Unbroken by the widening.
  const h = applySeen(emptyHist(), [KA_M], 1);
  const NANI_M = wordMeaningFactId("何");
  assert.equal(
    confusedWith(NANI_M, "acceptable", [NANI_M], confusionKnownFacts(h)),
    entryOf(KA_M),
  );
});

test("nothing known: no fabrication", () => {
  // An empty history yields an empty space, so a typed miss claims nothing.
  const space = confusionKnownFacts(emptyHist());
  assert.deepEqual(space, []);
  assert.equal(confusedWith(NANI_R, "か", [NANI_R], space), null);
});

test("dedupe: one entry known by two facts expands once", () => {
  // Knowing both facts of 可 must not list either twice.
  const h = applySeen(emptyHist(), [KA_R, KA_M], 1);
  const space = confusionKnownFacts(h);
  assert.equal(new Set(space).size, space.length);
  assert.equal(space.filter((f) => entryOf(f) === wordEntry("可")).length, 2);
});
