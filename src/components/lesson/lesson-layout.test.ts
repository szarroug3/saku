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
  test("kanji section order is parts, readings, then writing at the foot", () => {
    const iParts = LESSON.indexOf("<KanjiPartsRow");
    const iReadings = LESSON.indexOf("<LessonReadings");
    const iWriting = LESSON.indexOf("<HowItsWritten");
    assert.ok(iParts !== -1 && iReadings !== -1 && iWriting !== -1);
    assert.ok(iParts < iReadings && iReadings < iWriting);
  });

  test("the two paired rows use full-width fallback helper", () => {
    assert.match(KANJI_ROW, /return\s*\(\s*<LessonPanel title="Built from">/);
    assert.match(
      LESSON,
      /<PairedRow[\s\S]*wide=\{wordAlign \? <WordReadingsPanel[\s\S]*narrow=\{wordExample \? <WordSentencePanel[\s\S]*\/>/,
    );
  });

  test("lesson surfaces render no standings", () => {
    assert.doesNotMatch(LESSON, /StandingChip/);
    assert.doesNotMatch(LESSON_READINGS, /StandingChip/);
    assert.doesNotMatch(KANJI_ROW, /StandingChip/);
  });
});
