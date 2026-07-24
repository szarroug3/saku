import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const LESSON = readFileSync(resolve(HERE, "lesson-item-view.tsx"), "utf-8");
const KANJI_ROW = readFileSync(resolve(HERE, "kanji-parts-row.tsx"), "utf-8");
const LESSON_READINGS = readFileSync(resolve(HERE, "lesson-readings.tsx"), "utf-8");

describe("lesson layout wiring", () => {
  test("kanji section order is what it means, then its parts, then writing at the foot", () => {
    const iMeaning = LESSON.indexOf("<KanjiMeaningPanel");
    const iParts = LESSON.indexOf("<KanjiPartsRow");
    const iWriting = LESSON.indexOf("<HowItsWritten");
    assert.ok(iMeaning !== -1 && iParts !== -1 && iWriting !== -1);
    assert.ok(iMeaning < iParts && iParts < iWriting);
  });

  test("the lesson mounts no readings table at all — that one is the Library's", () => {
    assert.doesNotMatch(LESSON, /<LessonReadings/);
  });

  test("the word's breakdown stands alone, with no example beside it", () => {
    // The kanji's own "Built from" is the component breakdown and belongs to the
    // kanji block; the word's is the character breakdown and belongs to the word
    // block. No step shows both, because a word written in several kanji is not
    // a character with parts.
    assert.match(KANJI_ROW, /return\s*\(\s*<LessonPanel title="Built from">/);
    // The example sentence is the Library's now, so the breakdown has no partner
    // and needs no PairedRow to keep the row from going lopsided. It is gated on
    // the section set, which is where "is there anything to take apart" gets
    // decided (see splitsIntoKanji).
    assert.match(LESSON, /sections\.has\("word-built-from"\)[\s\S]*<WordBuiltFrom/);
    assert.doesNotMatch(LESSON, /WordSentencePanel/);
    // ONE breakdown, not two. The lesson's own row stack said the same thing as
    // the Library's box and is gone.
    assert.doesNotMatch(LESSON, /WordReadingsPanel/);
  });

  test("lesson surfaces render no standings", () => {
    assert.doesNotMatch(LESSON, /StandingChip/);
    assert.doesNotMatch(LESSON_READINGS, /StandingChip/);
    assert.doesNotMatch(KANJI_ROW, /StandingChip/);
  });
});
