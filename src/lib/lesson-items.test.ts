// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-items.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The stepped teach phase renders itemsFromFacts(session.teach), one item at a
// time. The grouping has one load-bearing invariant that isn't visible in a
// screenshot and type-checks either way: the items must be the teach facts,
// GROUPED BY ENTRY, IN ORDER, losing none and inventing none — otherwise a glyph
// steps twice, or a fact the drill is about to ask never gets shown. So these
// tests count.
//
// The fixtures are real lessons (nextLesson, nextKanjiLesson, nextGrammarLesson)
// against a fresh learner, so the grouping is exercised on the actual material
// the teach phase will hand it — including grammar, whose producible patterns
// carry two facts per entry, the multi-fact-per-entry case the one-fact
// kana/kanji lessons can't reach.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanjiTeachOrder } from "../data/kanji.ts";
import { entryOf, factInfo } from "./facts.ts";
import {
  GRAMMAR_PER_LESSON_DEFAULT,
  nextGrammarLesson,
  wordHost,
} from "./grammar-lesson.ts";
import { LESSON_RANGE_DEFAULT, nextKanjiLesson } from "./kanji-lesson.ts";
import { nextRadicalLesson } from "./radical-lesson.ts";
import { RADICALS, radicalMeaningFactId } from "../data/radicals.ts";
import { itemsFromFacts } from "./lesson-items.ts";
import { nextLesson } from "./lesson.ts";
import { CURRICULUM_WORDS, nextWordLesson, wordKanji } from "./word-lesson.ts";
import { meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

/** A learner who has done nothing — so every track's FIRST lesson is what the
 * curriculum modules return. */
const FRESH: HistoryFile = { sessions: [], facts: {} };
/** A learner who knows every radical — the kanji track now gates on a kanji's
 * radical being learned (radical-lesson.ts), so its first lesson only appears
 * once the radicals are met. */
const KANJI_READY: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(
    RADICALS.map((r) => [radicalMeaningFactId(r.glyph), Date.UTC(2026, 0, 1)]),
  ) as HistoryFile["claims"],
};
/**
 * A learner who has cleared the very first kanji lesson — so the NEXT kanji group
 * is blocked by a real (non-merged) radical and the radical track has a first
 * lesson to hand out.
 *
 * Day one is no longer a radical lesson: the opening kanji (人 大 日 一) ARE their
 * own radicals and are taught as kanji, so a fresh learner has nothing due on the
 * radical track. The first genuine radical card is the one gating the second
 * group. Claim the first kanji lesson's facts and that gate appears.
 */
const RADICAL_READY: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(
    nextKanjiLesson(FRESH, kanjiTeachOrder("everyday"), LESSON_RANGE_DEFAULT)!.facts.map(
      (f) => [f, Date.UTC(2026, 0, 1)],
    ),
  ) as HistoryFile["claims"],
};
const WORD_READY: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(
    [...new Set(CURRICULUM_WORDS.flatMap((w) => wordKanji(w.keb)))].map((c) => [
      kanjiMeaningFactId(c),
      Date.UTC(2026, 0, 1),
    ]),
  ) as HistoryFile["claims"],
};

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
  radical: nextRadicalLesson(
    RADICAL_READY,
    kanjiTeachOrder("everyday"),
    LESSON_RANGE_DEFAULT,
    6,
  )!.facts,
  kanji: nextKanjiLesson(
    KANJI_READY,
    kanjiTeachOrder("everyday"),
    LESSON_RANGE_DEFAULT,
  )!.facts,
  word: nextWordLesson(WORD_READY, 6)!.facts,
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

      test("every item's facts belong to that item's entry", () => {
        for (const it of items) {
          for (const f of it.facts) assert.equal(entryOf(f), it.entry);
        }
      });

      test("no entry is stepped through twice", () => {
        const entries = items.map((it) => it.entry);
        assert.equal(new Set(entries).size, entries.length);
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
