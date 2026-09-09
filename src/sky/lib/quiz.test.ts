// The deck's order (SAK-388): dealt, not asked in the order the facts came
// out of the tables, and a word's own cards moved apart. And how many goes a
// card gets, which the quiz screen used to work out inline (SAK-370).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seeded } from "./random";
import { maxTriesFor, shuffleDeck, triedBefore, triesNote, type QuizAnswer, type QuizCard, type QuizOption } from "./quiz";
import type { SkyItem } from "./types";

const item = (id: string): SkyItem => ({ id, kind: "word", glyph: id, english: id } as SkyItem);

/** A card of `itemId`, named so a run reads as a string: "a1" is the first
 * card of item a. */
const card = (itemId: string, n: number): QuizCard => ({
  id: `${itemId}${n}`,
  item: item(itemId),
  prompt: { glyph: itemId, jp: true },
  answer: itemId,
  answerIs: "meaning",
  seen: 0,
  missed: 0,
} as unknown as QuizCard);

const deck = (spec: string): QuizCard[] => [...spec].map((c, i) => card(c, i));
const order = (cards: readonly QuizCard[]) => cards.map((c) => c.id).join(" ");
const items = (cards: readonly QuizCard[]) => cards.map((c) => c.item.id).join("");

describe("shuffleDeck", () => {
  it("keeps every card, once", () => {
    const cards = deck("abcdefgh");
    const dealt = shuffleDeck(cards, seeded(7));
    assert.equal(dealt.length, cards.length);
    assert.deepEqual([...dealt].map((c) => c.id).sort(), [...cards].map((c) => c.id).sort());
  });

  it("does not ask them in the order they came in", () => {
    const cards = deck("abcdefgh");
    assert.notEqual(order(shuffleDeck(cards, seeded(7))), order(cards));
  });

  it("leaves what it was handed alone", () => {
    const cards = deck("abcdefgh");
    const before = order(cards);
    shuffleDeck(cards, seeded(7));
    assert.equal(order(cards), before);
  });

  it("deals a different order per seed, and the same order for one seed", () => {
    const cards = deck("abcdefgh");
    assert.equal(order(shuffleDeck(cards, seeded(3))), order(shuffleDeck(cards, seeded(3))));
    assert.notEqual(order(shuffleDeck(cards, seeded(3))), order(shuffleDeck(cards, seeded(4))));
  });

  it("never asks two cards of one word back to back, whatever the seed", () => {
    // four words of two cards each: the meaning and the reading of every one
    const cards = [...deck("abcd"), ...deck("abcd")];
    for (let seed = 1; seed <= 200; seed++) {
      const dealt = items(shuffleDeck(cards, seeded(seed)));
      for (let i = 1; i < dealt.length; i++) assert.notEqual(dealt[i], dealt[i - 1], `seed ${seed}: ${dealt}`);
    }
  });

  it("keeps a deck with nothing else to offer rather than looping", () => {
    const cards = deck("aaa");
    assert.equal(items(shuffleDeck(cards, seeded(5))), "aaa");
  });

  it("does its best when one word is most of the deck", () => {
    const cards = [...deck("aaaa"), ...deck("bc")];
    const dealt = items(shuffleDeck(cards, seeded(9)));
    let clashes = 0;
    for (let i = 1; i < dealt.length; i++) if (dealt[i] === dealt[i - 1]) clashes++;
    // four a's among six cards can be split at best into three pairs
    assert.ok(clashes <= 2, dealt);
  });

  it("is happy with an empty deck and a deck of one", () => {
    assert.deepEqual(shuffleDeck([], seeded(1)), []);
    assert.equal(order(shuffleDeck(deck("a"), seeded(1))), "a0");
  });
});

/** A card of `n` choices, typed or not. */
const board = (n: number, over: Partial<QuizCard> = {}): QuizCard => {
  const options: QuizOption[] = Array.from({ length: n }, (_, i) => ({ id: `o${i}`, label: `o${i}`, jp: false }));
  return { ...card("a", 0), typed: false, options, answerId: "o0", ...over } as QuizCard;
};

describe("maxTriesFor", () => {
  it("gives a typed card the retries plus its first go", () => {
    assert.equal(maxTriesFor(board(4, { typed: true }), 2), 3);
    assert.equal(maxTriesFor(board(4, { typed: true }), 0), 1);
  });

  it("gives an ordering card the retries too: there is no board to exhaust", () => {
    const ordering = board(0, { order: { pieces: ["a", "b"], answer: ["a", "b"] } });
    assert.equal(maxTriesFor(ordering, 2), 3);
  });

  it("stops a board of choices one short of giving itself away", () => {
    // two choices: one wrong pick leaves only the answer, so there is one go
    assert.equal(maxTriesFor(board(2), 2), 1);
    assert.equal(maxTriesFor(board(3), 2), 2);
    assert.equal(maxTriesFor(board(4), 2), 3);
    // and never more than the retries allow, however wide the board
    assert.equal(maxTriesFor(board(8), 2), 3);
  });

  it("always leaves one go, even on a board of one", () => {
    assert.equal(maxTriesFor(board(1), 2), 1);
    assert.equal(maxTriesFor(board(0), 2), 1);
  });

  it("answers for no card at all, since the quiz asks before it has one", () => {
    assert.equal(maxTriesFor(undefined, 2), 3);
  });
});

describe("triesNote", () => {
  it("counts down, and says the last one in words", () => {
    assert.equal(triesNote(2), "2 tries left.");
    assert.equal(triesNote(1), "One more try.");
  });
});

describe("what was said before the right answer", () => {
  const answer = (over: Partial<QuizAnswer>): QuizAnswer => ({ cardId: "a", grade: "clean", tries: 1, narrowed: false, hinted: false, ...over });

  it("is the attempts before the last one, since the last one is the answer", () => {
    assert.deepEqual(triedBefore(answer({ grade: "help", tries: 3, said: ["みず", "すいよう", "すい"] })), ["みず", "すいよう"]);
  });

  it("is nothing on a card answered first time", () => {
    assert.deepEqual(triedBefore(answer({ said: ["すい"] })), []);
  });

  it("is nothing on a card answered with a hint and no wrong go", () => {
    assert.deepEqual(triedBefore(answer({ grade: "help", tries: 1, hinted: true, said: ["すい"] })), []);
  });

  it("is nothing on a missed card, which has no right answer to be before", () => {
    // its whole list is what it said, and the reveal shows that under the
    // answer instead (SAK-387)
    assert.deepEqual(triedBefore(answer({ grade: "missed", tries: 3, said: ["みず", "すいよう"] })), []);
  });

  it("is nothing when the card recorded no attempt at all", () => {
    assert.deepEqual(triedBefore(answer({ grade: "help", tries: 2 })), []);
  });
});
