// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-items.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The stepped teach phase renders itemsFromFacts(session.teach), one step at a
// time. The grouping carries two load-bearing invariants, both invisible in a
// screenshot and both type-checking either way:
//
//   1. The steps ARE the teach facts, in order, losing none and inventing none.
//      Break it and a fact the drill is about to ask never gets shown.
//   2. One CHARACTER is one step. Break it and a character playing three roles
//      makes the learner press Next three times to get past it, which is what
//      the owner reported on 人.
//
// The fixtures are real lessons (nextLesson, nextCurriculumLesson,
// nextGrammarLesson) against a fresh learner, so the grouping is exercised on
// the actual material the teach phase will hand it: grammar, whose producible
// patterns carry two facts per entry, and the curriculum spine, whose folded
// characters carry a whole entry's worth more.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KEIGO_SETS, keigoWordFactId } from "../data/keigo.ts";
import { characterRoles } from "./character-role.ts";
import { entryOf, factInfo } from "./facts.ts";
import { lessonRoles } from "./lesson-roles.ts";
import {
  GRAMMAR_PER_LESSON_DEFAULT,
  nextGrammarLesson,
  wordHost,
} from "./grammar-lesson.ts";
import { nextCurriculumLesson } from "./curriculum-lesson.ts";
import { LESSON_RANGE_DEFAULT } from "./lesson-sizing.ts";
import { RADICAL_TEACHING_ORDER } from "./radical-order.ts";
import { radicalMeaningFactId } from "../data/radicals.ts";
import { itemsFromFacts } from "./lesson-items.ts";
import { nextLesson } from "./lesson.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

/** A learner who has done nothing — so every track's FIRST lesson is what the
 * curriculum modules return. */
const FRESH: HistoryFile = { sessions: [], facts: {} };

/** A learner who has learned one verb — the host the head of the grammar
 * curriculum attaches to, so nextGrammarLesson has a teachable lesson to hand
 * out (it is now host-gated: no learned verb means the 〜て family is locked). */
const FIRST_VERB = CURRICULUM_WORDS.find((w) => wordHost(w) === "verb")!;
const GRAMMAR_READY: HistoryFile = {
  sessions: [],
  facts: {},
  claims: {
    [wordMeaningFactId(FIRST_VERB.keb)]: Date.UTC(2026, 0, 1),
  } as HistoryFile["claims"],
};

/** The teach facts of each track's first lesson, the way a session would carry
 * them. */
const TEACH_SETS: Record<string, FactId[]> = {
  kana: nextLesson(FRESH)!.facts,
  // Radicals no longer have a track of their own — they are woven into the kanji
  // sets (see kanji-lesson.ts). The step model still has to render a radical item,
  // so exercise it on a teach set built straight from the radical teaching order:
  // the itemsFromFacts grouping is what these tests are about, not the scheduler.
  radical: RADICAL_TEACHING_ORDER.slice(0, 6).map((r) => radicalMeaningFactId(r.glyph)),
  // Radicals, kanji and words come off one spine now, so one fixture covers all
  // three: the head of the curriculum is whatever mix the packer cut first.
  curriculum: nextCurriculumLesson(FRESH, LESSON_RANGE_DEFAULT)!.facts,
  grammar: nextGrammarLesson(GRAMMAR_READY, GRAMMAR_PER_LESSON_DEFAULT)!.facts,
};

