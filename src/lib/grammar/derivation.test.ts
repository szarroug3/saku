// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/derivation.test.ts
//
// SAK-194: the grammar-production hint/reveal's two-step derivation.
//
// The first table below is the exact 7-row category coverage Sam verified
// against conjugate() while approving the mockup — いい, たかい, しずか, 行く,
// かく, たべる, する — pasted in verbatim (see the ticket) so a future edit
// that drifts from it fails loudly here. te-sequence is the recipe used to
// exercise it: bare て with no suffix, so every row is a single equation
// (step 1 only) and the table isolates exactly the thing being checked — the
// whole-word-vs-drop/add call for step 1 — without a step 2 in the way.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { deriveProduction } from "./derivation";
import { recipe } from "../../data/grammar/recipes";
import type { WordClass } from "../conjugate/types";
import type { Host } from "../../data/grammar/recipes";

function byId(id: string) {
  const r = recipe(id);
  assert.ok(r, `no recipe '${id}'`);
  return r;
}

/** [word, cls, host, expected て-form, expected title] — the SAK-194 approved
 * category table, now also asserting the changes-requested category/class
 * heading ("Irregular い-adjective", …) for each of the 7 rows. */
const TE_FORM_TABLE: readonly [string, WordClass, Host, string, string][] = [
  ["いい", "adj-ix", "adj-i", "よくて", "Irregular い-adjective"],
  ["たかい", "adj-i", "adj-i", "たかくて", "い-adjective"],
  ["しずか", "adj-na", "adj-na", "しずかで", "な-adjective"],
  ["行く", "v5k-s", "verb", "行って", "Irregular う-verb / godan"],
  ["かく", "v5k", "verb", "かいて", "う-verb / godan"],
  ["たべる", "v1", "verb", "たべて", "る-verb / ichidan"],
  ["する", "vs-i", "verb", "して", "Irregular verb"],
];

describe("deriveProduction — the SAK-194 approved て-form table (te-sequence)", () => {
  const teSequence = byId("te-sequence");
  for (const [word, cls, host, want, title] of TE_FORM_TABLE) {
    test(`${word} (${cls}) -> ${want}`, () => {
      const d = deriveProduction(teSequence, host, word, cls);
      assert.ok(d, `expected a derivation for ${word}`);
      assert.equal(d.word, word);
      assert.equal(d.answer, want);
      // te-sequence adds nothing and trims nothing (the built て-form IS the
      // whole pattern), so this is a single equation: step 1 only.
      assert.equal(d.step2, undefined);
      assert.ok(d.step1, "expected a step 1 equation");
      assert.equal(d.step1.to, want);
      assert.equal(d.title, title);
    });
  }

  test("いい and する render whole-word, with no trim/add", () => {
    const iiD = deriveProduction(teSequence, "adj-i", "いい", "adj-ix");
    assert.equal(iiD?.step1?.whole, true);
    assert.equal(iiD?.step1?.trim, undefined);
    assert.equal(iiD?.step1?.add, undefined);

    const suruD = deriveProduction(teSequence, "verb", "する", "vs-i");
    assert.equal(suruD?.step1?.whole, true);
  });

  test("たかい and かく render as drop/add, not whole-word", () => {
    const takaiD = deriveProduction(teSequence, "adj-i", "たかい", "adj-i");
    assert.equal(takaiD?.step1?.whole, undefined);
    assert.equal(takaiD?.step1?.trim, "い");
    assert.equal(takaiD?.step1?.add, "くて");

    const kakuD = deriveProduction(teSequence, "verb", "かく", "v5k");
    assert.equal(kakuD?.step1?.whole, undefined);
    assert.equal(kakuD?.step1?.trim, "く");
    assert.equal(kakuD?.step1?.add, "いて");
  });

  test("しずか drops nothing — an add-only step 1, still not whole-word", () => {
    const d = deriveProduction(teSequence, "adj-na", "しずか", "adj-na");
    assert.equal(d?.step1?.whole, undefined);
    assert.equal(d?.step1?.trim, undefined);
    assert.equal(d?.step1?.add, "で");
  });
});

