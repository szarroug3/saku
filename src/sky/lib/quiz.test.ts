// The deck's order (SAK-388): dealt, not asked in the order the facts came
// out of the tables, and a word's own cards moved apart.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seeded } from "./random";
import { shuffleDeck, type QuizCard } from "./quiz";
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
