// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/transitivity.test.ts
//
// 〜てある MEANS SOMEBODY DID IT, so it needs a verb somebody does to something.
// 行ってある, 死んである and 来てある are not Japanese, and the app used to state
// the rule as "any verb", lead with 行く → 行ってある, deal 行く as a drill vehicle,
// and then grade the ungrammatical answer CORRECT.
//
// The app already knew which verbs are which — JMdict's vt/vi, in vocab.json,
// read by lib/word-forms.ts. What was missing was a way for a recipe to SAY it
// and for the pickers to hear it, so these tests are about the plumbing at every
// place a vehicle is chosen or accepted:
//
//   the pool       vehiclesFor      — never deals one the recipe forbids
//   the fact       buildExample     — bakes on a verb the recipe takes
//   the page       recipeFormula    — states the rule the pattern really has
//   the grader     questionsFor     — refuses the answer built on a bad vehicle
//
// The last is the one that matters most: a picker that never deals 行く is not a
// guarantee that nothing ever arrives carrying it. A stale serialized runtime,
// a re-cut pool, a hand-made ctx — the grader is the backstop and it is tested
// as one.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { patternProductionFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { questionsFor, type GrammarVehicle, type PromptContext } from "@/lib/engine/question";
import { buildExample } from "@/lib/grammar/example";
import { attachesTo, recipeFormula } from "@/lib/grammar/formula";
import {
  VERB_VEHICLES,
  transitivityAllows,
  transitivityOf,
  vehiclesFor,
} from "@/lib/grammar/vehicles";
import type { Direction } from "@/types";

const TE_ARU = RECIPES.find((r) => r.id === "te-aru");
const DIRS: Direction[] = ["jp2en", "en2jp"];

/** The drill's own ctx shape, built by hand — the point is to hand the grader a
 * vehicle the picker would never have given it. */
function ctxFor(surface: string): PromptContext {
  const v = VERB_VEHICLES.find((x) => x.surface === surface);
  assert.ok(v, `${surface} is in the vehicle pool`);
  const gv: GrammarVehicle = { surface: v.surface, kana: v.kana, cls: v.cls };
  return { grammarVehicle: gv };
}

function grade(given: string, ctx: PromptContext): boolean {
  const fact = patternProductionFactId("te-aru", "verb");
  return DIRS.every((d) => questionsFor(fact).check(fact, d, given, ctx));
}

function gradeAny(given: string, ctx: PromptContext): boolean {
  const fact = patternProductionFactId("te-aru", "verb");
  return DIRS.some((d) => questionsFor(fact).check(fact, d, given, ctx));
}

describe("the dictionary's own vt/vi, read into the grammar layer", () => {
  test("every verb in the pool resolves to one or the other", () => {
    // A verb that resolves to null would be silently ineligible for every
    // restricted recipe — the same silent-drop failure word-forms.ts's own
    // header records twice. A re-ingest that renames a tag fails HERE.
    const unresolved = VERB_VEHICLES.filter((v) => transitivityOf(v.surface) === null);
    assert.deepEqual(unresolved.map((v) => v.surface), []);
  });

  test("a verb tagged both ways counts as transitive", () => {
    // 待つ and する carry vi AND vt. A pattern asking for a transitive verb is
    // asking whether a transitive reading exists, and for these it does.
    assert.equal(transitivityOf("待つ"), "transitive");
    assert.equal(transitivityOf("する"), "transitive");
  });

  test("the verbs the card names are intransitive", () => {
    for (const w of ["行く", "死ぬ", "来る"]) {
      assert.equal(transitivityOf(w), "intransitive", w);
    }
  });
});

