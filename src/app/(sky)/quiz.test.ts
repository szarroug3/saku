// The Sky's quiz cards from the app's tables: the kinds of card the sample
// deals, the two that carry their own board (a listening card, an ordering
// card), and why each wrong choice was on the board (SAK-315).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { pitchFactId } from "@/data/pitch-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { factInfo, factsOf } from "@/lib/facts";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, LIB_ENTRIES_BY_KIND } from "@/lib/library/entries";
import type { FactId, HistoryFile } from "@/types";

import { matchesKey } from "@/lib/answer-key";
import { grade } from "./grade";
import { quizCards, quizFromHistory, sampleCards } from "./quiz";
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

  it("says what kind of word it rolled, in the hint and in the question (SAK-427)", () => {
    // The vehicle was rolled here and then dropped on the floor: `hintFor` and
    // `quizInstruction` both take one and neither was given it, so the hint
    // could only name the pattern the question had already named, and the
    // question fell back to "said in the 〜てはいけない form" with no word to
    // fill its X. Both of Sam's screenshots, from one missing argument.
    for (const card of fresh) {
      assert.ok(card.hint, `${card.id} has no hint`);
      assert.ok(
        card.hint!.text?.includes(" is a") || card.hint!.text?.includes(" is an"),
        `${card.id} hinted ${card.hint!.text ?? "(nothing)"} without naming a class`,
      );
      assert.ok(
        !card.instruction?.includes("said in the"),
        `${card.id} asked ${card.instruction}`,
      );
    }
  });

  it("shows the arithmetic under the class line, one equation to the line", () => {
    // SAK-194's derivation reaches the Sky at last: grammarHint returns it and
    // the card mapper used to keep only `image` and `text`, so the steps fell
    // out on the way. Never the whole answer as a single word: each line is an
    // equation ending in an arrow.
    const derived = fresh.filter((c) => c.hint?.steps?.length);
    assert.ok(derived.length > 0, "no card carried a derivation");
    for (const card of derived) {
      for (const step of card.hint!.steps!) assert.match(step, / → /, card.id);
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

describe("why each of the others was on the board (SAK-315)", () => {
  const boardFor = (fact: string) => quizCards(emptyHistory(), [fact as FactId], NOW)[0];
  const whyOf = (fact: string, label: string) => boardFor(fact).options.find((o) => o.label === label)?.why;

  it("names a flagged pair, which is what that data is for", () => {
    // Sam's own three: 未 against 末, 土 against 士, 大 against 犬
    assert.equal(whyOf("kanji:未/meaning", "end"), "drawn almost the same");
    assert.equal(whyOf("kanji:土/meaning", "gentleman"), "drawn almost the same");
    assert.equal(whyOf("kanji:大/meaning", "dog"), "drawn almost the same");
  });

  it("names a kana's same-shape sibling: さ against き is a visual confusion", () => {
    assert.equal(whyOf("kana:き/reading", "sa"), "drawn almost the same");
    assert.equal(whyOf("kana:あ/reading", "o"), "drawn almost the same");
  });

  it("names the other readings of the same character, which is the whole question", () => {
    // 一 in 統一 is いつ; いち and ひと are the readings you met first
    const board = boardFor("kanji:一/reading@統一");
    const others = board.options.filter((o) => o.id !== board.answerId);
    assert.ok(others.length > 0);
    for (const o of others) assert.equal(o.why, "another reading of the same character", o.label);
  });

  it("names a word's neighbour for what it is: about as common", () => {
    const board = boardFor("word:明白/meaning");
    const others = board.options.filter((o) => o.id !== board.answerId);
    assert.ok(others.length > 0);
    for (const o of others) assert.equal(o.why, "a word about as common as this one", o.label);
  });

  it("names the other half of a verb pair, and the other register of a keigo set", () => {
    const pair = boardFor("transitivity:出る/出す/happens");
    const other = pair.options.find((o) => o.id !== pair.answerId)!;
    assert.equal(other.why, "the other verb of the pair");
    const keigo = boardFor("keigo:welcome/irasshaimase");
    for (const o of keigo.options.filter((o) => o.id !== keigo.answerId)) assert.ok(o.why, o.label);
  });

  it("names the same verb in another pattern, not another verb", () => {
    const board = boardFor("grammar:prenominal-form/production");
    const others = board.options.filter((o) => o.id !== board.answerId);
    assert.ok(others.length > 0);
    for (const o of others) assert.equal(o.why, "the same verb in another pattern", o.label);
  });

  it("says nothing at all rather than inventing a reason", () => {
    // 一 has no flagged pair, so its meaning board is filled from nearby
    // meanings and there is nothing true to say about any of them
    const board = boardFor("kanji:一/meaning");
    assert.ok(board.options.length > 1, "it still has a board");
    assert.ok(board.options.every((o) => !o.why), board.options.map((o) => o.label).join(", "));
  });

  it("never puts a reason on the answer", () => {
    for (const card of sampleCards(sampleHistory(NOW), NOW)) {
      const answer = card.options.find((o) => o.id === card.answerId);
      assert.ok(!answer?.why, card.id);
    }
  });

  it("tells the pitch card's wrong clip what it is", () => {
    const pitch = sampleCards(sampleHistory(NOW), NOW).find((c) => c.id.endsWith("/pitch"))!;
    const other = pitch.options.find((o) => o.id !== pitch.answerId)!;
    assert.match(other.why ?? "", /said the same way|the other pitch/);
  });
});

describe("the two Settings a deck reads (SAK-426)", () => {
  const history = sampleHistory(NOW);

  /** A dozen words asked for their meaning: typed cards with a reading to
   * play, which is what a listening card is made of. */
  const wordMeanings = (LIB_ENTRIES_BY_KIND.get(VOCAB_SUBJECT) ?? [])
    .flatMap((e) => knownFactsOf(e).filter((f) => (f as string).includes("/meaning")))
    .slice(0, 12);

  /** The first word the app can ask a pitch question about. */
  const withPitch = (LIB_ENTRIES_BY_KIND.get(VOCAB_SUBJECT) ?? []).find((e) => factInfo(pitchFactId(e.glyph)))!;

  it("asks by ear only with audio prompts on", () => {
    // the coin flip inside quizCards is Math.random's, so it is pinned: one
    // run says what the setting does rather than what the dice did
    const heard = withRandom(0.1, () => quizCards(history, wordMeanings, NOW, { audio: true }));
    assert.ok(heard.some((c) => c.listen), "a listening card");
    const read = withRandom(0.1, () => quizCards(history, wordMeanings, NOW, {}));
    assert.ok(!read.some((c) => c.listen), "none by ear with audio off");
  });

  it("asks a taught word's pitch only with pitch questions on", () => {
    const asked = withRandom(0.1, () => quizFromHistory(history, [withPitch.id], NOW, { pitch: true }));
    assert.ok(asked.some((c) => c.id.endsWith("/pitch")), withPitch.id);
    const without = withRandom(0.1, () => quizFromHistory(history, [withPitch.id], NOW, { pitch: false }));
    assert.ok(!without.some((c) => c.id.endsWith("/pitch")));
  });
});

/** Runs `fn` with the dice pinned, so a card built on a coin flip is the
 * same card every run. */
function withRandom<T>(value: number, fn: () => T): T {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

describe("the kana under a word she is supposed to know (SAK-429)", () => {
  const asked = (fact: string): HistoryFile => ({
    ...emptyHistory(),
    facts: { [fact as FactId]: { seen: 2, missed: 0, firstTry: 2, correct: 2 } } as HistoryFile["facts"],
  });
  const claimed = (fact: string): HistoryFile => ({ ...emptyHistory(), claims: { [fact as FactId]: NOW } });
  const cardFor = (history: HistoryFile, fact: string) => quizCards(history, [fact as FactId], NOW)[0];

  it("keeps いく under 行く the first time the meaning is asked", () => {
    // A lesson's first quiz teaches the reading alongside the meaning, so the
    // one showing that has never been asked still prints it.
    const card = cardFor(emptyHistory(), "word:行く/meaning");
    assert.equal(card.prompt.context, "いく");
    assert.ok(!card.hint?.text, "and it is not doubled into the hint");
  });

  it("takes it away once she has been asked, and puts it behind Hint", () => {
    // Sam, 2026-09-08: the kana answers half of "what does 行く mean" for free.
    const card = cardFor(asked("word:行く/meaning"), "word:行く/meaning");
    assert.equal(card.prompt.context, undefined);
    assert.equal(card.hint?.text, "いく");
  });

  it("treats a claimed word the same, since she said she knows it", () => {
    const card = cardFor(claimed("word:行く/meaning"), "word:行く/meaning");
    assert.equal(card.prompt.context, undefined);
    assert.equal(card.hint?.text, "いく");
  });

  it("puts the reading first when the card already had a hint of its own", () => {
    // 先生 breaks down into 先 and 生, and that breakdown keeps its place.
    const card = cardFor(asked("word:先生/meaning"), "word:先生/meaning");
    assert.equal(card.prompt.context, undefined);
    assert.equal(card.hint?.text, "せんせい\n先 is before, 生 is life");
  });

  it("leaves a kana word alone, since it never had a reading to hide", () => {
    const card = cardFor(asked("word:これ/meaning"), "word:これ/meaning");
    assert.equal(card.prompt.context, undefined);
    assert.ok(!card.hint?.text, "and there is nothing to hint at");
  });

  it("leaves a reading card its glosses, which are what tells its readings apart", () => {
    const card = cardFor(asked("word:行く/reading"), "word:行く/reading");
    assert.match(card.prompt.context ?? "", /to go/);
    assert.ok(!card.hint?.text);
  });
});
