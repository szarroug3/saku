import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NO_RUN, orderDeck, readRun, resumeAt, runNote, runProgress, runToKeep, sameSource, trimRun, type SavedRun } from "./quiz-run";
import type { QuizAnswer, QuizCard } from "./quiz";

const answer = (cardId: string, over: Partial<QuizAnswer> = {}): QuizAnswer => ({ cardId, grade: "clean", tries: 1, narrowed: false, hinted: false, ...over });

const run = (over: Partial<SavedRun> = {}): SavedRun => ({
  deck: ["a", "b", "c", "d"],
  at: 2,
  answers: [answer("a"), answer("b", { grade: "missed", tries: 3 })],
  from: {},
  leftAt: 1000,
  ...over,
});

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

describe("a saved run, read back", () => {
  it("keeps a run part way through", () => {
    const back = readRun(JSON.parse(JSON.stringify(run())));
    assert.deepEqual(back?.deck, ["a", "b", "c", "d"]);
    assert.equal(back?.at, 2);
    assert.equal(back?.answers.length, 2);
    assert.equal(back?.answers[1].grade, "missed");
  });

  it("is nothing at all when there is no deck", () => {
    assert.equal(readRun(null), NO_RUN);
    assert.equal(readRun({}), null);
    assert.equal(readRun({ deck: [] }), null);
    assert.equal(readRun("a run"), null);
    assert.equal(readRun({ deck: ["a", 2] }), null);
  });

  it("is nothing when every card was answered: that run finished", () => {
    assert.equal(readRun(run({ deck: ["a", "b"], answers: [answer("a"), answer("b")] })), null);
  });

  it("drops an answer of a shape it cannot read, and keeps the rest", () => {
    const back = readRun(run({ answers: [answer("a"), { cardId: "b" }, { grade: "clean" }] as QuizAnswer[] }));
    assert.deepEqual(back?.answers.map((a) => a.cardId), ["a"]);
  });

  it("takes a position outside the deck as the start", () => {
    assert.equal(readRun(run({ at: 9 }))?.at, 0);
    assert.equal(readRun(run({ at: -1 }))?.at, 0);
  });

  it("keeps only the parts of the source it understands", () => {
    const back = readRun(run({ from: { picks: ["x"], cards: [], recipe: "{}" } }));
    assert.deepEqual(back?.from, { picks: ["x"], recipe: "{}" });
  });
});

describe("how far in a run is", () => {
  it("counts the answers against the deck", () => {
    assert.deepEqual(runProgress(run()), { answered: 2, total: 4 });
  });

  it("does not count an answer to a card no longer in the deck", () => {
    assert.deepEqual(runProgress(run({ deck: ["c", "d"] })), { answered: 0, total: 2 });
  });

  it("says so in the app's words, and says card once for one", () => {
    assert.equal(runNote(run()), "4 cards, 2 answered");
    assert.equal(runNote(run({ deck: ["a"], answers: [] })), "1 card, 0 answered");
  });
});

describe("whether two runs were asked for in the same words", () => {
  it("matches what is due against what is due", () => {
    assert.equal(sameSource({}, {}), true);
  });

  it("tells picks, named cards and a recipe apart", () => {
    assert.equal(sameSource({ picks: ["a"] }, { picks: ["a"] }), true);
    assert.equal(sameSource({ picks: ["a"] }, { picks: ["b"] }), false);
    assert.equal(sameSource({ picks: ["a"] }, {}), false);
    assert.equal(sameSource({ cards: ["a"] }, { picks: ["a"] }), false);
    assert.equal(sameSource({ recipe: "{\"size\":10}" }, { recipe: "{\"size\":10}" }), true);
    assert.equal(sameSource({ recipe: "{\"size\":10}" }, { recipe: "{\"size\":20}" }), false);
  });
});

describe("the deck put back in the order it was dealt", () => {
  it("asks the cards in the deck's order, not the loader's", () => {
    const cards = [card("c"), card("a"), card("b")];
    assert.deepEqual(orderDeck(cards, ["a", "b", "c"]).map((c) => c.id), ["a", "b", "c"]);
  });

  it("leaves out a card the data no longer has", () => {
    assert.deepEqual(orderDeck([card("a"), card("c")], ["a", "b", "c"]).map((c) => c.id), ["a", "c"]);
  });
});

describe("a run trimmed to the cards that came back", () => {
  it("is untouched when they all did", () => {
    assert.deepEqual(trimRun(run(), ["a", "b", "c", "d"]), run());
  });

  it("drops a card that is gone, its answer with it, and moves the position", () => {
    const trimmed = trimRun(run(), ["b", "c", "d"]);
    assert.deepEqual(trimmed?.deck, ["b", "c", "d"]);
    assert.deepEqual(trimmed?.answers.map((a) => a.cardId), ["b"]);
    // it was on "c", which is now the second card
    assert.equal(trimmed?.at, 1);
  });

  it("is nothing when nothing is left, or when what is left is answered", () => {
    assert.equal(trimRun(run(), []), null);
    assert.equal(trimRun(run(), ["a", "b"]), null);
  });

  it("starts over when the card it was on is the one that went", () => {
    assert.equal(trimRun(run(), ["a", "b", "d"])?.at, 0);
  });
});

describe("where a resumed run opens", () => {
  it("is the card it was left on", () => {
    assert.equal(resumeAt(run()), 2);
  });

  it("is the next one not answered when that card has since been answered", () => {
    assert.equal(resumeAt(run({ at: 0 })), 2);
  });

  it("wraps to an earlier open card", () => {
    assert.equal(resumeAt(run({ at: 3, answers: [answer("b"), answer("c"), answer("d")] })), 0);
  });
});

describe("what is written after an answer", () => {
  it("is the run as it stands", () => {
    const kept = runToKeep(["a", "b"], 1, [answer("a")], { picks: ["x"] }, 500);
    assert.deepEqual(kept, { deck: ["a", "b"], at: 1, answers: [answer("a")], from: { picks: ["x"] }, leftAt: 500 });
  });

  it("is nothing before the first answer", () => {
    assert.equal(runToKeep(["a", "b"], 0, [], {}, 500), null);
  });

  it("is nothing once the last card is answered", () => {
    assert.equal(runToKeep(["a", "b"], 1, [answer("a"), answer("b")], {}, 500), null);
  });
});
