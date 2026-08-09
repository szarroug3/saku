// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/cost.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { itemCost } from "./cost.ts";
import { buildGlyphItem } from "./build-item.ts";
import { formItem, unitItem } from "./numbers-track.ts";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";
import { meaningFactId } from "@/data/kanji";

const tsu3 = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:3")!;
const sai20 = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
const tens = GENERATIVE_UNITS.find((u) => u.id === "tens")!;

test("itemCost — one per fact, summed across a character's roles", () => {
  const item = buildGlyphItem("三")!;
  assert.equal(itemCost(item), item.facts.length);
  // Cohesive: the number 三 costs MORE than its kanji facts alone, because its
  // word (さん) facts are folded in.
  assert.ok(item.facts.some((fact) => fact.id === meaningFactId("三")));
  assert.ok(itemCost(item) > 1, "aggregates the word facts beyond the kanji meaning");
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
