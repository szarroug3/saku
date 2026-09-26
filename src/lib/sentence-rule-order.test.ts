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
//   2. A sentence type comes right after what it requires and before what its
//      examples merely use. For Simple that is は, が, を, Simple, then に, で
//      and だけ, and never the particles its sentences never turn on, which is
//      the whole point of SAK-430 and SAK-468. を moved in front of Simple on
//      2026-09-26 (SAK-487).
//   3. A form is taught before the patterns built on it: the て/で-form before
//      〜てから, the ない-form before 〜ないでください, the stem before 〜たい.
//   4. The sentence types keep SENTENCE_ORDERING_TIERS order, so the chain ends
//      on the reported tier, and everything after that last type is the
//      leftover grammar in the track's own order, 〜な at the head of it.
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

  test("the list leads with は, and 〜な waits for the grammar track", () => {
    // SAK-468. The adjective and noun form used to lead, and it is grammar
    // rather than a sentence rule: the Sentences row waits on it instead
    // (observatory.ts), and here it is one of the leftovers.
    assert.deepEqual(order[0], { kind: "pattern", id: "wa", tier: "simple" });
    assert.ok(at("prenominal-form") > at("reported"), "〜な is left to the tail");
  });

  // SAK-487. Sam, 2026-09-26, on the Simple intro naming を when を was not
  // required yet: "let's make wo required instead."
  test("Simple requires exactly は, が and を", () => {
    const simple = SENTENCE_ORDERING_TIERS.find((t) => t.id === "simple")!;
    assert.deepEqual([...simple.grammarPrereqs].sort(), ["ga", "wa", "wo"]);
    assert.ok(
      order.slice(0, at("simple")).every((s) => s.kind === "pattern" && ["wa", "ga", "wo"].includes(s.id)),
      "nothing but those three comes before Simple",
    );
  });

  test("Simple reads は, が, を, Simple, then the particles its own sentences use", () => {
    const simple = at("simple");
    // what a Simple sentence IS: a topic or a subject, what the action is
    // done to, and a predicate
    for (const id of ["wa", "ga", "wo"]) assert.ok(at(id) >= 0 && at(id) < simple, `${id} before Simple`);
    assert.ok(at("wa") < at("ga"), "は before が");
    assert.ok(at("ga") < at("wo"), "が before を");
    // and then what its curated sentences turn on, most used first
    assert.deepEqual(
      order.slice(0, simple + 4).map((s) => s.id),
      ["wa", "ga", "wo", "simple", "ni", "de", "dake"],
    );
    // and every one of those says it is Simple's, however it is placed, so a
    // reader cutting the list by type does not have to guess from the order
    assert.ok(
      order.slice(0, simple + 4).every((s) => s.kind === "tier" || s.tier === "simple"),
      "the whole run belongs to Simple",
    );
    // the ones no Simple sentence uses wait: this is the nine-at-once fix
    for (const id of ["e", "made", "made-ni", "ka", "kara-source"]) {
      assert.ok(at(id) > at("dake"), `${id} is not taught with Simple`);
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
    assert.ok(tail.every((s) => s.kind === "pattern" && s.tier === undefined), "a leftover belongs to no type");
    const ranks = tail.map((s) => grammarRank(s.id));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "the leftovers keep the track's order");
    // the leftovers are real: the particles no sentence type's examples use
    for (const id of ["e", "made", "ka"]) assert.ok(tail.some((s) => s.id === id), `${id} is still taught`);
  });

  test("is the same list every time", () => {
    assert.equal(sentenceRuleOrder(), order);
  });
});
