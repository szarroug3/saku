// Run: node --test scripts/ingest/pitch.test.mjs
// The Kanjium matching rules in pitch.mjs, on a small hand-written accents file
// shaped like the real one (SAK-503: a kana headword has an empty reading).
import assert from "node:assert/strict";
import { test } from "node:test";

import { independentLookup, lookupPitch, parseAccents } from "./pitch.mjs";

const RAW = [
  "はい\t\t1",
  "うん\t\t1",
  "ええ\t\t1,2,0",
  "橋\tはし\t2",
  "箸\tはし\t1",
  "仏\tほとけ\t0,3",
  "あの\t\t0",
  "あの\tあの\t1",
  "",
].join("\n");

const parsed = parseAccents(RAW);

test("a kana headword with an empty Kanjium reading is matched", () => {
  assert.deepEqual(lookupPitch(parsed, "はい", "はい"), { downstep: 1 });
  assert.deepEqual(lookupPitch(parsed, "うん", "うん"), { downstep: 1 });
});

test("an ambiguous kana headword gets no pitch", () => {
  assert.deepEqual(lookupPitch(parsed, "ええ", "ええ"), { ambiguous: true });
});

test("a kana word whose two Kanjium keys disagree gets no pitch", () => {
  assert.deepEqual(lookupPitch(parsed, "あの", "あの"), { ambiguous: true });
});

test("the empty-reading key is only tried when the word is written in kana", () => {
  const kanjiOnly = parseAccents("箸\t\t0\n");
  assert.deepEqual(lookupPitch(kanjiOnly, "箸", "はし"), {});
});

test("kanji words still match on the written form and the reading together", () => {
  assert.deepEqual(lookupPitch(parsed, "橋", "はし"), { downstep: 2 });
  assert.deepEqual(lookupPitch(parsed, "箸", "はし"), { downstep: 1 });
  assert.deepEqual(lookupPitch(parsed, "仏", "ほとけ"), { ambiguous: true });
  assert.deepEqual(lookupPitch(parsed, "端", "はし"), {});
});

test("the regression check's separate lookup agrees on kana headwords", () => {
  assert.equal(independentLookup(RAW, "はい", "はい"), 1);
  assert.equal(independentLookup(RAW, "うん", "うん"), 1);
  assert.equal(independentLookup(RAW, "ええ", "ええ"), undefined);
  assert.equal(independentLookup(RAW, "あの", "あの"), undefined);
});
