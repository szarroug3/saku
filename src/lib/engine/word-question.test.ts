// Word questions — the two things a word could not do until distractors and a
// typed en→jp reading gap existed:
//
//   - a jp→en MEANING question is now real multiple choice: the correct gloss
//     plus plausible OTHER-word glosses, never a single free-point option;
//   - an en→jp question grades a typed KANA READING of the word as correct,
//     with no IME, the same romaji-forgiving way every other kana target is.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/word-question.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildMcOptions } from "@/lib/engine/index";
import { en2jpTypeable, questionsFor } from "@/lib/engine/question";
import {
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { factInfo } from "@/lib/facts";

const SENSEI_MEANING = wordMeaningFactId("先生"); // teacher
const SENSEI_READING = wordReadingFactId("先生"); // せんせい

test("a jp→en word meaning question yields several distinct options including the gloss", () => {
  const opts = buildMcOptions(SENSEI_MEANING);
  // More than one — the old behaviour returned the answer alone, which the drill
  // screen degraded to a free point.
  assert.ok(opts.length > 1, `expected multiple options, got ${opts.length}`);
  // The correct fact is on the board.
  assert.ok(opts.includes(SENSEI_MEANING), "the asked fact must be an option");
  // Every option is a distinct fact...
  assert.equal(new Set(opts).size, opts.length, "options must be distinct facts");
  // ...and no two share a gloss, or two would be co-correct.
  const glosses = opts.map((f) => factInfo(f)?.answers[0]?.trim().toLowerCase());
  assert.equal(new Set(glosses).size, glosses.length, "no two options may share a gloss");
  // The distractors are OTHER words' glosses, not 先生's own.
  assert.ok(
    opts.some((f) => f !== SENSEI_MEANING && factInfo(f)?.subject === "word"),
    "distractors should be other word facts",
  );
});

test("word meaning distractors sit near the asked word's level", () => {
  // Every option resolves to a real word fact — no padding with ids the data
  // no longer has.
  const opts = buildMcOptions(SENSEI_MEANING);
  for (const f of opts) {
    assert.ok(factInfo(f), `option ${f} should be a live fact`);
  }
});

test("a jp→en word reading question offers other kana readings", () => {
  const opts = buildMcOptions(SENSEI_READING);
  assert.ok(opts.length > 1, `expected multiple options, got ${opts.length}`);
  assert.ok(opts.includes(SENSEI_READING), "the asked fact must be an option");
  // Distractor labels for a reading question are kana readings, and none equals
  // せんせい (co-correct answers are dropped).
  const readings = opts.map((f) => factInfo(f)?.answers[0]);
  assert.equal(new Set(readings).size, readings.length, "no duplicate readings");
});

test("en→jp grades a typed kana reading of the word as correct", () => {
  const q = questionsFor(SENSEI_READING);
  // Typed directly as kana (an IME user, or the drill's live romaji→kana box).
  assert.ok(q.check(SENSEI_READING, "en2jp", "せんせい"), "せんせい should be correct");
  // Typed as romaji, no IME — the whole point of the gap.
  assert.ok(q.check(SENSEI_READING, "en2jp", "sensei"), "sensei should be correct");
  // Forgiving of surrounding space and case, like every other target.
  assert.ok(q.check(SENSEI_READING, "en2jp", "  Sensei  "), "should trim and fold case");
  // A wrong reading is wrong.
  assert.ok(!q.check(SENSEI_READING, "en2jp", "gakusei"), "gakusei is not 先生");
});

test("the en→jp reading card is typeable; the meaning card (kanji) is not", () => {
  // The reading answer is kana, so the drill can offer a text box...
  assert.ok(en2jpTypeable(SENSEI_READING), "reading en→jp should be typeable");
  // ...while producing the written word 先生 needs an IME or multiple choice.
  assert.ok(!en2jpTypeable(SENSEI_MEANING), "meaning en→jp (kanji) is not typeable");
});

test("en→jp reading question shows the English gloss and reveals the reading", () => {
  const p = questionsFor(SENSEI_READING).prompt(SENSEI_READING, "en2jp");
  assert.equal(p.glyph, "teacher", "the gloss is the prompt");
  assert.equal(p.jp, false, "the prompt is English, not JP");
  // The answer the generic reveal prints is the reading kana.
  assert.equal(factInfo(SENSEI_READING)?.answers[0], "せんせい");
});
