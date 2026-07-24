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

  test("the word's sound panel stands alone, with no example beside it", () => {
    assert.match(KANJI_ROW, /return\s*\(\s*<LessonPanel title="Built from">/);
    // The example sentence is the Library's now, so the readings panel has no
    // partner and needs no PairedRow to keep the row from going lopsided. It is
    // gated on the section set, which is where "is there anything to explain"
    // gets decided (see explainsItsSound).
    assert.match(LESSON, /sections\.has\("word-readings"\)[\s\S]*<WordReadingsPanel/);
    assert.doesNotMatch(LESSON, /WordSentencePanel/);
  });

  test("lesson surfaces render no standings", () => {
    assert.doesNotMatch(LESSON, /StandingChip/);
    assert.doesNotMatch(LESSON_READINGS, /StandingChip/);
    assert.doesNotMatch(KANJI_ROW, /StandingChip/);
  });
});
