// Which reading applies here, and why (SAK-316). The prose is authored per
// RULE, so what these check is that the right rule is chosen, that the
// wording is the same wording every time, and that a card with no rule to
// name gets none.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { READING_INDEX } from "@/data/kanji";
import type { FactId } from "@/types";

import { readingRuleFor } from "./quiz-rules";

/** A stand-in for the thing a card is about; only `kind` is read. */
const kanji = { id: "kanji:水", kind: "kanji", glyph: "水", english: "water" } as never;
const counter = { id: "counter:tsu:1", kind: "counter", glyph: "一つ", english: "one thing" } as never;

const ruleFor = (fact: string) => readingRuleFor(fact as FactId, kanji);

describe("the rule a card exercises", () => {
  it("explains 水 the way Sam wrote it: すい joined, みず alone", () => {
    const rule = ruleFor("kanji:水/reading@水曜")!;
    assert.equal(rule.title, "On'yomi: the borrowed reading");
    assert.match(rule.prose, /すい is an on'yomi/);
    assert.match(rule.prose, /joined to other kanji/);
    assert.match(rule.prose, /Same character, and the company it keeps decides\./);
  });

  it("marks the reading that applies against the ones that did not", () => {
    const readings = ruleFor("kanji:水/reading@水曜")!.readings!;
    const applies = readings.filter((r) => r.applies);
    assert.equal(applies.length, 1);
    assert.equal(applies[0].reading, "すい");
    assert.equal(applies[0].kind, "on'yomi");
    // and the contrast is there: みず, the reading that did not apply
    const other = readings.find((r) => r.reading === "みず")!;
    assert.equal(other.applies, false);
    assert.equal(other.kind, "kun'yomi");
  });

  it("does not list one reading twice, however many words anchor it", () => {
    for (const fact of [...READING_INDEX.keys()].slice(0, 400)) {
      const readings = readingRuleFor(fact, kanji)?.readings ?? [];
      assert.equal(new Set(readings.map((r) => r.reading)).size, readings.length, fact);
      assert.ok(readings.length <= 6, `${fact} listed ${readings.length}`);
      assert.equal(readings.filter((r) => r.applies).length, readings.length ? 1 : 0, fact);
    }
  });

  it("calls a native reading native, even inside a compound", () => {
    // 一 is ひと in 一人, which IS a compound and still takes the kun'yomi
    const rule = ruleFor("kanji:一/reading@一人")!;
    assert.equal(rule.title, "Kun'yomi: the native reading");
    assert.match(rule.prose, /inside a word built out of native words/);
  });

  it("says when the reading clips short, and that it is the same reading", () => {
    const rule = ruleFor("kanji:学/reading@学校")!;
    assert.match(rule.prose, /clips short, がく to がっ/);
    assert.match(rule.prose, /counts as the same reading\./);
  });

  it("says when the reading voices, and that it is the same reading", () => {
    // 主 is す, and 坊主 says ず
    const rule = ruleFor("kanji:主/reading@坊主")!;
    assert.match(rule.prose, /voices, す to ず/);
    assert.match(rule.prose, /counts as the same reading\./);
  });

  it("refuses to pick when the dictionary files a reading both ways", () => {
    const both = [...READING_INDEX.entries()].find(([, r]) => r.type === "both")!;
    const rule = readingRuleFor(both[0], kanji)!;
    assert.equal(rule.title, "Filed both ways");
    assert.match(rule.prose, /no rule to lean on/);
  });

  it("names the two sets of numbers on a counting card", () => {
    assert.equal(readingRuleFor("numbers:tens/count" as FactId, counter)?.title, "Japanese counts twice over");
    assert.equal(readingRuleFor("counter:tsu:1/reading" as FactId, counter)?.title, "Japanese counts twice over");
  });

  it("says nothing for a card that exercises no rule it can name", () => {
    // what a character MEANS is not a question about which reading applies
    assert.equal(ruleFor("kanji:一/meaning"), undefined);
    assert.equal(readingRuleFor("word:明白/meaning" as FactId, kanji), undefined);
    assert.equal(readingRuleFor("kana:あ/reading" as FactId, kanji), undefined);
  });
});

describe("the prose is authored per rule, not per item", () => {
  const rules = [...READING_INDEX.keys()].map((f) => readingRuleFor(f, kanji)!).filter(Boolean);

  it("has four titles in all, however many thousand readings there are", () => {
    assert.ok(rules.length > 3000, `${rules.length} readings`);
    assert.deepEqual(
      [...new Set(rules.map((r) => r.title))].sort(),
      ["Filed both ways", "Kun'yomi: the native reading", "On'yomi: the borrowed reading"],
    );
  });

  it("says the same sentences every time, with the character and the word filled in", () => {
    // the wording with everything item-specific blanked out. Three rules,
    // each with or without a sentence about what happens to the sound inside
    // this particular word, is nine shapes at the outside; more than that
    // would mean the prose had drifted per item.
    const shapes = new Set(rules.map((r) => `${r.title}|${r.prose.replace(/[぀-ヿ一-龯]+/g, "*")}`));
    assert.ok(shapes.size <= 9, `${shapes.size} shapes:\n${[...shapes].join("\n\n")}`);
  });
});
