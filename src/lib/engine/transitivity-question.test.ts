// Transitivity questions — the pair's two roles in both directions:
//
//   - English cue → type the stored kana reading or pick the written verb;
//   - Japanese text/audio → pick the matching English role cue;
//   - the board is exactly two facts, the pair's two verbs, so grading is "which
//     verb did you pick" and the distractor is always the partner.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/transitivity-question.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildMcOptions } from "@/lib/engine/index";
import { questionsFor } from "@/lib/engine/question";
import { quizInstruction } from "@/lib/quiz-instruction";
import {
  sideFactId,
  transitivitySide,
} from "@/data/transitivity-facts";
import { VERB_PAIRS } from "@/data/transitivity";

/** An askable pair to exercise — the first whose both sides are askable, so the
 * board is a clean two-choice. */
const PAIR = VERB_PAIRS.find(
  (p) =>
    transitivitySide(sideFactId(p, "happens"))!.askable &&
    transitivitySide(sideFactId(p, "doIt"))!.askable,
)!;
const HAPPENS = sideFactId(PAIR, "happens");
const DOIT = sideFactId(PAIR, "doIt");

test("recognition is MC-only while both directions are available", () => {
  const qt = questionsFor(HAPPENS);
  assert.equal(qt.mcOnly, "jp2en");
  assert.equal(qt.fixedDir, undefined);
  assert.equal(qt.maxOptions, 2);
});

test("the prompt shows the English cue and no sub-label, not the verb", () => {
  const qt = questionsFor(HAPPENS);
  const prompt = qt.prompt(HAPPENS, "en2jp");
  assert.equal(prompt.glyph, PAIR.happens.en);
  assert.equal(prompt.jp, false);
  // The role/register now lives in the folded instruction line, not a grey
  // sub-label beneath the prompt.
  assert.equal(prompt.context, null);
});

test("the recognition prompt shows the Japanese member and no sub-label", () => {
  const prompt = questionsFor(HAPPENS).prompt(HAPPENS, "jp2en");
  assert.equal(prompt.glyph, PAIR.happens.word);
  assert.equal(prompt.jp, true);
  assert.equal(prompt.context, null);
});

test("the folded instruction asks one clean question in each direction", () => {
  assert.equal(
    quizInstruction(HAPPENS, "jp2en", "mc"),
    "Which of these is what this verb means?",
  );
  assert.equal(
    quizInstruction(HAPPENS, "en2jp", "typed"),
    "Type the verb that fits.",
  );
});

test("check grades the pair's own verb right and the partner verb wrong", () => {
  const qt = questionsFor(HAPPENS);
  assert.ok(qt.check(HAPPENS, "en2jp", PAIR.happens.word));
  assert.ok(qt.check(HAPPENS, "en2jp", PAIR.happens.reading));
  assert.ok(!qt.check(HAPPENS, "en2jp", PAIR.doIt.word));
});

test("recognition grades the member's curated English cue", () => {
  const qt = questionsFor(HAPPENS);
  assert.ok(qt.check(HAPPENS, "jp2en", PAIR.happens.en));
  assert.ok(!qt.check(HAPPENS, "jp2en", PAIR.doIt.en));
});

test("the one distractor is the partner side", () => {
  const qt = questionsFor(HAPPENS);
  assert.deepEqual(qt.distractors(HAPPENS, 4), [DOIT]);
  assert.deepEqual(questionsFor(DOIT).distractors(DOIT, 4), [HAPPENS]);
});

test("both built boards are exactly the pair's two members", () => {
  const opts = buildMcOptions(HAPPENS, "en2jp");
  assert.equal(opts.length, 2, "a pair is a two-choice board");
  assert.ok(opts.includes(HAPPENS));
  assert.ok(opts.includes(DOIT));
  const recognition = buildMcOptions(HAPPENS, "jp2en");
  assert.equal(recognition.length, 2);
  assert.ok(recognition.includes(HAPPENS));
  assert.ok(recognition.includes(DOIT));
});
