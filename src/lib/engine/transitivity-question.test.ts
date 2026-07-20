// Transitivity questions — the one-way, MC-only shape that is the whole point:
//
//   - the direction is pinned to en2jp (English cue → pick the verb) and the
//     type declares itself MC-only, because there is no coherent jp2en reading
//     and no typed answer;
//   - the board is exactly two facts, the pair's two verbs, so grading is "which
//     verb did you pick" and the distractor is always the partner.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/transitivity-question.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildMcOptions } from "@/lib/engine/index";
import { questionsFor } from "@/lib/engine/question";
import {
  sideFactId,
  transitivitySide,
} from "@/data/transitivity-facts";
import { VERB_PAIRS } from "@/data/transitivity";
import { PROMPT } from "@/lib/transitivity";

/** An askable pair to exercise — the first whose both sides are askable, so the
 * board is a clean two-choice. */
const PAIR = VERB_PAIRS.find(
  (p) =>
    transitivitySide(sideFactId(p, "happens"))!.askable &&
    transitivitySide(sideFactId(p, "doIt"))!.askable,
)!;
const HAPPENS = sideFactId(PAIR, "happens");
const DOIT = sideFactId(PAIR, "doIt");

test("the type is MC-only and pinned to en2jp", () => {
  const qt = questionsFor(HAPPENS);
  assert.equal(qt.mcOnly, true);
  assert.equal(qt.fixedDir, "en2jp");
});

test("the prompt shows the English cue and the fixed instruction, not the verb", () => {
  const qt = questionsFor(HAPPENS);
  const prompt = qt.prompt(HAPPENS, "en2jp");
  assert.equal(prompt.glyph, PAIR.happens.en);
  assert.equal(prompt.jp, false);
  assert.equal(prompt.context, PROMPT);
});

test("check grades the pair's own verb right and the partner verb wrong", () => {
  const qt = questionsFor(HAPPENS);
  assert.ok(qt.check(HAPPENS, "en2jp", PAIR.happens.word));
  assert.ok(qt.check(HAPPENS, "en2jp", PAIR.happens.reading));
  assert.ok(!qt.check(HAPPENS, "en2jp", PAIR.doIt.word));
});

test("the one distractor is the partner side", () => {
  const qt = questionsFor(HAPPENS);
  assert.deepEqual(qt.distractors(HAPPENS, 4), [DOIT]);
  assert.deepEqual(questionsFor(DOIT).distractors(DOIT, 4), [HAPPENS]);
});

test("the built board is exactly the two verbs of the pair", () => {
  const opts = buildMcOptions(HAPPENS);
  assert.equal(opts.length, 2, "a pair is a two-choice board");
  assert.ok(opts.includes(HAPPENS));
  assert.ok(opts.includes(DOIT));
});
