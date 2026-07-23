// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/curriculum-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The packer turns a 7,000-item line into a few thousand lessons, and every way
// it can go wrong type-checks. A radical stranded a lesson ahead of the kanji it
// belongs to, a word handed over before the kanji it is written with, an item
// dropped or taught twice, a lesson that quietly runs over the length you set, a
// label whose "of 2,136" is a number nobody counted: all of those are a
// well-typed array of well-typed groups.
//
// THEY PIN INVARIANTS, NOT GLYPHS
// ===============================
// Deliberately nothing here says "lesson 1 is 人 大 日 一" or "item 47 is 気".
// The sequence CONTENTS are still moving, because the prerequisite source is
// changing under this file, while the RULES are not. A test that named a glyph
// would fail on the day the data improved, and would say nothing about whether
// the packing was still correct. So every assertion is a property: welds hold,
// prerequisites lead, costs stay in range, the label counts what is on the card,
// and the denominators are the counts the data itself gives.
//
// The three totals ARE asserted as exact numbers, because they are properties of
// the shipped tables and not of the ordering: 90 radical-only shapes, 2,136
// jōyō kanji, 6,213 curriculum words. A change to any of them is a change to the
// curriculum and should have to be looked at.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI, kanjiRow, meaningFactId } from "../data/kanji.ts";
import { RADICALS } from "../data/radicals.ts";
import { VOCAB, wordMeaningFactId } from "../data/vocab.ts";
import { CURRICULUM_SEQUENCE } from "./curriculum-order.ts";
import {
  CURRICULUM_TOTALS,
  WORD_COST,
  curriculum,
  nextCurriculumLesson,
  packLessons,
  packUnits,
} from "./curriculum-lesson.ts";
import { compositePositionLabel } from "./lesson-position.ts";
import {
  LESSON_RANGE_DEFAULT,
  WORDS_PER_LESSON_DEFAULT,
  type LessonRange,
} from "./lesson-sizing.ts";
import { CURRICULUM_WORDS, wordTeachable } from "./word-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const RANGE = LESSON_RANGE_DEFAULT;
const GROUPS = curriculum(RANGE);

/** The lesson lengths the invariants are checked at. A tight max splits harder
 * and is where a stranded weld would show; a max of 1 forces every unit into a
 * lesson of its own, which is the worst case the weld has to survive. */
const RANGES: readonly LessonRange[] = [RANGE, { min: 3, max: 6 }, { min: 1, max: 1 }];

/** Where each glyph sits in the packing: which lesson, and where inside it. */
function locate(groups: ReturnType<typeof packLessons>) {
  const at = new Map<string, { g: number; i: number }>();
  groups.forEach((group, g) =>
    group.items.forEach((it, i) => at.set(it.glyph, { g, i })),
  );
  return at;
}

function history(claims: readonly FactId[]): HistoryFile {
  const rec: Record<string, number> = {};
  for (const f of claims) rec[f] = Date.UTC(2026, 0, 1);
  return { sessions: [], facts: {}, claims: rec as HistoryFile["claims"] };
}

describe("the packing loses nothing and reorders nothing", () => {
  test("the lessons, concatenated, ARE the sequence", () => {
    assert.deepEqual(
      GROUPS.flatMap((g) => g.items.map((it) => it.glyph)),
      CURRICULUM_SEQUENCE.map((it) => it.glyph),
    );
  });

  test("a lesson is a whole number of units, and units are never split", () => {
    const units = packUnits();
    assert.deepEqual(
      GROUPS.flatMap((g) => g.items.map((it) => it.glyph)),
      units.flatMap((u) => u.items.map((it) => it.glyph)),
    );
    let ui = 0;
    for (const g of GROUPS) {
      let consumed = 0;
      while (consumed < g.items.length) consumed += units[ui++].items.length;
      assert.equal(consumed, g.items.length, `lesson ${g.index} splits a unit`);
    }
    assert.equal(ui, units.length, "the packing dropped units off the end");
  });

  test("every fact is taught exactly once, and a lesson's facts are its items'", () => {
    const seen = new Set<FactId>();
    for (const g of GROUPS) {
      assert.deepEqual(g.facts, g.items.flatMap((it) => it.facts));
      for (const f of g.facts) {
        assert.ok(!seen.has(f), `${f} is taught twice`);
        seen.add(f);
      }
    }
    // And nothing the curriculum owes is missing: every kanji meaning and every
    // curriculum word meaning is in some lesson.
    for (const k of KANJI) assert.ok(seen.has(meaningFactId(k.c)), `${k.c} untaught`);
    for (const w of CURRICULUM_WORDS) {
      assert.ok(seen.has(wordMeaningFactId(w.keb)), `${w.keb} untaught`);
    }
  });
});

