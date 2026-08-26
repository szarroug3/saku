// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/grammar/gloss.test.ts
//
// SAK-193: dropDoScaffold strips "do"/"does"/"doing" scaffolding from a
// recipe's gloss, and never touches "did"/"done". The fixture below is the
// exact before/after table Sam hand-reviewed against every recipe's actual
// gloss in the ticket — pasted in verbatim so a future edit that drifts from
// it fails loudly here, rather than silently reaching a learner.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { dropDoScaffold } from "./gloss.ts";

/** [before, after] — the SAK-193 approved table, one row per distinct gloss
 * string that contains do/does/doing scaffolding. Several recipes share the
 * same gloss text (the 7 "must do X" obligation siblings; te-kara and
 * ta-ato-de both "after doing X"; koto-ga-dekiru and potential both "can do
 * X") so the table has one row per STRING, not one row per recipe id — the
 * transform is a pure function of the string, so that is the whole test. */
const APPROVED_TABLE: readonly [string, string][] = [
  ["please do X", "please X"], // te-request
  ["do X, and then / because X", "X, and then / because X"], // te-sequence
  ["may do X", "may X"], // te-permission
  ["must not do X", "must not X"], // te-prohibition
  ["after doing X", "after X"], // te-kara, ta-ato-de
  ["is doing X / is in the state of X", "is X / is in the state of X"], // te-iru
  ["do X completely / do X regrettably", "X completely / X regrettably"], // te-shimau
  ["try doing X", "try X"], // te-miru
  ["do X in advance", "X in advance"], // te-oku
  ["go on doing X / X from now on", "go on X / X from now on"], // te-iku
  ["come to do X / X up to now", "come to X / X up to now"], // te-kuru
  ["do X for someone", "X for someone"], // te-ageru
  ["someone does X for me", "someone X for me"], // te-kureru
  ["have someone do X", "have someone X"], // te-morau
  [
    "plain negative, “doesn’t / won’t do X”",
    "plain negative, “doesn’t / won’t X”",
  ], // nai-form
  ["please don't do X", "please don't X"], // nai-request
  ["without doing X", "without X"], // nai-de
  ["don't have to do X", "don't have to X"], // nakute-mo-ii
  ["must do X", "must X"], // nakereba-naranai + its 6 siblings
  ["had better not do X", "had better not X"], // nai-hou-ga-ii
  ["had better do X", "had better X"], // ta-hou-ga-ii
  ["do things like X and Y", "things like X and Y"], // tari-tari (wrap)
  ["while doing X", "while X"], // nagara
  ["do X too much / too X", "X too much / too X"], // sugiru
  ["how to X / way of doing X", "how to X / way of X"], // kata
  ["can do X", "can X"], // koto-ga-dekiru, potential
  ["before doing X", "before X"], // mae-ni
];

/** did/done are NEVER touched — the 4 recipes where the past tense is the
 * actual meaning being taught, not scaffolding. */
const NEVER_TOUCHED: readonly string[] = [
  "plain past, “did X”", // ta-form
  "have done X before", // ta-koto-ga-aru
  "just did X", // ta-bakari, ta-tokoro (same string)
];

describe("dropDoScaffold matches the SAK-193 approved table exactly", () => {
  for (const [before, after] of APPROVED_TABLE) {
    test(`"${before}" -> "${after}"`, () => {
      assert.equal(dropDoScaffold(before), after);
    });
  }
});

describe("did/done are past tense, not scaffolding, and are never dropped", () => {
  for (const gloss of NEVER_TOUCHED) {
    test(`"${gloss}" is unchanged`, () => {
      assert.equal(dropDoScaffold(gloss), gloss);
    });
  }
});

describe("edge cases the unconditional strip must not mishandle", () => {
  test("a gloss with no X and no do/does/doing is unchanged", () => {
    assert.equal(dropDoScaffold("describe a noun"), "describe a noun");
  });

  test("a gloss with X but no do/does/doing is unchanged", () => {
    assert.equal(dropDoScaffold("because X"), "because X");
  });

  test("'doesn't' is a contraction, not the scaffold word 'does' + X", () => {
    // there-isn't-X's own gloss: "doesn't" must survive untouched because it is
    // not followed by a bare "X" — \bdoes\b would not even match inside it, but
    // this pins the behaviour so a future regex tweak can't regress it quietly.
    assert.equal(
      dropDoScaffold("there isn’t X / doesn’t have X"),
      "there isn’t X / doesn’t have X",
    );
  });
});
