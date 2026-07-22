// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/prompt-not-answer.test.ts
//
// THE INVARIANT: what a card SHOWS you is never what it ACCEPTS from you.
//
// A question whose prompt grades as its own answer is not a hard question or an
// easy one — it is not a question. The learner reads the prompt, types or picks
// it back, and the card records a correct answer having tested nothing. This
// held for all 214 kana in en2jp (the prompt is the romaji, and the grader
// forgave a romaji spelling of an all-kana target), which is the entire first
// phase of the app.
//
// So the invariant is asserted over EVERY fact in BOTH directions, not over the
// kana that happened to break it. It is a property of the question model, and
// the only way it stays true of the next subject is if the next subject has to
// pass it too.
//
// Two residual classes do not hold it yet. They are pinned below rather than
// filtered away silently: they are real, they are a different shape from the
// kana one, and fixing them is not this change. A pin is a debt with a name on
// it; a filter is a debt nobody finds again.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GRAMMAR_SUBJECT } from "../../data/grammar/index.ts";
import { KANA_SUBJECT } from "../../data/characters.ts";
import { KANJI_SUBJECT } from "../../data/kanji.ts";
import { VOCAB_SUBJECT } from "../../data/vocab.ts";
import { ALL_FACTS, factInfo } from "../facts.ts";
import { questionsFor } from "./question.ts";
import type { Direction, FactId } from "@/types";

const DIRS: Direction[] = ["jp2en", "en2jp"];

interface Violation {
  fact: FactId;
  dir: Direction;
  subject: string;
  shown: string;
}

/**
 * Every (fact, direction) whose own prompt text grades as a correct answer.
 *
 * Asked through the public seam the drill uses — `prompt` then `check` on the
 * same QuestionType — so it cannot pass by testing a helper the drill does not
 * call. Facts that show no text (nothing to retype) are skipped; there is no
 * claim to make about them.
 *
 * Computed once: it walks ~21.7k facts twice and every test below is a question
 * about the same list.
 */
const VIOLATIONS: Violation[] = (() => {
  const out: Violation[] = [];
  for (const fact of ALL_FACTS) {
    const qt = questionsFor(fact);
    for (const dir of DIRS) {
      const shown = qt.prompt(fact, dir).glyph;
      if (!shown.trim()) continue;
      if (qt.check(fact, dir, shown)) {
        out.push({
          fact,
          dir,
          subject: factInfo(fact)?.subject ?? "?",
          shown,
        });
      }
    }
  }
  return out;
})();

function inSubject(subject: string): Violation[] {
  return VIOLATIONS.filter((v) => v.subject === subject);
}

describe("a card never accepts its own prompt", () => {
  test("kana holds it in both directions — this is the P0", () => {
    // The regression this file exists for. Zero, not "fewer": every one of the
    // 214 kana used to fail this in en2jp.
    assert.deepEqual(
      inSubject(KANA_SUBJECT).map((v) => `${v.fact} ${v.dir} shows ${v.shown}`),
      [],
    );
  });

  test("kanji holds it in both directions", () => {
    assert.deepEqual(inSubject(KANJI_SUBJECT), []);
  });

  test("nothing at all violates it in jp2en", () => {
    // jp2en shows Japanese and wants English or a reading, so the prompt and the
    // answer are in different scripts and the invariant is structural there.
    // Worth pinning anyway: it is the direction this change deliberately did not
    // touch, and "did not touch" is a claim a test should carry.
    assert.deepEqual(
      VIOLATIONS.filter((v) => v.dir === "jp2en"),
      [],
    );
  });
});

describe("the two shapes that do NOT hold it yet", () => {
  // Neither is the kana bug and neither is fixed here. Both are pinned by exact
  // count so they cannot quietly grow, and named so the next reader knows what
  // they are looking at.

  test("every remaining violation is a word or a grammar pattern, asked en2jp", () => {
    const unexplained = VIOLATIONS.filter(
      (v) =>
        v.dir !== "en2jp" ||
        (v.subject !== VOCAB_SUBJECT && v.subject !== GRAMMAR_SUBJECT),
    );
    assert.deepEqual(
      unexplained.map((v) => `${v.subject} ${v.fact} ${v.dir}`),
      [],
      "a NEW shape of self-answering card appeared — investigate, do not re-pin",
    );
  });

  test("loanwords whose English gloss is their own romanization", () => {
    // 寿司 asked en2jp prompts "sushi" and the answer is すし, which "sushi"
    // romaji-matches. The gloss IS the romanization, so the romaji forgiveness
    // that makes これ answerable "kore" with no IME hands these away.
    //
    // Unlike kana this is a DATA coincidence, not a structural one: it is the
    // borrowed vocabulary, not the subject. It needs a decision about borrowed
    // glosses, not a grader change, so it is pinned and left.
    assert.equal(inSubject(VOCAB_SUBJECT).length, 68);
  });

  test("grammar meaning cards accept the English gloss they prompt with", () => {
    // en2jp on a grammar meaning fact prompts the gloss ("after doing X") and
    // asks for the pattern, but grammarQuestions.check falls through to
    // `accepts`, which matches the fact's baked answers — the gloss. Structural,
    // like the kana one, and the same fix shape would serve it.
    assert.equal(inSubject(GRAMMAR_SUBJECT).length, 96);
  });
});
