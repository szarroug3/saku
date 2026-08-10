// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/cost.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { itemCost } from "./cost.ts";
import { buildGlyphItem } from "./build-item.ts";
import { formItem, unitItem } from "./numbers-track.ts";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";

const tsu3 = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:3")!;
const sai20 = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
const tens = GENERATIVE_UNITS.find((u) => u.id === "tens")!;

// Cost counts distinct MEANINGS only (readings are shared, not counted), deduped
// by canonicalMeaningId. Stub registry = exact-gloss tier; the synonym tier
// ("man"≈"person") lowers 人 once the meaning-registry lands.
test("itemCost — 三: kanji-three and word-three are ONE meaning = 1", () => {
  assert.equal(itemCost(buildGlyphItem("三")!), 1);
});

test("itemCost — 耳: radical/kanji/word all 'ear' collapse to 1 meaning", () => {
  assert.equal(itemCost(buildGlyphItem("耳")!), 1);
});

test("itemCost — 人: distinct senses, man≈person merged by the registry", () => {
  // With the meaning-registry live, radical "man" folds into "person", leaving
  // {person, -ian, counter} = 3 distinct meanings. Readings are not counted.
  assert.equal(itemCost(buildGlyphItem("人")!), 3);
});

test("itemCost — a kana 〜つ form costs 1, not 0 (the glyphDifficulty gap it fixes)", () => {
  assert.equal(itemCost(formItem(tsu3)!), 1, "みっつ has one fact → cost 1");
});

test("itemCost — 二十歳 costs 1 (one meaning; its reading isn't a separate count)", () => {
  assert.equal(itemCost(formItem(sai20)!), 1);
});

test("itemCost — a generative rule unit costs at least 1", () => {
  assert.ok(itemCost(unitItem(tens)!) >= 1, "the rule's category fact is priced");
});

test("itemCost — every base form and unit costs at least 1 (budget always advances)", () => {
  for (const f of COUNTER_CURRICULUM) assert.ok(itemCost(formItem(f)!) >= 1, f.key);
  for (const u of GENERATIVE_UNITS) assert.ok(itemCost(unitItem(u)!) >= 1, u.id);
});
