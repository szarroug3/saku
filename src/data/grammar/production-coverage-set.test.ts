// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/production-coverage-set.test.ts
//
// WHAT A FORM ACTUALLY DRILLS, pinned as an exact set rather than a count.
//
// Every form/pattern splits its verb production into one scored skill PER
// conjugation class (9 godan + ichidan), plus the irregular verbs where that form
// conjugates them irregularly, plus the adjective types it attaches to (regular い,
// the いい exception, な). A count test ("17 facts") passes even if one class was
// dropped and another minted twice; this pins the QUALIFIERS, so a missing v5t or
// a stray adj-na fails loudly. The tables the learner sees are generated from the
// same registry, so locking the quiz set is the load-bearing half of table/quiz
// consistency — a table row with no fact would be a fact this set does not list.

import assert from "node:assert/strict";
import { test } from "node:test";

import { ALL_FACTS } from "@/lib/facts";

/** The @-qualifiers of a recipe's production facts, sorted for a stable compare. */
function quals(recipeId: string): string[] {
  const prefix = `grammar:${recipeId}/production`;
  return ALL_FACTS.filter((f) => String(f).startsWith(prefix))
    .map((f) => String(f).slice(prefix.length).replace(/^@/, "") || "(plain)")
    .sort();
}

const GODAN = ["v5b", "v5g", "v5k", "v5m", "v5n", "v5r", "v5s", "v5t", "v5u"];

test("音便 forms (て/た/たら): 9 godan + ichidan + 行く/する/来る + 高い/いい/静か", () => {
  const expected = [...GODAN, "v1", "iku", "suru", "kuru", "adj-i", "adj-na", "ii"].sort();
  for (const id of ["te-sequence", "ta-form", "tara"]) {
    assert.deepEqual(quals(id), expected, `${id} drills the wrong set`);
  }
});

test("〜ば: 9 godan + ichidan + adj-i + いい — no 行く/する/来る (regular there), no な (uses なら)", () => {
  assert.deepEqual(quals("ba"), [...GODAN, "v1", "adj-i", "ii"].sort());
});

test("〜ます: 9 godan + ichidan + する/来る — 行く is regular, no adjectives", () => {
  assert.deepEqual(quals("masu-form"), [...GODAN, "v1", "suru", "kuru"].sort());
});

test("〜ない: 9 godan + ichidan + する/来る + the ある exception, no adjectives", () => {
  assert.deepEqual(quals("nai-form"), [...GODAN, "v1", "suru", "kuru", "aru"].sort());
});
