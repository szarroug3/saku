// The Sky's quiz cards from the app's tables: the kinds of card the sample
// deals, and the two that carry their own board (a listening card, an
// ordering card).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleCards } from "./quiz";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 5);

describe("the sample quiz", () => {
  const cards = sampleCards(sampleHistory(NOW), NOW);

  it("deals one card of every kind, ids unique", () => {
    assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
    assert.ok(cards.some((c) => c.id.startsWith("kana:")));
    assert.ok(cards.some((c) => c.id.endsWith("/pitch")));
    assert.ok(cards.some((c) => c.listen), "a listening card");
    assert.ok(cards.some((c) => c.order), "an ordering card");
  });

  it("deals a listening card as its fact, asked by ear, with the glyph to reveal", () => {
    const heard = cards.find((c) => c.listen)!;
    assert.ok(heard.id.endsWith("#listen"));
    assert.ok(heard.listen && /^[぀-ヿ]+$/.test(heard.listen), "plays kana");
    assert.ok(heard.prompt.glyph.length > 0);
    assert.equal(heard.typed, true);
  });

  it("deals an ordering card whose pieces are the answer, shuffled", () => {
    const order = cards.find((c) => c.order)!;
    assert.ok(order.id.startsWith("grammar:sentence-ordering-tier/"));
    assert.deepEqual([...order.order!.pieces].sort(), [...order.order!.answer].sort());
    assert.ok(order.order!.pieces.length < 2 || !order.order!.pieces.every((p, i) => p === order.order!.answer[i]), "not dealt in order");
    assert.equal(order.answer, order.order!.answer.join(""));
    assert.ok(order.meta?.facts !== undefined);
  });
});
