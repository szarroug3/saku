// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/sentence-rule-order.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// sentenceRuleOrder() is the whole "Sentence rules" track in one list, and two
// surfaces read it (the Observatory's section and the Atlas's Sentences shelf),
// so the properties that make it a curriculum rather than a heap have to hold
// here, where neither of those surfaces can quietly drop or duplicate a row:
//
//   1. It tiles the subject: every recipe once, every sentence type once, and
//      nothing else in the list.
//   2. A sentence type is preceded by everything it needs. For Simple that is
//      は and が (its prereqs) plus the particles its own sentences turn on,
//      and NOT the ones they never use, which is the whole point of the card.
//   3. A form is taught before the patterns built on it: the て/で-form before
//      〜てから, the ない-form before 〜ないでください, the stem before 〜たい.
//   4. The sentence types keep SENTENCE_ORDERING_TIERS order, so the chain ends
//      on the reported tier, and everything after that last type is the
//      leftover grammar in the track's own order.
//
// The first test prints the computed order once, so a card comment or a README
// section can quote what the app will actually teach rather than a retyping.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { RECIPES } from "@/data/grammar/recipes";
import { grammarRank } from "@/lib/library/grammar-order";
import { sentenceRuleOrder } from "@/lib/sentence-rule-order";

const order = sentenceRuleOrder();
const patterns = order.filter((s) => s.kind === "pattern").map((s) => s.id);
const tiers = order.filter((s) => s.kind === "tier").map((s) => s.id);
const at = (id: string) => order.findIndex((s) => s.id === id);

describe("the sentence rule order", () => {
  test("is every recipe once and every sentence type once, and prints", () => {
    console.log(
      "sentenceRuleOrder():\n" +
        order.map((s) => (s.kind === "tier" ? `[${s.id}]` : s.id)).join(" "),
    );
    assert.equal(order.length, RECIPES.length + SENTENCE_ORDERING_TIERS.length);
    assert.deepEqual(
      [...patterns].sort(),
      RECIPES.map((r) => r.id).sort(),
      "every recipe appears exactly once",
    );
    assert.deepEqual(tiers, SENTENCE_ORDERING_TIERS.map((t) => t.id));
    assert.equal(new Set(order.map((s) => `${s.kind}:${s.id}`)).size, order.length);
  });

  test("the adjective and noun form leads, since its word classes come first", () => {
    assert.deepEqual(order[0], { kind: "pattern", id: "prenominal-form" });
  });

  test("Simple gets its prereqs and the particles its own sentences use, and no others", () => {
    const simple = at("simple");
    // its prereqs, in teaching order: the learner has to read the examples
    for (const id of ["wa", "ga"]) assert.ok(at(id) >= 0 && at(id) < simple, `${id} before Simple`);
    assert.ok(at("wa") < at("ga"), "は before が");
    // the particles its curated sentences turn on
    for (const id of ["wo", "ni", "de", "dake"]) assert.ok(at(id) < simple, `${id} before Simple`);
    // を is the one every second Simple sentence uses, so it leads the used set
    assert.ok(at("wo") < at("ni"), "を, the most used, before the rest");
    // and the ones no Simple sentence uses wait: this is the nine-at-once fix
    for (const id of ["e", "made", "made-ni", "ka", "kara-source"]) {
      assert.ok(at(id) > simple, `${id} is not taught before Simple`);
    }
  });

  test("a form is taught before the patterns built on it", () => {
    assert.ok(at("te-sequence") < at("te-kara"), "the て/で-form before 〜てから");
    assert.ok(at("te-sequence") < at("te-iru"), "the て/で-form before 〜ている");
    assert.ok(at("nai-form") < at("nai-request"), "the ない-form before 〜ないでください");
    assert.ok(at("stem-form") < at("tai"), "the stem before 〜たい");
    assert.ok(at("masu-form") < at("mashou"), "the ます-form before 〜ましょう");
  });

  test("every sentence type is preceded by all of its prereqs", () => {
    for (const tier of SENTENCE_ORDERING_TIERS) {
      for (const id of tier.grammarPrereqs) {
        assert.ok(at(id) >= 0 && at(id) < at(tier.id), `${id} before ${tier.id}`);
      }
    }
  });

  test("the chain ends on the reported tier, and the tail runs in track order", () => {
    assert.equal(tiers[tiers.length - 1], "reported");
    const tail = order.slice(at("reported") + 1);
    assert.ok(tail.every((s) => s.kind === "pattern"), "nothing follows the last sentence type but grammar");
    const ranks = tail.map((s) => grammarRank(s.id));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "the leftovers keep the track's order");
    // the leftovers are real: the particles no sentence type's examples use
    for (const id of ["e", "made", "ka"]) assert.ok(tail.some((s) => s.id === id), `${id} is still taught`);
  });

  test("is the same list every time", () => {
    assert.equal(sentenceRuleOrder(), order);
  });
});
