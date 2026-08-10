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

// Cost dedupes by unique meaning + unique reading, NOT raw facts. These pin the
// exact-match tier (stub registry); the synonym tier ("man"≈"person") lowers 人
// further once the meaning-registry lands — asserted as a bound, not equality.
test("itemCost — 三: kanji-three and word-three are ONE meaning (1) + さん (1) = 2", () => {
  // Three definition/reading facts collapse: {three} + {さん}. Not facts.length (3).
  assert.equal(itemCost(buildGlyphItem("三")!), 2);
});

test("itemCost — 耳: radical/kanji/word all 'ear' collapse to 1 meaning + みみ = 2", () => {
  assert.equal(itemCost(buildGlyphItem("耳")!), 2);
});

test("itemCost — 人: distinct senses stay, exact dups merge", () => {
  // man, person, person, -ian, counter → {man, person, -ian, counter} = 4 meanings;
  // ひと/じん/にん = 3 readings → 7 with the stub. The registry merges man≈person → 6.
  const cost = itemCost(buildGlyphItem("人")!);
  assert.equal(cost, 7, "exact-match tier: person(kanji)+person(word) already merged");
});

test("itemCost — a kana 〜つ form costs 1, not 0 (the glyphDifficulty gap it fixes)", () => {
  assert.equal(itemCost(formItem(tsu3)!), 1, "みっつ has one fact → cost 1");
});

test("itemCost — 二十歳 (reading + meaning) costs 2", () => {
  assert.equal(itemCost(formItem(sai20)!), 2);
});

test("itemCost — a generative rule unit costs at least 1", () => {
  assert.ok(itemCost(unitItem(tens)!) >= 1, "the rule's category fact is priced");
});

test("itemCost — every base form and unit costs at least 1 (budget always advances)", () => {
  for (const f of COUNTER_CURRICULUM) assert.ok(itemCost(formItem(f)!) >= 1, f.key);
  for (const u of GENERATIVE_UNITS) assert.ok(itemCost(unitItem(u)!) >= 1, u.id);
});
