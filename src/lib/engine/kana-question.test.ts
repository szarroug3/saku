// kana distractors — SAK-49: a beginner who knew five vowels was seeing
// しょ/ちゅ/じゃ as MC options for a plain vowel, because kana distractors
// were drawn from the entire kana set with no notion of what had actually
// been studied. `ctx.known` (threaded in by buildMcOptions, see
// engine/index.ts) fixes that: prefer known material, fall back to
// same-row neighbors, then the full same-script inventory, exactly as
// before, only when there isn't enough seen material to fill the board.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/kana-question.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildMcOptions } from "@/lib/engine/index";
import { questionsFor, type PromptContext } from "@/lib/engine/question";
import { CHAR_INDEX, kanaFact } from "@/data/characters";
import { readingFactId } from "@/data/kanji";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

const A = kanaFact("あ");
const I = kanaFact("い");
const U = kanaFact("う");
const E = kanaFact("え");
const O = kanaFact("お"); // あ's shape lookalike (LOOKALIKES: ["あ", "お"])

test("small known set: distractors for a known vowel come from the known set first", () => {
  // あ, い, う, え, お all known (a beginner who has learned the five vowels).
  // あ's candidate pool is い, う, え (known, same h-vowels row) plus お (known,
  // AND あ's shape lookalike) — four known items total, none of them yōon or
  // dakuten.
  const known = new Set([A, I, U, E, O]);
  const ctx: PromptContext = { known };
  const qt = questionsFor(A);

  const top4 = qt.distractors(A, 4, ctx);
  assert.equal(top4.length, 4);
  assert.deepEqual(
    new Set(top4),
    new Set([O, I, U, E]),
    "every one of the four known non-self vowels should fill the board before anything unseen",
  );
  for (const f of top4) {
    assert.ok(CHAR_INDEX[kanaGlyph(f)], `${f} should resolve to a live kana`);
  }
});

test("small known set: exhausting the known pool falls back rather than erroring", () => {
  // Only four known candidates exist for あ (お, い, う, え); asking for a 5th
  // must fall back to the wider same-script pool instead of coming up short.
  const known = new Set([A, I, U, E, O]);
  const ctx: PromptContext = { known };
  const qt = questionsFor(A);

  const top5 = qt.distractors(A, 5, ctx);
  assert.equal(top5.length, 5, "falls back to fill the 5th slot rather than stopping at 4");
  const firstFour = new Set(top5.slice(0, 4));
  assert.deepEqual(
    firstFour,
    new Set([O, I, U, E]),
    "the four known items still lead",
  );
  assert.ok(
    !known.has(top5[4]),
    "the 5th slot, with no more known material, comes from the fallback pool",
  );
});

test("empty known set: falls back to same-row before same-set, close to pre-fix behavior", () => {
  // No known facts at all (ctx.known absent) — the brand-new-learner path.
  // い has no LOOKALIKES entry, so its whole candidate pool is same-script
  // fill: the h-vowels row (あ, う, え, お) should lead over every other row.
  const qt = questionsFor(I);
  const withoutCtx = qt.distractors(I, 4, undefined);
  assert.equal(withoutCtx.length, 4);
  for (const f of withoutCtx) {
    assert.equal(
      CHAR_INDEX[kanaGlyph(f)]?.sec,
      "h-vowels",
      `${f} should be a same-row (h-vowels) neighbor before any other row is offered`,
    );
  }

  const fifth = qt.distractors(I, 5, undefined)[4];
  assert.notEqual(
    CHAR_INDEX[kanaGlyph(fifth)]?.sec,
    "h-vowels",
    "the row is exhausted at 4 neighbors, so the 5th option falls back to the wider same-set pool",
  );
});

test("large known set: distractors converge on known material for good board coverage", () => {
  // Simulate an intermediate learner who has met nearly all of hiragana.
  const known = new Set(
    Object.values(CHAR_INDEX)
      .filter((info) => info.set === "hiragana" && info.c !== "あ")
      .map((info) => kanaFact(info.c)),
  );
  const ctx: PromptContext = { known };
  const qt = questionsFor(A);
  const top5 = qt.distractors(A, 5, ctx);
  assert.equal(top5.length, 5);
  for (const f of top5) {
    assert.ok(known.has(f), `${f} should be drawn from the near-complete known set`);
  }
});

test("regression: kanji-reading preferKnown boards still work with the shared known set", () => {
  // buildMcOptions now threads the same `known` list onto ctx.known for every
  // subject's distractors() call, not only into the kanji-only preferKnown
  // sort. Kanji reading cards must still surface a known sibling reading.
  const asked = readingFactId("一", "一");
  const known = [readingFactId("一", "統一"), readingFactId("一", "一人")];
  const opts = buildMcOptions(asked, "jp2en", undefined, known);
  const distractors = opts.filter((f) => f !== asked);
  assert.ok(distractors.length > 0, "should still produce distractors");
  assert.ok(
    distractors.some((f) => known.includes(f)),
    "a known reading sibling should still be offered",
  );
});

test("kana MC board built end-to-end prefers known material via buildMcOptions", () => {
  // Five known vowels (あいうえお) give あ exactly four known non-self
  // candidates (い, う, え, お). The default board is six options wide
  // (BEHAVIOR.mcOptions), i.e. five distractors — one more than the known
  // pool can supply, so exactly one option is unavoidably unseen fallback.
  // Before this fix, all five would have been drawn from the full ~90-glyph
  // kana set with no preference at all.
  const known = [A, I, U, E, O];
  const opts = buildMcOptions(A, "jp2en", undefined, known);
  assert.ok(opts.includes(A), "the asked fact is always on the board");
  const knownOptions = opts.filter((f) => f !== A && known.includes(f));
  assert.equal(
    knownOptions.length,
    4,
    "every known non-self vowel (い/う/え/お) should have made the board",
  );
  const unseenOptions = opts.filter((f) => f !== A && !known.includes(f));
  assert.equal(
    unseenOptions.length,
    1,
    "only the one slot the known pool could not fill is unseen fallback",
  );
});

function kanaGlyph(fact: FactId): string {
  const glyph = factInfo(fact)?.glyph;
  if (!glyph) throw new Error(`not a live kana fact: ${fact}`);
  return glyph;
}