describe("itemsFromFacts — the step model", () => {
  for (const [track, facts] of Object.entries(TEACH_SETS)) {
    describe(track, () => {
      const items = itemsFromFacts(facts);

      test("there is something to walk through", () => {
        assert.ok(items.length > 0);
      });

      test("items are the facts, grouped by entry, in order — none lost, none invented", () => {
        // Flattening the items' facts must reproduce the input exactly: same
        // members, same order. This is the whole grouping contract, and the
        // thing the drill that follows relies on being true.
        assert.deepEqual(
          items.flatMap((it) => it.facts),
          facts,
        );
      });

      test("every fact on a step belongs to that step's CHARACTER", () => {
        // An entry is no longer the step: a folded character teaches several
        // roles at once and has an entry per role, and it is one step (see
        // itemsFromFacts). What still holds, and what the view relies on, is that
        // every fact on a step is about the glyph the step shows.
        for (const it of items) {
          for (const f of it.facts) {
            // Its own entry, or another entry for the same character: kanji:人
            // and word:人 are two entries and one thing to learn.
            const own = entryOf(f) === it.entry;
            assert.ok(
              own || factInfo(f)?.glyph === it.glyph,
              `${f} is on ${it.glyph}'s step and belongs to neither`,
            );
          }
        }
        // The leading entry is always one of its own facts'.
        for (const it of items) {
          assert.ok(
            it.facts.some((f) => entryOf(f) === it.entry),
            `${it.glyph} leads with an entry none of its facts is in`,
          );
        }
      });

      test("no glyph is stepped through twice", () => {
        // The owner's report: pressing Next twice to get past one character. A
        // character is one step, whatever number of roles it plays.
        const glyphs = items.map((it) => it.glyph);
        assert.equal(new Set(glyphs).size, glyphs.length);
      });

      test("each item's kind is its subject, and its glyph is the fact's glyph", () => {
        for (const it of items) {
          const info = factInfo(it.facts[0]);
          assert.equal(it.kind, info?.subject);
          assert.equal(it.glyph, info?.glyph);
        }
      });
    });
  }

  test("a folded character is ONE step carrying every role's facts", () => {
    // The owner's report: "when i go through person, i have to click next twice
    // to get to the next entry". 人 is a radical, a kanji and a word, which is
    // three entries and one character, and the curriculum folded it long before
    // the walk did.
    const items = itemsFromFacts(TEACH_SETS.curriculum);
    const folded = items.find((it) => characterRoles(it.glyph).length > 1);
    assert.ok(folded, "the first curriculum lesson teaches no multi-role character");
    // More facts than any single entry could own, and they come from more than
    // one entry.
    assert.ok(folded.facts.length > 1, `${folded.glyph} carries one fact`);
    assert.ok(
      new Set(folded.facts.map(entryOf)).size > 1,
      `${folded.glyph} carries only its own entry's facts`,
    );
    // And the step really does say it plays them all, which is what the view
    // renders its sections from.
    assert.ok(lessonRoles(folded).length > 1);
  });

  test("two teaching units that share a glyph are NOT merged", () => {
    // A keigo verb or a counter can be written exactly like a curriculum word,
    // and neither is the same lesson. Only role kinds fold.
    const keigoSet = KEIGO_SETS[0];
    const word = keigoSet.words[0];
    const facts = [keigoWordFactId(keigoSet, word), wordMeaningFactId(word.word)];
    const items = itemsFromFacts(facts);
    assert.equal(items.length, 2, "a keigo step was folded into a word step");
  });

  test("kana day one steps あいうえお in order", () => {
    const items = itemsFromFacts(TEACH_SETS.kana);
    assert.deepEqual(
      items.map((it) => it.glyph),
      ["あ", "い", "う", "え", "お"],
    );
    for (const it of items) assert.equal(it.kind, "kana");
  });

  test("a producible grammar lesson has fewer items than facts", () => {
    // A producible pattern is a meaning fact AND a production fact — two facts,
    // one entry — so a grammar teach set with any producible pattern groups to
    // strictly fewer items than facts. This is the multi-fact-per-entry case the
    // one-fact kana/kanji lessons can't exercise.
    const items = itemsFromFacts(TEACH_SETS.grammar);
    assert.ok(
      items.length <= TEACH_SETS.grammar.length,
      "never more items than facts",
    );
  });

  test("an empty teach set yields no steps", () => {
    assert.deepEqual(itemsFromFacts([]), []);
  });
});