// THE HARD INVARIANT. A radical-only shape welded to a kanji must land in the
// SAME lesson, ahead of it. It is the one promise the sequence makes to the
// packer, and the only rule the packer is not free to trade against cost.
describe("the weld holds at every lesson length", () => {
  for (const range of RANGES) {
    describe(`at range {min:${range.min}, max:${range.max}}`, () => {
      const groups = packLessons(range);
      const at = locate(groups);

      test("a tied item is in its kanji's lesson, and before it", () => {
        let tied = 0;
        for (const item of CURRICULUM_SEQUENCE) {
          if (item.tiedTo === null) continue;
          tied++;
          const here = at.get(item.glyph)!;
          const target = at.get(item.tiedTo);
          assert.ok(target, `${item.glyph} is tied to untaught ${item.tiedTo}`);
          assert.equal(
            here.g,
            target.g,
            `${item.glyph} is a lesson away from ${item.tiedTo}`,
          );
          assert.ok(
            here.i < target.i,
            `${item.glyph} comes after ${item.tiedTo} in their lesson`,
          );
        }
        assert.ok(tied > 0, "nothing is welded, so this proves nothing");
      });

      test("a kanji is never welded, so the packer keeps its freedom", () => {
        // The other half of the sequence's rule: a kanji prerequisite is ordered
        // earlier and nothing more, and may sit any number of lessons back.
        for (const item of CURRICULUM_SEQUENCE) {
          if (kanjiRow(item.glyph) === undefined) continue;
          assert.equal(item.tiedTo, null, `kanji ${item.glyph} is welded`);
        }
      });
    });
  }
});

describe("prerequisites lead, at every lesson length", () => {
  for (const range of RANGES) {
    describe(`at range {min:${range.min}, max:${range.max}}`, () => {
      const groups = packLessons(range);
      const at = locate(groups);

      /** Is `a` taught before `b`? Earlier lesson, or the same lesson and an
       * earlier tile. */
      const before = (a: string, b: string): boolean => {
        const x = at.get(a)!;
        const y = at.get(b)!;
        return x.g < y.g || (x.g === y.g && x.i < y.i);
      };

      test("every kanji of a word is taught before the word", () => {
        for (const w of CURRICULUM_WORDS) {
          for (const c of w.keb) {
            if (kanjiRow(c) === undefined) continue;
            if (c === w.keb) continue; // the fold: one item wearing both roles
            assert.ok(before(c, w.keb), `${c} is taught after ${w.keb}`);
          }
        }
      });

      test("walking the lessons in order, every word is teachable when it arrives", () => {
        // The gate word-lesson.ts used to run as a filter, checked as a property
        // of the ORDER instead. Claim each lesson as it is taught and ask
        // `wordTeachable` of every word the moment its lesson opens: the answer
        // must always be yes, without the scheduler ever having looked.
        const claims: Record<string, number> = {};
        const learner: HistoryFile = {
          sessions: [],
          facts: {},
          claims: claims as HistoryFile["claims"],
        };
        const rowOf = new Map(VOCAB.map((w) => [w.keb, w]));
        for (const g of groups) {
          for (const it of g.items) {
            // Learned as this tile is taught, so a kanji earlier in the lesson
            // counts for a word later in the same lesson. Claimed BEFORE the
            // check because of the fold: a single-kanji word is one item wearing
            // both roles, and teaching it is what makes its own kanji known.
            for (const f of it.facts) claims[f] = Date.UTC(2026, 0, 1);
            if (!it.roles.includes("word")) continue;
            assert.ok(
              wordTeachable(rowOf.get(it.glyph)!, learner),
              `${it.glyph} arrives before its kanji`,
            );
          }
        }
      });
    });
  }
});

