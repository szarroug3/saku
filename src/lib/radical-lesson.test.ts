// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//   src/lib/radical-lesson.test.ts
//
// The radical track's two promises, tested against the real data:
//   1. GATING — a kanji is never taught before its radical. When the next kanji
//      group needs an unlearned radical, nextKanjiLesson goes null and
//      nextRadicalLesson supplies exactly those radicals; claim them and the
//      kanji group unlocks.
//   2. ORDER — the due list is the radicals of the NEXT kanji group, in teaching
//      order, and the orphans (no kanji needs them) only surface once the whole
//      kanji track is done.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_GROUP_FACTS } from "./lesson.ts";
import { LESSON_RANGE_DEFAULT, kanjiCurriculum, nextKanjiLesson } from "./kanji-lesson.ts";
import { kanjiTeachOrder, meaningFactId } from "../data/kanji.ts";
import { radicalMeaningFactId, radicalOfKanji } from "../data/radicals.ts";
import { RADICAL_TEACHING_ORDER } from "./radical-order.ts";
import { radicalKnown } from "./radical-known.ts";
import {
  dueRadicals,
  hasStartedRadicalTrack,
  nextRadicalLesson,
} from "./radical-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const ORDER = kanjiTeachOrder("everyday");
const RANGE = LESSON_RANGE_DEFAULT;
const PER = 5;

/** Every kana fact, claimed — the "kana is done" state the post-kana tracks
 * open behind. */
const KANA_DONE: Record<string, number> = Object.fromEntries(
  KANA_GROUP_FACTS.flat().map((f) => [f, Date.UTC(2026, 0, 1)]),
);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return {
    sessions: [],
    facts: {},
    ...over,
    claims: {
      ...KANA_DONE,
      ...(over.claims ?? {}),
    } as HistoryFile["claims"],
  };
}

function claiming(facts: readonly FactId[], base: HistoryFile): HistoryFile {
  const claims: Record<string, number> = { ...(base.claims as object) };
  for (const f of facts) claims[f] = Date.UTC(2026, 0, 1);
  return { ...base, claims: claims as HistoryFile["claims"] };
}

/** The kanji of the first fresh kanji group at the default order/range. */
function firstKanjiGroupChars(): string[] {
  return kanjiCurriculum(ORDER, RANGE)[0].chars.slice();
}

describe("kanji gate on radicals", () => {
  test("with no radicals known, the first kanji lesson is blocked", () => {
    const h = history();
    assert.equal(nextKanjiLesson(h, ORDER, RANGE), null);
  });

  test("the due radicals are exactly the unknown radicals of that blocked group", () => {
    const h = history();
    const chars = firstKanjiGroupChars();
    const expected = new Set<number>();
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      if (rad) expected.add(rad.num);
    }
    const due = new Set(dueRadicals(h, ORDER, RANGE).map((r) => r.num));
    assert.deepEqual(due, expected);
  });

  test("nextRadicalLesson teaches those radicals, and claiming them unlocks the kanji", () => {
    const h = history();
    const lesson = nextRadicalLesson(h, ORDER, RANGE, PER);
    assert.ok(lesson, "a radical lesson is due while a kanji group is blocked");
    assert.ok(lesson.cards.length > 0);

    // Claim every due radical (may take more than one card's worth), then the
    // gate opens.
    const allDue = dueRadicals(h, ORDER, RANGE).map((r) =>
      radicalMeaningFactId(r.glyph),
    );
    const after = claiming(allDue, h);
    assert.ok(
      nextKanjiLesson(after, ORDER, RANGE),
      "the first kanji lesson unlocks once its radicals are known",
    );
  });

  test("every kanji in the unlocked group now has a known radical", () => {
    const chars = firstKanjiGroupChars();
    const rads = new Set<FactId>();
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      if (rad) rads.add(radicalMeaningFactId(rad.glyph));
    }
    const after = claiming([...rads], history());
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      if (rad) assert.ok(radicalKnown(rad.glyph, after));
    }
  });
});

describe("teaching order and orphans", () => {
  test("hasStartedRadicalTrack flips once any radical is known", () => {
    const h = history();
    assert.equal(hasStartedRadicalTrack(h), false);
    const first = RADICAL_TEACHING_ORDER[0];
    const after = claiming([radicalMeaningFactId(first.glyph)], h);
    assert.equal(hasStartedRadicalTrack(after), true);
  });

  test("orphans (no consumer) are only due once every kanji is learned", () => {
    // Which radicals a kanji actually needs (their consumers), vs the orphans.
    const consumed = new Set<number>();
    for (const c of ORDER) {
      const rad = radicalOfKanji(c);
      if (rad) consumed.add(rad.num);
    }
    const orphans = RADICAL_TEACHING_ORDER.filter((r) => !consumed.has(r.num)).map(
      (r) => r.num,
    );

    // Claim every kanji AND every consumer radical: the kanji track is finished
    // and no needed radical is outstanding, so the only radicals still due are
    // the orphans, taught at the tail for completeness.
    const facts: FactId[] = [];
    for (const c of ORDER) facts.push(meaningFactId(c));
    for (const r of RADICAL_TEACHING_ORDER) {
      if (consumed.has(r.num)) facts.push(radicalMeaningFactId(r.glyph));
    }

    const after = claiming(facts, history());
    const due = dueRadicals(after, ORDER, RANGE).map((r) => r.num);
    assert.deepEqual(new Set(due), new Set(orphans));
    assert.ok(orphans.length > 0, "there are orphan radicals to tail");
  });
});
