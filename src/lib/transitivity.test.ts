// Run: node --test src/lib/transitivity.test.ts
//
// WHY THIS FILE EXISTS
// ====================
// src/data/transitivity.ts is hand-authored, which makes it the one kind of
// file the generated data's guarantees do not cover. Three failures here are
// silent and all three type-check:
//
//  - A MEMBER ON THE WRONG SIDE. Nothing about the type stops "I opened the
//    door" sitting in `happens`. The item would then teach the error, and the
//    user has no way to push back. The heuristic that proposed these pairs
//    could not orient 8 of them (JMdict's entry order decided the direction, a
//    coin flip), so wrong-side is a live risk and not a hypothetical.
//  - A DUPLICATE MEMBER. Two rows claiming the same verb means one of them is
//    a mis-pairing.
//  - A CUE THAT DOES NOT DISCRIMINATE. If both sides of a pair carry the same
//    English, the item has two right answers.
//
// The transitivity direction itself cannot be asserted from JMdict -- that is
// the whole premise of the table -- but the tags are a real cross-check on the
// side assignment, so this asks them.

import assert from "node:assert/strict";
import test from "node:test";

import { VERB_PAIRS } from "../data/transitivity.ts";
import { allQuestions, question } from "./transitivity.ts";

test("every pair is two distinct verbs", () => {
  for (const p of VERB_PAIRS) {
    assert.notEqual(p.happens.word, p.doIt.word, `${p.happens.word} paired with itself`);
  }
});

test("no verb appears on both sides of the table", () => {
  // 起こす is legitimately the partner of BOTH 起きる and 起こる, so a member
  // may repeat on its own side. What it may never do is be intransitive in one
  // row and transitive in another -- that is a mis-pairing, not a real fan-out.
  const happens = new Set(VERB_PAIRS.map((p) => p.happens.word));
  const doIt = new Set(VERB_PAIRS.map((p) => p.doIt.word));
  for (const w of happens) {
    assert.ok(!doIt.has(w), `${w} is on both sides`);
  }
});

test("JMdict's tags agree with the side each member was placed on", () => {
  // The CROSS-CHECK, and the reason the tags are carried in the data at all.
  // JMdict cannot tell us that 開く pairs with 開ける. It can tell us that 開ける
  // is transitive, which is enough to catch a member written into the wrong
  // field. `ambi`/`split` carry both tags and so cannot discriminate; they are
  // skipped rather than asserted, which is exactly what they mean.
  for (const p of VERB_PAIRS) {
    if (p.happens.jmdict === "vi" || p.happens.jmdict === "vt") {
      assert.equal(p.happens.jmdict, "vi", `${p.happens.word} is in happens but tagged vt`);
    }
    if (p.doIt.jmdict === "vi" || p.doIt.jmdict === "vt") {
      assert.equal(p.doIt.jmdict, "vt", `${p.doIt.word} is in doIt but tagged vi`);
    }
  }
});

test("readings are kana, and match no other member's word", () => {
  const kana = /^[぀-ゟ゠-ヿ]+$/;
  for (const p of VERB_PAIRS) {
    for (const m of [p.happens, p.doIt]) {
      assert.match(m.reading, kana, `${m.word} reading ${m.reading} is not kana`);
    }
  }
});

test("each pair's two cues differ, or the item has two right answers", () => {
  for (const p of VERB_PAIRS) {
    assert.notEqual(p.happens.en, p.doIt.en, `${p.happens.word}/${p.doIt.word} share a cue`);
  }
});

test("every cue is a sentence", () => {
  for (const p of VERB_PAIRS) {
    for (const m of [p.happens, p.doIt]) {
      assert.match(m.en, /^[A-Z].*\.$/, `${m.word}: cue is not a sentence: ${m.en}`);
    }
  }
});

test("an item's answer is one of its own choices", () => {
  for (const q of allQuestions()) {
    assert.ok(
      q.choices.some((c) => c.word === q.answer),
      `${q.answer} is not among its choices`,
    );
  }
});

test("an item offers exactly two choices: the pair, and nothing else", () => {
  for (const q of allQuestions()) {
    assert.equal(q.choices.length, 2);
    assert.notEqual(q.choices[0].word, q.choices[1].word);
  }
});

test("the cue shown is the cue of the answer, not of the distractor", () => {
  // The item is only choosable because the English names the event. Ship the
  // wrong side's cue and every answer is wrong.
  for (const p of VERB_PAIRS) {
    const h = question(p, "happens");
    if (h) assert.equal(h.en, p.happens.en);
    const d = question(p, "doIt");
    if (d) assert.equal(d.en, p.doIt.en);
  }
});

test("refuses the frame whose distractor is ambitransitive", () => {
  // The one safety refusal. If the distractor can play the asked-for role, the
  // item has two right answers.
  for (const p of VERB_PAIRS) {
    if (p.doIt.jmdict === "ambi") {
      assert.equal(question(p, "happens"), null, `${p.happens.word}: unsafe frame shipped`);
    }
    if (p.happens.jmdict === "ambi") {
      assert.equal(question(p, "doIt"), null, `${p.doIt.word}: unsafe frame shipped`);
    }
  }
});

test("the table still produces a useful number of items", () => {
  // A canary, not a spec. If a refusal starts eating the table this fails
  // loudly rather than the app quietly showing fewer questions.
  const qs = allQuestions();
  assert.ok(qs.length > 130, `only ${qs.length} items`);
  assert.equal(qs.length, VERB_PAIRS.length * 2 - 2); // two ambi distractors refused
});

test("no rendered string leaks a grammatical term", () => {
  // "Transitive" and "intransitive" are the same problem as "godan": real
  // words the textbook teaches, that this app does not lead with. Assert it of
  // the strings that actually reach a screen.
  const banned = /transitive|intransitive|godan|ichidan|suppletive/i;
  for (const q of allQuestions()) {
    assert.doesNotMatch(q.en, banned, `cue leaks a term: ${q.en}`);
    for (const c of q.choices) assert.doesNotMatch(c.word + c.reading, banned);
  }
});
