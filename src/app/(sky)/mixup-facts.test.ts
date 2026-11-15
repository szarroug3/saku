import assert from "node:assert/strict";
import { test } from "node:test";

import { SHAPE_TIPS } from "@/data/shape-tips";
import { LOOKALIKES } from "@/data/characters";
import { ungrounded } from "@/sky/lib/mixup-coach";
import type { EntryId } from "@/types/facts";

import { coachRequest } from "./mixup-facts";

const req = (a: string, b: string) => coachRequest(a as EntryId, b as EntryId);

test("a kana pair gets each side's sound and story, and the shape tip", () => {
  const r = req("kana:シ", "kana:ツ");
  assert.ok(r);
  assert.equal(r.asked.kind, "katakana");
  assert.ok(r.asked.facts.includes("sounds like: shi"));
  assert.ok(r.asked.facts.some((f) => f.startsWith("the story for its shape and sound: ")));
  assert.match(r.tip ?? "", /シ's two short strokes sit on the left/);
});

test("a kanji pair gets meanings, readings, and its parts with theirs", () => {
  const r = req("kanji:待", "kanji:持");
  assert.ok(r);
  assert.ok(r.asked.facts.includes("made of: 彳 (step) and 寺 (Buddhist temple)"));
  assert.ok(r.other.facts.includes("made of: 扌 (a form of 手, hand) and 寺 (Buddhist temple)"));
  assert.ok(r.other.facts.some((f) => f.startsWith("means: hold")));
});

test("nothing about the learner goes in", () => {
  assert.doesNotMatch(JSON.stringify(req("kanji:日", "kanji:目")), /miss|time|history|you/i);
});

test("an id with no data has no request", () => {
  assert.equal(req("kanji:日", "kanji:nope"), null);
});

test("every look-alike kana group has a shape tip, and every tip's Japanese is its own group's", () => {
  for (const group of LOOKALIKES) assert.ok(SHAPE_TIPS.some((t) => group.every((c) => t.group.includes(c))), group.join(""));
  for (const { group, tip } of SHAPE_TIPS) {
    const r = req(`${/[一-鿿]/.test(group[0]!) ? "kanji" : "kana"}:${group[0]}`, `${/[一-鿿]/.test(group[1]!) ? "kanji" : "kana"}:${group[1]}`);
    assert.ok(r, group.join(""));
    // a tip only names the characters of its own group (ス and ヌ "start like フ")
    assert.deepEqual(ungrounded(tip, { asked: { glyph: group.join(""), kind: "", facts: ["フ"] }, other: { glyph: "", kind: "", facts: [] } }), [], tip);
  }
});

test("tips use no dashes", () => {
  for (const { tip } of SHAPE_TIPS) assert.doesNotMatch(tip, /[—–]/, tip);
});
