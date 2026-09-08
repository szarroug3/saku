import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allAnswered, answeredCount, finishPass, nextOpen, openPass, passAnswers, stepTo, withAnswer, type QuizPass } from "./quiz-pass";
import type { QuizAnswer, QuizCard } from "./quiz";

const answer = (cardId: string, over: Partial<QuizAnswer> = {}): QuizAnswer => ({ cardId, grade: "clean", tries: 1, narrowed: false, hinted: false, ...over });

const card = (id: string): QuizCard => ({
  id,
  item: { id, kind: "word", glyph: id, english: id, standing: "shaky" },
  prompt: { glyph: id, jp: false },
  answerIs: "meaning",
  typed: true,
  options: [],
  answerId: id,
  answer: id,
  seen: 0,
  missed: 0,
});

const deck = ["a", "b", "c", "d"].map(card);

/** A pass with the named cards answered, sitting on `at`. */
const pass = (at: number, ...done: string[]): QuizPass => ({
  at,
  answers: Object.fromEntries(done.map((id) => [id, answer(id)])),
  finished: false,
});

describe("a pass as it opens", () => {
  it("starts at the front with nothing answered", () => {
    const p = openPass();
    assert.equal(p.at, 0);
    assert.equal(answeredCount(p), 0);
    assert.equal(p.finished, false);
  });

  it("opens where a saved run was left, with what was answered there", () => {
    const p = openPass({ at: 2, answers: [answer("a"), answer("b", { grade: "missed" })] });
    assert.equal(p.at, 2);
    assert.equal(answeredCount(p), 2);
    assert.equal(p.answers.b.grade, "missed");
  });

  it("reads a run with a position but no answers, and one with answers but no position", () => {
    assert.equal(openPass({ at: 3 }).at, 3);
    assert.equal(openPass({ answers: [answer("a")] }).at, 0);
  });
});

describe("an answer, and the card after it", () => {
  it("records the answer and stays put, so a miss keeps its own reveal", () => {
    const p = withAnswer(pass(1), answer("b", { grade: "missed", tries: 3 }));
    assert.equal(p.at, 1);
    assert.equal(p.answers.b.grade, "missed");
  });

  it("replaces an answer rather than adding a second one for the same card", () => {
    const p = withAnswer(withAnswer(pass(0), answer("a")), answer("a", { grade: "help" }));
    assert.equal(answeredCount(p), 1);
    assert.equal(p.answers.a.grade, "help");
  });

  it("moves on to the next card with no answer", () => {
    assert.equal(nextOpen(pass(0, "a"), deck).at, 1);
    assert.equal(nextOpen(pass(0, "a", "b"), deck).at, 2);
  });

  it("wraps past the end, so a card skipped early comes back", () => {
    const p = nextOpen(pass(3, "b", "c", "d"), deck);
    assert.equal(p.at, 0);
    assert.equal(p.finished, false);
  });

  it("finishes when the last card is answered", () => {
    const p = nextOpen(pass(3, "a", "b", "c", "d"), deck);
    assert.equal(p.finished, true);
    assert.equal(p.at, 3, "and stays on the card that ended it");
  });

  it("finishes an empty deck rather than walking it", () => {
    assert.equal(nextOpen(openPass(), []).finished, true);
  });
});

describe("stepping through the deck", () => {
  it("goes where it is asked", () => {
    assert.equal(stepTo(pass(1), deck, 3).at, 3);
  });

  it("hands back the same pass past either end, and on the card already in front", () => {
    const p = pass(1);
    assert.equal(stepTo(p, deck, -1), p);
    assert.equal(stepTo(p, deck, 4), p);
    assert.equal(stepTo(p, deck, 1), p);
  });

  it("keeps the answers", () => {
    assert.equal(answeredCount(stepTo(pass(0, "a"), deck, 2)), 1);
  });
});

describe("what the pass says about itself", () => {
  it("counts every card as answered only when every card is", () => {
    assert.equal(allAnswered(pass(0, "a", "b", "c"), deck), false);
    assert.equal(allAnswered(pass(0, "a", "b", "c", "d"), deck), true);
  });

  it("does not call an empty deck answered: it was never asked", () => {
    assert.equal(allAnswered(openPass(), []), false);
  });

  it("lists the answers in the order the deck asked them, whatever order they were given in", () => {
    let p = openPass();
    for (const id of ["c", "a", "d"]) p = withAnswer(p, answer(id));
    assert.deepEqual(passAnswers(p, deck).map((a) => a.cardId), ["a", "c", "d"]);
  });

  it("leaves out an answer to a card the deck no longer has", () => {
    const p = withAnswer(pass(0, "a"), answer("gone"));
    assert.deepEqual(passAnswers(p, deck).map((a) => a.cardId), ["a"]);
  });
});

describe("ending it early", () => {
  it("is finished with cards nobody answered", () => {
    const p = finishPass(pass(1, "a"));
    assert.equal(p.finished, true);
    assert.equal(answeredCount(p), 1);
  });

  it("hands back the same pass when it is already over", () => {
    const done = finishPass(pass(0));
    assert.equal(finishPass(done), done);
  });
});