describe("the lesson length is a setting, and the packing honours it", () => {
  for (const range of RANGES) {
    describe(`at range {min:${range.min}, max:${range.max}}`, () => {
      const groups = packLessons(range);
      const units = packUnits();

      test("only a single unit ever exceeds max, and it is flagged", () => {
        let ui = 0;
        for (const g of groups) {
          assert.equal(g.over, g.cost > range.max, `lesson ${g.index} over flag`);
          let consumed = 0;
          let count = 0;
          while (consumed < g.items.length) {
            consumed += units[ui++].items.length;
            count++;
          }
          if (g.over) assert.equal(count, 1, `lesson ${g.index} grew past max`);
        }
      });

      test("a lesson ends below min only when the next unit would not fit", () => {
        // The min guarantee falls out of greedy-to-max, so this is what it means:
        // a sub-min lesson is either the last one, or is followed by a unit that
        // could not have joined it.
        let ui = 0;
        const firstUnitCost: number[] = [];
        for (const g of groups) {
          firstUnitCost.push(units[ui].cost);
          let consumed = 0;
          while (consumed < g.items.length) consumed += units[ui++].items.length;
        }
        groups.forEach((g, i) => {
          if (g.cost >= range.min) return;
          const next = groups[i + 1];
          assert.ok(
            !next || g.cost + firstUnitCost[i + 1] > range.max,
            `lesson ${g.index} is under min for no reason`,
          );
        });
      });
    });
  }

  test("a tighter max makes more, smaller lessons", () => {
    assert.ok(packLessons({ min: 3, max: 6 }).length > GROUPS.length);
  });
});

describe("what a word costs is the two budgets reconciled", () => {
  test("WORD_COST is the cost budget divided by the words budget", () => {
    // Not a third number to keep in step: 12 cost per sitting over 6 words per
    // sitting is 2. See the module header.
    assert.equal(
      WORD_COST,
      Math.round(LESSON_RANGE_DEFAULT.max / WORDS_PER_LESSON_DEFAULT),
    );
    assert.ok(WORD_COST >= 1);
  });

  test("a word is priced flat, whatever it is written with", () => {
    // A word is not a drawn shape: its kanji were taught earlier in this same
    // sequence, so there is nothing left to learn to draw. Every word-only item
    // costs the same, however many kanji its written form has.
    const wordOnly = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.length === 1 && it.roles[0] === "word",
    );
    assert.ok(wordOnly.length > 0);
    for (const it of wordOnly) assert.equal(it.cost, WORD_COST, it.glyph);
  });

  test("a folded item pays for its shape AND its word", () => {
    // 山 is a radical, a kanji and a word in one item, and teaching it is both
    // jobs: three facts go into the drill, so the cost is the drawing plus the
    // word, never one of the two.
    const folded = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.includes("kanji") && it.roles.includes("word"),
    );
    assert.ok(folded.length > 0);
    for (const it of folded) {
      assert.ok(it.cost > WORD_COST, `${it.glyph} was not charged for its shape`);
      assert.ok(it.facts.length >= 2, `${it.glyph} teaches only one fact`);
    }
  });
});

describe("the totals are counted off the data, never typed in", () => {
  test("they are the shipped tables' own counts", () => {
    const radicalOnly = RADICALS.filter((r) => kanjiRow(r.glyph) === undefined);
    assert.equal(CURRICULUM_TOTALS.radical, radicalOnly.length);
    assert.equal(CURRICULUM_TOTALS.kanji, KANJI.length);
    assert.equal(CURRICULUM_TOTALS.word, CURRICULUM_WORDS.length);
  });

  test("and today those counts are 90, 2,136 and 6,213", () => {
    assert.equal(CURRICULUM_TOTALS.radical, 90);
    assert.equal(CURRICULUM_TOTALS.kanji, 2136);
    assert.equal(CURRICULUM_TOTALS.word, 6213);
  });

  test("a total does not move when the lesson length does", () => {
    for (const range of RANGES) {
      for (const g of packLessons(range)) {
        assert.equal(g.position.radical?.total ?? 90, 90);
        assert.equal(g.position.kanji?.total ?? 2136, 2136);
        assert.equal(g.position.word?.total ?? 6213, 6213);
      }
    }
  });
});

