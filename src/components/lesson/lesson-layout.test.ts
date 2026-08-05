import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const LESSON = readFileSync(resolve(HERE, "lesson-item-view.tsx"), "utf-8");
const LESSON_READINGS = readFileSync(resolve(HERE, "lesson-readings.tsx"), "utf-8");
// The kanji block's "Built from" box is the Library's own card now, so the
// breakdown the lesson shows and the one the entry page shows cannot disagree —
// see KanjiBuiltFrom, fed builtFrom(entry). It replaced the lesson-only
// KanjiPartsRow, whose kanji-only `teachableParts` hid a radical piece like 千's
// 丿 that the Library always showed.
const KANJI_BUILT_FROM = readFileSync(
  resolve(HERE, "../library/kanji-built-from.tsx"),
  "utf-8",
);

describe("lesson layout wiring", () => {
  test("kanji section order is what it means, then its parts, then writing at the foot", () => {
    const iMeaning = LESSON.indexOf("<KanjiMeaningPanel");
    const iParts = LESSON.indexOf("<KanjiBuiltFrom");
    const iWriting = LESSON.indexOf("<HowItsWritten");
    assert.ok(iMeaning !== -1 && iParts !== -1 && iWriting !== -1);
    assert.ok(iMeaning < iParts && iParts < iWriting);
  });

  test("the kanji's 'Built from' is the Library's box, so lesson and entry agree", () => {
    // The kanji block shows the FULL immediate breakdown (KanjiBuiltFrom /
    // builtFrom), radicals included, not the kanji-only KanjiPartsRow it used to.
    // That is what makes 千 show 丿 slash + 十 ten on the lesson as it does in the
    // Library. Gated on the section set, which decides whether there is anything
    // to take apart.
    assert.match(LESSON, /sections\.has\("kanji-parts"\)[\s\S]*<KanjiBuiltFrom/);
    assert.doesNotMatch(LESSON, /<KanjiPartsRow/);
  });

  test("the lesson mounts no readings table at all — that one is the Library's", () => {
    assert.doesNotMatch(LESSON, /<LessonReadings/);
  });

  test("the word's breakdown stands alone, with no example beside it", () => {
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
    assert.doesNotMatch(KANJI_BUILT_FROM, /StandingChip/);
  });
});
