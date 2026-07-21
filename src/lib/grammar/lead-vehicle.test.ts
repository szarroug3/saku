// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/lead-vehicle.test.ts
//
// TWO PATTERNS WERE LED BY A SENTENCE NOBODY SAYS, and both for the same
// mechanical reason: 行く is the app's default vehicle everywhere, so it is the
// first worked example on every page whether or not the pattern can take it.
//
//   〜に行く led with 行く → 行きに行く. Not strained — not Japanese. The slot is
//   the errand you go on, and going is not an errand.
//   〜られる (受身), glossed "is X-ed (by someone)", led with 行く → 行かれる.
//   That form exists, but it is the OTHER passive: 友達に行かれた, somebody went
//   and it put you out. Shown as the flagship of "is X-ed" it teaches that
//   行かれる means "is gone".
//
// They are fixed on DIFFERENT AXES, and that is the point of having two fields.
// The passive genuinely wants a verb somebody does to something, which the
// dictionary already knows, so it says `transitivity` and thousands of words
// sort themselves. 〜に行く does not: 遊びに行く and 泳ぎに行く are the pattern at
// its most ordinary and both verbs are intransitive, so the only honest form of
// the restriction is the two verbs named — `notOn`.
//
// Tested at every seam a vehicle is chosen or accepted, the way the 〜てある
// restriction is (see transitivity.test.ts): the pool, the baked fact, the page,
// and the grader. The grader matters most — a picker that never deals 行く is
// not a guarantee that nothing ever arrives carrying it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { patternProductionFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { questionsFor, type GrammarVehicle, type PromptContext } from "@/lib/engine/question";
import { buildRow } from "@/lib/grammar/build";
import { buildExample } from "@/lib/grammar/example";
import { attachesTo, recipeFormula } from "@/lib/grammar/formula";
import { VERB_VEHICLES, recipeAllows, vehiclesFor } from "@/lib/grammar/vehicles";
import type { Direction } from "@/types";

const NI_IKU = RECIPES.find((r) => r.id === "ni-iku");
const PASSIVE = RECIPES.find((r) => r.id === "passive");
const DIRS: Direction[] = ["jp2en", "en2jp"];

/** The drill's own ctx shape, built by hand — the point is to hand the grader a
 * vehicle the picker would never have given it. */
function ctxFor(surface: string): PromptContext {
  const v = VERB_VEHICLES.find((x) => x.surface === surface);
  assert.ok(v, `${surface} is in the vehicle pool`);
  const gv: GrammarVehicle = { surface: v.surface, kana: v.kana, cls: v.cls };
  return { grammarVehicle: gv };
}

function gradedByAnyDirection(id: string, given: string, ctx: PromptContext): boolean {
  const fact = patternProductionFactId(id, "verb");
  return DIRS.some((d) => questionsFor(fact).check(fact, d, given, ctx));
}

describe("〜に行く does not send you somewhere in order to go", () => {
  test("行く and 来る are named, and nothing else is", () => {
    // The list is the whole restriction and it is meant to stay two long. A
    // third entry is a sign the recipe wants a CATEGORY, which is what
    // `transitivity` is for — see the field's doc.
    assert.ok(NI_IKU);
    assert.deepEqual(NI_IKU.notOn, ["行く", "来る"]);
    assert.equal(NI_IKU.transitivity, undefined);
  });

  test("the pool refuses both and keeps the rest", () => {
    assert.ok(NI_IKU);
    const pool = vehiclesFor(NI_IKU, "verb").map((v) => v.surface);
    assert.ok(!pool.includes("行く"), "行きに行く is dealable");
    assert.ok(!pool.includes("来る"), "来に行く is dealable");
    // The two intransitives that prove the axis is not transitivity. If these
    // ever go missing, someone has reached for the wrong field.
    assert.ok(pool.includes("泳ぐ"), "泳ぎに行く is the pattern at its best");
    assert.ok(pool.includes("遊ぶ"), "遊びに行く is the pattern at its best");
    assert.ok(pool.includes("食べる"));
  });

  test("食べに行く leads the page, the fact and the cluster row", () => {
    assert.ok(NI_IKU);
    const f = recipeFormula(NI_IKU).opening[0];
    assert.ok(f);
    assert.equal(f.worked[0]?.from, "食べる");
    assert.equal(f.worked[0]?.to, "食べに行く");
    assert.deepEqual(f.worked.filter((w) => w.from === "行く"), []);
    // The lead on the page and the answer the drill scores are the same word.
    assert.equal(buildExample(NI_IKU)?.lemma, "食べる");
    assert.equal(buildExample(NI_IKU)?.form, "食べに行く");
    assert.equal(buildRow(NI_IKU)?.built, "食べに行く");
  });

  test("the slot is still 'any verb' — this restriction is not a kind of verb", () => {
    // `notOn` names two words; it does not narrow the CATEGORY, so the sentence
    // on the card must not claim it does. Saying "any verb that just happens"
    // here would be false in the other direction: 食べる is the lead example.
    assert.ok(NI_IKU);
    const f = recipeFormula(NI_IKU).opening[0];
    assert.ok(f);
    assert.equal(f.slot, "any verb");
    assert.equal(f.workedLead, "Any verb you know");
    assert.equal(attachesTo(NI_IKU), "attaches to a verb");
  });

  test("the grader refuses 行きに行く even when handed 行く outright", () => {
    // The backstop. A stale serialized runtime or a hand-made ctx can carry a
    // vehicle the picker would never deal, and the answer built on it must not
    // be marked correct.
    assert.ok(!gradedByAnyDirection("ni-iku", "行きに行く", ctxFor("行く")));
    // While the same grader still takes a legal one.
    assert.ok(gradedByAnyDirection("ni-iku", "食べに行く", ctxFor("食べる")));
  });
});

