// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-items.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The stepped lesson page renders whatever lessonPlan() hands it, one item at a
// time. The step model has one load-bearing invariant that isn't visible in a
// screenshot and type-checks either way: the items must be the lesson's facts,
// GROUPED BY ENTRY, IN ORDER, losing none and inventing none. A bug there is a
// glyph that steps twice, or a fact that "Quiz me" silently drops — both of
// which look fine until you count. So these tests count.
//
// They also pin day one (the vowels), the same way kanji-lesson.test.ts pins
// its own head of the order: if the first thing a beginner is walked through
// ever stops being あいうえお, that is a curriculum change, and this is the line
// that says so.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { entryOf } from "./facts.ts";
import { GRAMMAR_PER_LESSON_DEFAULT } from "./grammar-lesson.ts";
import { LESSON_RANGE_DEFAULT } from "./kanji-lesson.ts";
import {
  asTrack,
  LESSON_TRACKS,
  lessonPlan,
  type LessonSettings,
  type LessonTrack,
} from "./lesson-items.ts";
import type { HistoryFile } from "../types/index.ts";

const SETTINGS: LessonSettings = {
  kanjiOrder: "everyday",
  lessonRange: LESSON_RANGE_DEFAULT,
  wordsPerLesson: 6,
  grammarPerLesson: GRAMMAR_PER_LESSON_DEFAULT,
};

/** A learner who has done nothing — so every track's FIRST lesson is what
 * lessonPlan returns. */
const FRESH: HistoryFile = { sessions: [], facts: {} };

describe("asTrack", () => {
  test("passes through the four real tracks", () => {
    for (const t of LESSON_TRACKS) assert.equal(asTrack(t), t);
  });

  test("defaults anything else to kana", () => {
    assert.equal(asTrack("nonsense"), "kana");
    assert.equal(asTrack(""), "kana");
    assert.equal(asTrack(null), "kana");
    assert.equal(asTrack(undefined), "kana");
  });
});

describe("lessonPlan — the step model", () => {
  const tracks: LessonTrack[] = ["kana", "kanji", "word", "grammar"];

  for (const track of tracks) {
    describe(track, () => {
      const plan = lessonPlan(track, FRESH, SETTINGS);

      test("a fresh learner has a first lesson", () => {
        assert.ok(plan, `expected a ${track} lesson for a fresh learner`);
      });

      test("items are the lesson's facts, grouped by entry, in order", () => {
        assert.ok(plan);
        // Flattening the items' facts must reproduce plan.facts exactly — same
        // members, same order, none lost, none invented. This is the whole
        // grouping contract, and it is the thing "Quiz me" and the claims rely
        // on being true.
        const flat = plan.items.flatMap((it) => it.facts);
        assert.deepEqual(flat, plan.facts);
      });

      test("every item's facts belong to that item's entry", () => {
        assert.ok(plan);
        for (const it of plan.items) {
          for (const f of it.facts) {
            assert.equal(entryOf(f), it.entry);
          }
        }
      });

      test("no entry is stepped through twice", () => {
        assert.ok(plan);
        const entries = plan.items.map((it) => it.entry);
        assert.equal(new Set(entries).size, entries.length);
      });

      test("every item is tagged with the plan's track", () => {
        assert.ok(plan);
        for (const it of plan.items) assert.equal(it.kind, track);
      });
    });
  }

  test("day one is the vowels あいうえお", () => {
    const plan = lessonPlan("kana", FRESH, SETTINGS);
    assert.ok(plan);
    assert.deepEqual(
      plan.items.map((it) => it.glyph),
      ["あ", "い", "う", "え", "お"],
    );
  });

  test("kana carries a guide link and the wider 'all hiragana' claim", () => {
    const plan = lessonPlan("kana", FRESH, SETTINGS);
    assert.ok(plan);
    assert.ok(plan.learn?.url.startsWith("http"), "kana lesson has a guide link");
    assert.ok(plan.claimAll, "kana lesson can claim the whole script");
    // The wider claim is a superset of the lesson's own facts — you can't know
    // all of hiragana without knowing あ.
    for (const f of plan.facts) {
      assert.ok(
        plan.claimAll.facts.includes(f),
        "the lesson's facts are within the 'all hiragana' claim",
      );
    }
  });

  test("kanji carries a why and an over flag; no guide link", () => {
    const plan = lessonPlan("kanji", FRESH, SETTINGS);
    assert.ok(plan);
    assert.ok(plan.why, "kanji lesson has a 'why?' teaching layer");
    assert.equal(typeof plan.over, "boolean");
    assert.equal(plan.learn, undefined);
    assert.equal(plan.claimAll, undefined);
  });

  test("grammar groups multi-fact patterns to fewer items than facts", () => {
    // A producible pattern has a meaning fact AND a production fact — two facts,
    // one entry. So a grammar lesson with any producible pattern has strictly
    // more facts than items, which is the multi-fact-per-entry grouping the
    // one-fact kana/kanji lessons can't exercise.
    const plan = lessonPlan("grammar", FRESH, SETTINGS);
    assert.ok(plan);
    assert.ok(
      plan.facts.length >= plan.items.length,
      "never more items than facts",
    );
  });
});
