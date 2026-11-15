import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasCard, passageAround, plainText, type ReadText } from "./reader";

const text: ReadText = {
  paragraphs: [
    [{ text: "私", entry: "word:私", standing: "solid" }, { text: "は", entry: "word:は", standing: "solid" }, { text: "。", mark: true }],
    [{ text: "映画", reading: "えいが", entry: "word:映画", standing: "not-seen" }, { text: "を" }, { text: "見", base: "見る", entry: "word:見る", standing: "claimed" }, { text: "た" }],
  ],
};

describe("plainText", () => {
  it("puts the words back together, a paragraph to a line", () => {
    assert.equal(plainText(text), "私は。\n映画を見た");
  });
});

describe("passageAround", () => {
  it("is the text near the selection", () => {
    assert.equal(passageAround(text, "映画"), "私は。\n映画を見た");
  });
  it("cuts a long text to the part around the selection", () => {
    const long: ReadText = { paragraphs: [[{ text: "あ".repeat(2000) }], [{ text: "映画" }], [{ text: "い".repeat(2000) }]] };
    const got = passageAround(long, "映画");
    assert.ok(got.includes("映画"));
    assert.ok(got.length < 1300);
  });
  it("is the start of the text when the selection isn't found as it is", () => {
    assert.equal(passageAround(text, "nothing"), "私は。\n映画を見た");
  });
});

describe("hasCard", () => {
  it("is true for a word Saku teaches, or one with kanji it teaches", () => {
    assert.equal(hasCard({ text: "見", entry: "word:見る" }), true);
    assert.equal(hasCard({ text: "東京", kanji: [{ id: "kanji:東", glyph: "東", standing: "not-seen" }] }), true);
    assert.equal(hasCard({ text: "た" }), false);
  });
});