describe("the passive is led by a verb something is done to", () => {
  test("書かれる leads, and 行かれる is nowhere on the page", () => {
    assert.ok(PASSIVE);
    const f = recipeFormula(PASSIVE).opening[0];
    assert.ok(f);
    assert.equal(f.worked[0]?.from, "書く");
    assert.equal(f.worked[0]?.to, "書かれる");
    assert.deepEqual(f.worked.filter((w) => w.to === "行かれる"), []);
    assert.equal(buildExample(PASSIVE)?.form, "書かれる");
    assert.equal(buildRow(PASSIVE)?.built, "書かれる");
  });

  test("the card says which verbs, in the words the app uses for it", () => {
    // Same strings 〜てある gets, from the same table — never "transitive".
    assert.ok(PASSIVE);
    const f = recipeFormula(PASSIVE).opening[0];
    assert.ok(f);
    assert.equal(f.slot, "any verb that somebody does to something");
    assert.equal(f.workedLead, "Any verb you know that somebody does to something");
    assert.equal(attachesTo(PASSIVE), "attaches to a verb that somebody does to something");
    for (const s of [f.slot, f.workedLead, attachesTo(PASSIVE)]) assert.ok(!s.includes("—"), s);
  });

  test("the grader refuses 行かれる under this gloss", () => {
    assert.ok(!gradedByAnyDirection("passive", "行かれる", ctxFor("行く")));
    assert.ok(gradedByAnyDirection("passive", "書かれる", ctxFor("書く")));
  });

  test("the POTENTIAL is untouched — only the 受身 row was narrowed", () => {
    // 〜られる is two recipes and only one of them needed this. 行ける is a
    // perfectly good potential and the split exists so the two can differ.
    const pot = RECIPES.find((r) => r.id === "potential");
    assert.ok(pot);
    assert.equal(pot.transitivity, undefined);
    assert.equal(recipeFormula(pot).opening[0]?.worked[0]?.to, "行ける");
  });
});

describe("one answer to 'which verb is this pattern shown on'", () => {
  test("the page, the fact and the cluster row never disagree", () => {
    // Three call sites used to answer this off two copies of one hand-kept
    // table. Two copies is two chances for the page to lead with one verb while
    // the fact under it is built on another.
    for (const r of RECIPES) {
      if (r.wrap) continue;
      if (!r.attach.some((a) => a.host === "verb")) continue;
      const lead = recipeFormula(r).opening.find((o) => o.host === "verb")?.worked[0]?.from;
      if (!lead) continue;
      assert.equal(buildExample(r, "verb")?.lemma, lead, `${r.id}: page and fact disagree`);
      assert.equal(buildRow(r, "verb")?.on[0], lead, `${r.id}: page and cluster row disagree`);
    }
  });

  test("every recipe is demonstrated on a verb it actually accepts", () => {
    // The bug in one line. 〜てある was baked on 行ってある and 〜に行く on
    // 行きに行く, both because the fixed vehicle never had to satisfy the recipe.
    for (const r of RECIPES) {
      if (r.wrap) continue;
      const on = buildExample(r, "verb")?.lemma;
      if (!on) continue;
      assert.ok(recipeAllows(r, on), `${r.id} is demonstrated on ${on}, which it refuses`);
    }
  });
});
