// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/formula.test.ts
//
// The entry page's recipe card says "take any verb, put it in its て-form, add
// から". That is a claim about EVERY verb, which is a much larger claim than the
// cluster page's "here is 行く with から on it" — so these tests are about the
// generalisation, not about the conjugation. conjugate.test.ts owns 音便 and
// build.test.ts owns the "− trim + add" spelling; what is checked here is the
// part this file invented: that the parts come out separable, that the worked
// examples really do span classes rather than repeating one, and that the
// degenerate shapes (no suffix, no form, a wrap) come back as null rather than
// as an empty string a component would print an operator for.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { attachesTo, FORM_LABEL, HOST_LABEL, recipeFormula } from "./formula";
import { RECIPES, isProducible, type Recipe } from "../../data/grammar/recipes";
import { formsFor } from "../conjugate/index";

function byId(id: string): Recipe {
  const r = RECIPES.find((x) => x.id === id);
  assert.ok(r, `no recipe '${id}'`);
  return r;
}

describe("the formula comes apart", () => {
  test("〜てから is [any verb] + て-form + から", () => {
    const f = recipeFormula(byId("te-kara"));
    assert.equal(f.opening.length, 1);
    assert.equal(f.closing.length, 0);
    const o = f.opening[0]!;
    assert.equal(o.slot, "any verb");
    assert.equal(o.formLabel, "て-form");
    assert.equal(o.trim, null);
    assert.equal(o.add, "から");
  });

  test("〜なければならない carries its trim as a trim, not as prose", () => {
    const o = recipeFormula(byId("nakereba-naranai")).opening[0]!;
    assert.equal(o.formLabel, "ない-form");
    assert.equal(o.trim, "い");
    assert.equal(o.add, "ければならない");
  });

  test("a pattern that IS a form has add: null, not add: ''", () => {
    // 〜ば and 〜たら are forms the engine already produces. An empty string here
    // is what makes a component print "行けば + " with nothing after the plus.
    for (const id of ["ba", "tara", "potential"]) {
      const o = recipeFormula(byId(id)).opening[0]!;
      assert.equal(o.add, null, id);
    }
  });

  test("a bare-noun attachment has formLabel: null, a dictionary one does not", () => {
    // The two look identical on screen and are different in the data. See the
    // Formula doc for why they are not flattened.
    const nara = recipeFormula(byId("nara"));
    const noun = nara.opening.find((o) => o.host === "noun")!;
    const verb = nara.opening.find((o) => o.host === "verb")!;
    assert.equal(noun.formLabel, null);
    assert.equal(verb.formLabel, "just as it is");
  });
});

describe("worked examples are the engine, and they span classes", () => {
  test("〜てから works three different 音便, not three ichidan verbs", () => {
    const worked = recipeFormula(byId("te-kara")).opening[0]!.worked;
    assert.equal(worked.length, 3);
    // The vehicle pool lists 食べる, 見る and 起きる consecutively and all three
    // are v1. If this ever comes back as three い-dropping ichidan verbs, the
    // per-class de-duplication has stopped working and the card is claiming a
    // generalisation it is no longer showing.
    assert.deepEqual(
      worked.map((w) => `${w.from} → ${w.to}`),
      ["行く → 行ってから", "食べる → 食べてから", "書く → 書いてから"],
    );
  });

  test("〜すぎる works each host separately", () => {
    const f = recipeFormula(byId("sugiru"));
    const verb = f.opening.find((o) => o.host === "verb")!;
    const adjI = f.opening.find((o) => o.host === "adj-i")!;
    assert.equal(verb.worked[0]!.to, "行きすぎる");
    // 高い loses its い. A card that showed only the verb line would be telling
    // the reader 〜すぎる is a verb pattern — the exact failure buildRows was
    // changed to fix.
    assert.ok(adjI.worked.some((w) => w.from === "高い" && w.to === "高すぎる"));
  });

  test("a vacuous pattern still shows how it is built", () => {
    // 〜ことができる has NO production fact — "give me the ことができる form of
    // 食べる" is typing. It still has a build, and the page still shows it: the
    // chips say what is scored, the card says what is true.
    const o = recipeFormula(byId("koto-ga-dekiru")).opening[0]!;
    assert.equal(o.add, "ことができる");
    assert.ok(o.worked.length > 0);
    assert.ok(o.worked.every((w) => w.to === `${w.from}ことができる`));
  });

  test("a wrap builds whole or not at all", () => {
    const f = recipeFormula(byId("tari-tari"));
    assert.equal(f.closing.length, 1);
    // Both slots, in one example, through buildRow — never 行ったり on its own,
    // which is the half-a-pattern apply() refuses to hand back.
    assert.deepEqual(f.opening[0]!.worked, [
      { from: "行く + 読む", to: "行ったり読んだりする" },
    ]);
    // The closing half carries no second example of the same string.
    assert.deepEqual(f.closing[0]!.worked, []);
    // Both halves know the pattern wraps, so neither lead-in can claim the
    // two-word example belongs to one host.
    assert.equal(f.opening[0]!.wraps, true);
    assert.equal(f.closing[0]!.wraps, true);
  });

  test("only the four wraps are marked as wrapping", () => {
    const wrapping = RECIPES.filter((r) =>
      recipeFormula(r).opening.some((o) => o.wraps),
    );
    assert.deepEqual(
      wrapping.map((r) => r.id).sort(),
      RECIPES.filter((r) => r.wrap).map((r) => r.id).sort(),
    );
  });

  test("every producible recipe has at least one worked example on every host", () => {
    // The card's promise. A host with an empty worked line renders a formula
    // with nothing under it, which reads as data missing rather than as a rule.
    for (const r of RECIPES.filter(isProducible)) {
      for (const o of recipeFormula(r).opening) {
        assert.ok(o.worked.length > 0, `${r.id} / ${o.host} has no worked example`);
      }
    }
  });
});

describe("the labels cover the data", () => {
  test("every form the engine can produce has a reader-facing name", () => {
    // Record<Form, string> makes tsc enforce this, but only against the Form
    // union. This asserts it against what the engine actually emits, so a new
    // form reaching the recipes table cannot arrive nameless.
    for (const cls of ["v5k", "v1", "adj-i", "adj-na"] as const) {
      for (const form of formsFor(cls)) {
        assert.ok(FORM_LABEL[form], `no label for form '${form}'`);
      }
    }
  });

  test("every host a recipe attaches to has a reader-facing name", () => {
    for (const r of RECIPES) {
      for (const a of [...r.attach, ...(r.wrap?.close ?? [])]) {
        assert.ok(HOST_LABEL[a.host], `no label for host '${a.host}'`);
      }
    }
  });
});

describe("what it attaches to", () => {
  test("one host reads as a phrase, three read as a list", () => {
    assert.equal(attachesTo(byId("te-kara")), "attaches to a verb");
    assert.equal(
      attachesTo(byId("sugiru")),
      "attaches to a verb, an い-adjective or a な-adjective",
    );
  });

  test("a wrap says both ends", () => {
    // "attaches to a noun" would be half the truth about 本しか読まない, and the
    // missing half is the ない at the far end.
    assert.equal(
      attachesTo(byId("shika-nai")),
      "wraps around a phrase: opens on a noun, closes on a verb",
    );
  });

  test("every recipe produces a non-empty line", () => {
    for (const r of RECIPES) assert.ok(attachesTo(r).length > 0, r.id);
  });
});
