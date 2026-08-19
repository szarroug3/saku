// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/question-mark-key.test.ts
//
// SAK-56 — the drill's global "?" hint shortcut works even with the answer box
// focused (see DrillScreen.onKeyDown), on the premise that no accepted answer
// in the corpus ever contains a literal "?", so intercepting the key can never
// eat a character a learner needed. That premise turned out to be false: ね's
// own meaning gloss set is "right?" / "isn't it?" / "doesn't it?" / "don't
// you?" (vocab.json), and it is a TYPED jp→en meaning card — not multiple
// choice — so a learner spelling that gloss verbatim really does need to type
// "?". `answerContainsQuestionMark` is the check DrillScreen now runs before
// taking the hint, so it stands the binding off exactly on cards like that
// one. These tests pin both halves: the flagged fact really does carry "?",
// and an ordinary gloss/reading doesn't.
//
// A grammar-pattern meaning gloss can carry a "?" too ("shall I X?", "won't
// you X? (invitation)" — recipes.ts's mashou-ka/masen-ka), which is worth
// pinning as a second real example of the corpus-level fact — but note it can
// never actually reach this scoping in the app: `grammarMeaning` forces
// `mcOnlyIn` true in BOTH directions (engine/question.ts), so a grammar
// meaning fact is always a selection board, never a focused text box. ね is
// the case that is actually reachable.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { answerContainsQuestionMark } from "./index.ts";
import { patternMeaningFactId } from "@/data/grammar";
import { wordMeaningFactId } from "@/data/vocab";
import { readingFactId } from "@/data/kanji";
import { ALL_FACTS, factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

describe("answerContainsQuestionMark", () => {
  test("ね's meaning gloss is a question, is flagged, and is a TYPED card", () => {
    const fact = wordMeaningFactId("ね");
    const answers = factInfo(fact)?.answers ?? [];
    assert.ok(
      answers.includes("right?"),
      `expected ね's glosses to include "right?", got ${JSON.stringify(answers)}`,
    );
    assert.equal(answerContainsQuestionMark(fact), true);
  });

  test("mashou-ka's meaning gloss is a question, and is flagged (though always MC — see file header)", () => {
    const fact = patternMeaningFactId("mashou-ka");
    assert.equal(factInfo(fact)?.answers[0], "shall I X?");
    assert.equal(answerContainsQuestionMark(fact), true);
  });

  test("masen-ka's meaning gloss is a question, and is flagged (though always MC — see file header)", () => {
    const fact = patternMeaningFactId("masen-ka");
    assert.equal(factInfo(fact)?.answers[0], "won't you X? (invitation)");
    assert.equal(answerContainsQuestionMark(fact), true);
  });

  test("an ordinary gloss with no '?' is not flagged", () => {
    // 電話's meaning is "telephone" — no question mark, so the "?" key must
    // stay bound to Hint for this card (e2e: "the '?' key takes the hint just
    // like the button", e2e/quiz-hints.spec.ts).
    assert.equal(answerContainsQuestionMark(wordMeaningFactId("電話")), false);
  });

  test("a kanji reading (all kana, never a gloss) is not flagged", () => {
    assert.equal(answerContainsQuestionMark(readingFactId("病", "病院")), false);
  });

  test("an unknown fact id is not flagged (defensive default)", () => {
    const bogus = "kanji:not-a-real-fact/meaning" as unknown as FactId;
    assert.equal(answerContainsQuestionMark(bogus), false);
  });

  // Pins the SHAPE of the invariant, not just a couple of hand-picked facts: at
  // least one real fact in the whole corpus carries a literal "?" (today, ね's
  // and a couple of grammar glosses), so this file's premise stays testable
  // even if the underlying data is edited. A future content change that
  // removed every "?"-bearing answer would flip this to fail LOUD, which is
  // exactly the signal that the DrillScreen scoping code has gone
  // untested/dead — see SAK-56.
  test("the corpus still contains at least one '?'-bearing answer", () => {
    const hit = ALL_FACTS.some((f) => answerContainsQuestionMark(f));
    assert.equal(hit, true);
  });
});
