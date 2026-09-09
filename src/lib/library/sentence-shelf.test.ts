// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/sentence-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Sentences shelf is cut into the ten sentence types, each holding the
// grammar the curriculum places before it (sentence-shelf.ts). Four things have
// to hold, and the renderer (a .tsx the runner cannot load) trusts this
// function for all four:
//
//   1. One section per sentence type, in the track's order, each headed by its
//      own type: the section is called "Simple sentences" and its first entry
//      IS Simple sentences.
//   2. The grammar under a type is the grammar placed before it, so は and が
//      are under Simple and 〜てから under the te-form type. This is the whole
//      complaint the shelf answers: a reader looking for a particle under
//      Sentences used to find nothing at all.
//   3. Nothing is listed twice, anywhere on the shelf.
//   4. The leftovers stay off. A pattern no type needs has no type to sit
//      under, and is on the Grammar shelf instead.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { sentenceRuleOrder } from "@/lib/sentence-rule-order";
import { sentenceShelfSections } from "@/lib/library/sentence-shelf";

const sections = sentenceShelfSections();
/** What a section holds, read back the way a tile shows it: a pattern by its
 * glyph, a sentence type by its name (a type has no glyph of its own). */
const held = (id: string) => sections.find((s) => s.id === id)!.entries.map((e) => e.glyph || e.name);

describe("the sentences shelf is cut into the sentence types", () => {
  test("one section per type, in the track's order, each headed by its type", () => {
    assert.deepEqual(
      sections.map((s) => s.id),
      SENTENCE_ORDERING_TIERS.map((t) => `sentence-rule-${t.id}`),
    );
    for (const section of sections) {
      assert.equal(section.entries[0].id, `writing-rule:${section.id}`, `${section.id} leads with its own type`);
      assert.equal(section.entries[0].name, section.label, `${section.id} is named after its type`);
      assert.ok(section.entries.length > 1, `${section.id} carries the grammar it is built from`);
    }
  });

  test("the grammar under a type is the grammar taught before it", () => {
    assert.deepEqual(held("sentence-rule-simple"), ["Simple sentences", "〜な", "〜は", "〜が", "〜を", "〜に", "〜で", "〜だけ"]);
    assert.ok(held("sentence-rule-sequential").includes("〜てから"), "〜てから is under the te-form type");
    assert.ok(held("sentence-rule-sequential").includes("〜て"), "and the form it is built on is with it");
  });

  test("nothing is listed twice on the shelf", () => {
    const ids = sections.flatMap((s) => s.entries.map((e) => e.id));
    assert.equal(new Set(ids).size, ids.length);
  });

  test("the patterns no type needs stay off it", () => {
    const order = sentenceRuleOrder();
    const lastType = order.map((s) => s.kind).lastIndexOf("tier");
    const leftovers = order.slice(lastType + 1).map((s) => s.id);
    const shelved = new Set<string>(sections.flatMap((s) => s.entries.map((e) => e.id)));
    assert.ok(leftovers.length > 0, "there are leftovers to keep off");
    for (const id of leftovers) assert.ok(!shelved.has(`grammar:${id}`), `${id} is not on the sentences shelf`);
  });
});