describe("the composite position counts what is on the card", () => {
  test("a segment is present exactly when the lesson teaches that kind", () => {
    for (const g of GROUPS) {
      const radicals = g.items.filter(
        (it) => it.roles.includes("radical") && !it.roles.includes("kanji"),
      );
      const kanji = g.items.filter((it) => it.roles.includes("kanji"));
      const words = g.items.filter((it) => it.roles.includes("word"));
      assert.equal(g.position.radical !== null, radicals.length > 0, `${g.index} rad`);
      assert.equal(g.position.kanji !== null, kanji.length > 0, `${g.index} kanji`);
      assert.equal(g.position.word !== null, words.length > 0, `${g.index} word`);
      // And the span is as wide as the count it names.
      const width = (p: { from: number; to: number } | null) =>
        p === null ? 0 : p.to - p.from + 1;
      assert.equal(width(g.position.radical), radicals.length, `${g.index} rad span`);
      assert.equal(width(g.position.kanji), kanji.length, `${g.index} kanji span`);
      assert.equal(width(g.position.word), words.length, `${g.index} word span`);
    }
  });

  test("the spans tile each role's own count, contiguously and from 1", () => {
    const seen = { radical: 0, kanji: 0, word: 0 };
    for (const g of GROUPS) {
      for (const role of ["radical", "kanji", "word"] as const) {
        const span = g.position[role];
        if (span === null) continue;
        assert.equal(span.from, seen[role] + 1, `${role} gap before ${g.index}`);
        seen[role] = span.to;
      }
    }
    assert.deepEqual(seen, {
      radical: CURRICULUM_TOTALS.radical,
      kanji: CURRICULUM_TOTALS.kanji,
      word: CURRICULUM_TOTALS.word,
    });
  });

  test("the label prints one segment per kind, in radical, kanji, word order", () => {
    for (const g of GROUPS.slice(0, 200)) {
      const label = compositePositionLabel(g.position);
      const parts = label.split(" · ");
      const expected = (["Radical", "Kanji", "Word"] as const).filter(
        (_, i) => [g.position.radical, g.position.kanji, g.position.word][i] !== null,
      );
      assert.deepEqual(
        parts.map((p) => p.split(" ")[0]),
        [...expected],
        `lesson ${g.index}: ${label}`,
      );
    }
  });

  test("every lesson has something to say", () => {
    for (const g of GROUPS) {
      assert.ok(compositePositionLabel(g.position).length > 0, `lesson ${g.index}`);
    }
  });
});

describe("the next lesson is a function of history, and there is no cursor", () => {
  test("an empty history opens on the first lesson", () => {
    const first = nextCurriculumLesson(history([]), RANGE);
    assert.ok(first);
    assert.equal(first.group.index, 1);
    assert.deepEqual(first.cards, first.group.items);
    assert.equal(first.cost, first.group.cost);
  });

  test("claiming a lesson advances to the next one", () => {
    const first = nextCurriculumLesson(history([]), RANGE)!;
    const second = nextCurriculumLesson(history(first.facts), RANGE);
    assert.ok(second);
    assert.equal(second.group.index, 2);
  });

  test("a half-claimed lesson yields its remainder, not the whole thing again", () => {
    const first = nextCurriculumLesson(history([]), RANGE)!;
    const keptBack = first.cards[first.cards.length - 1];
    const claimed = first.facts.filter((f) => !keptBack.facts.includes(f));
    const rest = nextCurriculumLesson(history(claimed), RANGE);
    assert.ok(rest);
    assert.equal(rest.group.index, 1);
    assert.deepEqual(
      rest.cards.map((c) => c.glyph),
      [keptBack.glyph],
    );
    // The POSITION is still the whole group's: a claim takes items out of the
    // middle of a run, and a span rebuilt from what is left would name material
    // that is not on the card.
    assert.deepEqual(rest.position, first.group.position);
  });

  test("claiming everything is null: done is a real state, not an empty lesson", () => {
    const all = GROUPS.flatMap((g) => g.facts);
    assert.equal(nextCurriculumLesson(history(all), RANGE), null);
  });

  test("the same history and range always name the same lesson", () => {
    const h = history(GROUPS[0].facts);
    assert.deepEqual(
      nextCurriculumLesson(h, RANGE)!.facts,
      nextCurriculumLesson(h, RANGE)!.facts,
    );
  });
});