describe("no recipe is served a vehicle it forbids", () => {
  test("PROPERTY: every vehicle every recipe deals passes the recipe's own rule", () => {
    const bad: string[] = [];
    for (const r of RECIPES) {
      for (const v of vehiclesFor(r)) {
        if (!transitivityAllows(r, v.surface)) bad.push(`${r.id} on ${v.surface}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("PROPERTY: the fact's baked vehicle passes it too", () => {
    // The baked example is the answer the drill falls back to when no varied
    // vehicle is legal, so a bad word here is a bad answer string in the fact
    // itself — which is exactly what 行ってある was.
    const bad: string[] = [];
    for (const r of RECIPES) {
      const ex = buildExample(r);
      if (ex && !transitivityAllows(r, ex.lemma)) bad.push(`${r.id} on ${ex.lemma}`);
    }
    assert.deepEqual(bad, []);
  });

  test("〜てある deals no intransitive verb", () => {
    assert.ok(TE_ARU);
    const dealt = vehiclesFor(TE_ARU, "verb").map((v) => v.surface);
    for (const w of ["行く", "死ぬ", "来る", "起きる", "泳ぐ", "遊ぶ", "帰る"]) {
      assert.ok(!dealt.includes(w), `${w} must not be dealt`);
    }
  });

  test("〜てある still has verbs enough to drill on", () => {
    assert.ok(TE_ARU);
    const dealt = vehiclesFor(TE_ARU, "verb");
    // Nine of the sixteen survive, across five conjugation classes. A pattern
    // narrowed to one or two vehicles would be a pattern that cannot be
    // practised, and the number is asserted rather than assumed.
    assert.equal(dealt.length, 9);
    assert.ok(new Set(dealt.map((v) => v.cls)).size >= 4);
  });

  test("〜ている is deliberately NOT restricted", () => {
    // The sibling pattern, and the contrast is the thing worth seeing: 〜ている
    // takes both kinds (食べている, 開いている). Restricting it would be inventing
    // a rule Japanese does not have.
    const iru = RECIPES.find((r) => r.id === "te-iru");
    assert.ok(iru);
    assert.equal(iru.transitivity, undefined);
    assert.equal(vehiclesFor(iru, "verb").length, VERB_VEHICLES.length);
  });
});

describe("the grader refuses a form built on a verb the pattern does not take", () => {
  test("行ってある, 死んである and 来てある are rejected", () => {
    // Each one handed to the grader WITH the ctx that built it — the exact shape
    // the drill sends, and the shape that used to grade these correct.
    for (const [word, answer] of [
      ["行く", "行ってある"],
      ["死ぬ", "死んである"],
      ["来る", "来てある"],
    ] as const) {
      const ctx = ctxFor(word);
      assert.equal(gradeAny(answer, ctx), false, answer);
      // And in kana, which is the spelling a romaji typist actually reaches.
      assert.equal(gradeAny("いってある", ctx), false, "いってある");
    }
  });

  test("an intransitive vehicle falls back to the baked answer, it does not open the gate", () => {
    // Refusing the vehicle must not degrade into accepting anything. The card
    // reverts to the fact's own baked example — which is now 書いてある.
    const ctx = ctxFor("行く");
    assert.equal(gradeAny("行ってある", ctx), false);
    assert.equal(grade("書いてある", ctx), true);
  });

  test("the genuine cases still grade correct", () => {
    for (const [word, answer, kana] of [
      ["書く", "書いてある", "かいてある"],
      ["読む", "読んである", "よんである"],
      ["買う", "買ってある", "かってある"],
      ["する", "してある", "してある"],
    ] as const) {
      const ctx = ctxFor(word);
      assert.equal(grade(answer, ctx), true, answer);
      assert.equal(grade(kana, ctx), true, kana);
    }
  });
});

describe("the Library page states the rule the pattern actually has", () => {
  test("the slot is not 'any verb', and the worked line agrees with it", () => {
    assert.ok(TE_ARU);
    const f = recipeFormula(TE_ARU).opening[0];
    assert.ok(f);
    assert.notEqual(f.slot, "any verb");
    assert.equal(f.slot, "any verb that somebody does to something");
    assert.equal(f.workedLead, "Any verb you know that somebody does to something");
    assert.equal(attachesTo(TE_ARU), "attaches to a verb that somebody does to something");
  });

  test("no em dash in any of it", () => {
    // House rule for user-facing strings, and these are three of them.
    assert.ok(TE_ARU);
    const f = recipeFormula(TE_ARU).opening[0];
    assert.ok(f);
    for (const s of [f.slot, f.workedLead, attachesTo(TE_ARU)]) {
      assert.ok(!s.includes("—"), s);
    }
  });

  test("行く is nowhere on the page, and 書いてある leads", () => {
    assert.ok(TE_ARU);
    const f = recipeFormula(TE_ARU).opening[0];
    assert.ok(f);
    assert.deepEqual(
      f.worked.filter((w) => w.from === "行く"),
      [],
    );
    assert.equal(f.worked[0]?.from, "書く");
    assert.equal(f.worked[0]?.to, "書いてある");
    assert.equal(buildExample(TE_ARU)?.form, "書いてある");
  });

  test("an unrestricted pattern is untouched, and still leads with 行く", () => {
    // The whole change has to be invisible on 80 of the 81 rows.
    const kara = RECIPES.find((r) => r.id === "te-kara");
    assert.ok(kara);
    const f = recipeFormula(kara).opening[0];
    assert.ok(f);
    assert.equal(f.slot, "any verb");
    assert.equal(f.workedLead, "Any verb you know");
    assert.equal(attachesTo(kara), "attaches to a verb");
    assert.equal(f.worked[0]?.from, "行く");
  });
});
