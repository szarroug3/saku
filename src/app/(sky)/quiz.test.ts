// The Sky's quiz cards from the app's tables: the kinds of card the sample
// deals, and the two that carry their own board (a listening card, an
// ordering card).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { factsOf } from "@/lib/facts";
import { emptyHistory } from "@/lib/history-ops";
import { LIB_ENTRIES_BY_KIND } from "@/lib/library/entries";
import type { FactId } from "@/types";

import { matchesKey } from "@/lib/answer-key";
import { grade } from "./grade";
import { quizCards, sampleCards } from "./quiz";
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

  it("types kana for every typed answer that is Japanese, and romaji only for a kana", () => {
    // Sam, 2026-09-06: nothing but a kana card should ever ask for romaji.
    for (const card of cards.filter((c) => c.typed)) {
      const wantsKana = card.answerInKana !== undefined;
      if (card.item.kind === "kana" || card.answerIs === "meaning") {
        assert.equal(wantsKana, false, `${card.id} should take romaji or English, not kana`);
      } else if (card.answerIs === "reading") {
        assert.equal(wantsKana, true, `${card.id} asks for a reading, so its box types kana`);
      }
    }
  });

  it("names the script a kana box types, so katakana does not come out hiragana", () => {
    for (const card of cards.filter((c) => c.answerInKana)) {
      assert.ok(["hiragana", "katakana"].includes(card.answerInKana!), card.id);
      // the reveal is what the box is aiming at, so the two must agree
      const katakana = /[゠-ヿ]/u.test(card.answer);
      assert.equal(card.answerInKana === "katakana", katakana, `${card.id} reveals ${card.answer}`);
    }
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

describe("the verb a grammar card is drilled on", () => {
  const KANJI = /[一-龯]/;
  const production: FactId[] = [];
  for (const entry of LIB_ENTRIES_BY_KIND.get(GRAMMAR_SUBJECT) ?? []) {
    for (const fact of factsOf(entry.id)) if (!(fact as string).includes("/meaning")) production.push(fact as FactId);
    if (production.length >= 10) break;
  }
  const deck = production.slice(0, 10);
  const fresh = quizCards(emptyHistory(), deck, NOW);

  it("has one, rather than falling back to the fact's baked lemma", () => {
    // Nothing rolled a vehicle after the cutover, so every grammar card was
    // asked on the verb baked into the fact, in kanji, whoever was looking.
    assert.ok(fresh.length > 0, "the deck built");
    assert.ok(fresh.every((c) => c.meta?.vehicle), "every card names the verb it rolled");
  });

  it("is drawn in kana for a learner who knows none of the pool", () => {
    // Sam's standing rule: a card built on 買う measures whether you can read
    // 買う, not whether you know the pattern. かう you can read from day one.
    for (const card of fresh) {
      assert.equal(card.meta?.vehicleKnown, "", `${card.id} counted its verb as known on an empty history`);
      assert.ok(!KANJI.test(card.prompt.glyph), `${card.id} showed ${card.prompt.glyph}`);
      for (const option of card.options) assert.ok(!KANJI.test(option.label), `${card.id} offered ${option.label}`);
    }
  });

  it("grades the pattern built on the verb that was asked, in either script", () => {
    // The answer is recomputed from the vehicle, so a card graded against the
    // fact's baked verb would mark every right answer wrong.
    for (const card of fresh.filter((c) => c.typed)) {
      // the reveal shows the kana answer and, when they differ, the kanji one
      const [kana, kanji] = /^(.*?)（(.*?)）$/.exec(card.answer)?.slice(1) ?? [card.answer];
      assert.ok(grade(card, kana), `${card.id} rejected its own answer ${kana}`);
      if (kanji) assert.ok(grade(card, kanji), `${card.id} rejected ${kanji}`);
      assert.ok(!grade(card, "たべた"), `${card.id} accepted an unrelated form`);
    }
  });
});

describe("a word read two ways (SAK-393)", () => {
  const deckFor = (word: string) => quizCards(emptyHistory(), [...factsOf(word as never)] as FactId[], NOW);

  it("asks 九 once for its reading and once for its meaning, not twice for each", () => {
    // 九 is きゅう and く, both nine. It used to be four cards: two readings
    // that each refused the other, and the same meaning question twice.
    const cards = deckFor("word:九");
    assert.equal(cards.length, 2, cards.map((c) => c.id).join(", "));
    assert.equal(cards.filter((c) => c.id.includes("/reading")).length, 1);
    assert.equal(cards.filter((c) => c.id.includes("/meaning")).length, 1);
  });

  it("takes either reading of 九, since the learner knowing one is not a miss", () => {
    const reading = deckFor("word:九").find((c) => c.id.includes("/reading"))!;
    assert.ok(matchesKey(reading.key, "きゅう"), "きゅう should be right");
    assert.ok(matchesKey(reading.key, "く"), "く should be right");
    // and the reveal shows both, so the one not said is still learned
    assert.match(reading.answer, /きゅう/);
    assert.match(reading.answer, /く/);
  });

  it("leaves 日 alone, because にち and ひ are different things to know", () => {
    const cards = deckFor("word:日");
    assert.equal(cards.length, 4, cards.map((c) => c.id).join(", "));
    const readings = cards.filter((c) => c.id.includes("/reading"));
    assert.equal(readings.length, 2);
    for (const card of readings) {
      const other = card.id.includes("にち") ? "ひ" : "にち";
      assert.ok(!matchesKey(card.key, other), `${card.id} should not take ${other}`);
    }
  });

  it("still marks a wrong reading wrong", () => {
    const reading = deckFor("word:九").find((c) => c.id.includes("/reading"))!;
    assert.ok(!matchesKey(reading.key, "はち"));
    assert.ok(!matchesKey(reading.key, "nine"));
  });
});