describe("deriveProduction — title, the v5r-i (ある) special case", () => {
  // ある is godan (v5r-i) and its て-form is perfectly regular (あって) — the
  // ONLY irregular thing about it is its suppletive negative (ない, not
  // あらない). Since v5r-i is not in IRREGULAR_STEP1_CLASSES, its title
  // should track whether THIS instance actually rendered whole-word, not a
  // blanket "always irregular" or "never irregular" call.
  const teSequence = byId("te-sequence");

  test("ある's て-form (regular, whole=false) titles as plain う-verb / godan", () => {
    const d = deriveProduction(teSequence, "verb", "ある", "v5r-i");
    assert.ok(d);
    assert.equal(d.answer, "あって");
    assert.equal(d.step1?.whole, undefined);
    assert.equal(d.title, "う-verb / godan");
  });

  test("ある's nai-form (suppletive, whole=true) titles as Irregular う-verb / godan", () => {
    // nai-form: { host: "verb", form: "nai", add: "" } — the built FORM is
    // the whole answer here (no step 2), and conjugate(ある, v5r-i, nai) is
    // ない, which shares NO prefix with ある, so step 1 renders whole-word via
    // the same generic safety net every other class uses.
    const d = deriveProduction(byId("nai-form"), "verb", "ある", "v5r-i");
    assert.ok(d);
    assert.equal(d.answer, "ない");
    assert.equal(d.step1?.whole, true);
    assert.equal(d.title, "Irregular う-verb / godan");
  });
});

describe("deriveProduction — a genuine two-step derivation (te-permission, 〜てもいい)", () => {
  const tePermission = byId("te-permission");

  test("行く: whole-word step 1, then a plain add for step 2", () => {
    const d = deriveProduction(tePermission, "verb", "行く", "v5k-s");
    assert.ok(d);
    assert.equal(d.word, "行く");
    assert.equal(d.answer, "行ってもいい");
    assert.equal(d.step1?.whole, true);
    assert.equal(d.step1?.to, "行って");
    assert.equal(d.step2?.from, "行って");
    assert.equal(d.step2?.trim, undefined);
    assert.equal(d.step2?.add, "もいい");
    assert.equal(d.step2?.to, "行ってもいい");
  });

  test("たかい: drop/add step 1, then a plain add for step 2 (the ticket's own example)", () => {
    const d = deriveProduction(tePermission, "adj-i", "たかい", "adj-i");
    assert.ok(d);
    assert.equal(d.answer, "たかくてもいい");
    assert.equal(d.step1?.trim, "い");
    assert.equal(d.step1?.add, "くて");
    assert.equal(d.step1?.to, "たかくて");
    assert.equal(d.step2?.from, "たかくて");
    assert.equal(d.step2?.add, "もいい");
    assert.equal(d.step2?.to, "たかくてもいい");
  });
});

describe("deriveProduction — no BASE→FORM step: single-equation fallback", () => {
  test("a noun attachment (dake, form: null) has no step 1, and no title", () => {
    const d = deriveProduction(byId("dake"), "noun", "本", null);
    assert.ok(d);
    assert.equal(d.word, "本");
    assert.equal(d.answer, "本だけ");
    assert.equal(d.step1, undefined);
    assert.equal(d.title, undefined);
    assert.ok(d.step2);
    assert.equal(d.step2.from, "本");
    assert.equal(d.step2.add, "だけ");
    assert.equal(d.step2.to, "本だけ");
  });

  test("the dictionary-form attachment (ka, 〜か) has no step 1 either", () => {
    const d = deriveProduction(byId("ka"), "verb", "行く", "v5k-s");
    assert.ok(d);
    assert.equal(d.word, "行く");
    assert.equal(d.answer, "行くか");
    assert.equal(d.step1, undefined);
    assert.ok(d.step2);
    assert.equal(d.step2.from, "行く");
    assert.equal(d.step2.add, "か");
    assert.equal(d.step2.to, "行くか");
  });
});

describe("deriveProduction — the one wrap recipe (shika-nai) falls back gracefully", () => {
  test("null, not a crash or a broken equation: the verb host lives on wrap.close, not attach", () => {
    const d = deriveProduction(byId("shika-nai"), "verb", "食べる", "v1");
    assert.equal(d, null);
  });

  test("the noun (opening) host still derives fine on its own terms", () => {
    // shika-nai never mints a production fact for its noun host (only the
    // verb half is drilled — see index.ts), so grammarHint never asks this
    // in practice. But the function itself is host-general and honest about
    // what IS there: the opening half (本 + しか → 本しか) is a real,
    // unconjugated single-equation attachment, unrelated to the verb host's
    // wrap-only invisibility tested above.
    const d = deriveProduction(byId("shika-nai"), "noun", "本", null);
    assert.ok(d);
    assert.equal(d.answer, "本しか");
    assert.equal(d.step1, undefined);
  });
});

describe("deriveProduction — refuses rather than fabricates", () => {
  test("a host this recipe doesn't open on returns null", () => {
    // te-request only attaches to a verb.
    const d = deriveProduction(byId("te-request"), "adj-i", "たかい", "adj-i");
    assert.equal(d, null);
  });

  test("a defective conjugation (no form to build) returns null, not a broken equation", () => {
    // できる has no volitional — the engine's defectiveness table refuses it
    // outright (できようとする is not a sentence) — used here only as a
    // conjugation known to come back !ok.
    const d = deriveProduction(byId("volitional-form"), "verb", "できる", "v1");
    assert.equal(d, null);
  });
});
