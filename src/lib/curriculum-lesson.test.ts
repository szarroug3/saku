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
import { RADICALS, radicalMeaningFactId } from "../data/radicals.ts";
import { VOCAB, readingUnits, vocabRow, wordMeaningFactId } from "../data/vocab.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { CURRICULUM_SEQUENCE } from "./curriculum-order.ts";
import {
  CURRICULUM_TOTALS,
  WORD_COST,
  curriculum,
  nextCurriculumLesson,
  nextCurriculumLock,
  packLessons,
  packUnits,
} from "./curriculum-lesson.ts";
import { adjectiveKind, ruVerbKind } from "./word-forms.ts";
import { applyClaims, applyDropSeen, applySeen } from "./history-ops.ts";
import { readingsProvedBy } from "./word-unlock.ts";
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

describe("what a word costs is its reading-units, summed across its roles", () => {
  test("WORD_COST is the cost budget divided by the words budget", () => {
    // Not what a word costs any more (see below) and not a third number to keep
    // in step either: it is only the two sitting-length budgets reconciled, 12
    // cost per sitting over 6 words per sitting is 2. Kept so the settings math
    // that reads both budgets has one name for their ratio. See the module header.
    assert.equal(
      WORD_COST,
      Math.round(LESSON_RANGE_DEFAULT.max / WORDS_PER_LESSON_DEFAULT),
    );
    assert.ok(WORD_COST >= 1);
  });

  test("a word-only item costs one per reading-unit, not a flat price", () => {
    // A word is not a drawn shape: its kanji were taught earlier in this same
    // sequence, so there is nothing left to learn to draw. What is left to learn
    // is its readings, one skill per reading-unit, so that is what it costs.
    // Usually one (先生 reads one way), but a word read several ways costs one
    // per reading (開ける costs 2), and the price tracks the row, not a constant.
    const wordOnly = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.length === 1 && it.roles[0] === "word",
    );
    assert.ok(wordOnly.length > 0);
    for (const it of wordOnly) {
      assert.equal(it.cost, readingUnits(vocabRow(it.glyph)!).length, it.glyph);
    }
    // The price is genuinely per-reading, not "1 dressed up": both a
    // single-reading word (cost 1) and a multi-reading one (cost > 1) are in range.
    assert.ok(wordOnly.some((it) => it.cost === 1), "no single-reading word-only item");
    assert.ok(wordOnly.some((it) => it.cost > 1), "no multi-reading word-only item");
  });

  test("a folded item pays for its shape AND every reading-unit of its word", () => {
    // 人 is a radical, a kanji and a three-reading word in one item, and teaching
    // it does all three jobs, so it costs one for each shape role it wears plus
    // one per reading-unit — never just the shape, never just the word.
    const folded = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.includes("kanji") && it.roles.includes("word"),
    );
    assert.ok(folded.length > 0);
    for (const it of folded) {
      const shape = (it.roles.includes("radical") ? 1 : 0) + 1; // kanji always
      assert.equal(
        it.cost,
        shape + readingUnits(vocabRow(it.glyph)!).length,
        `${it.glyph} was not charged for its shape and every reading`,
      );
      assert.ok(it.facts.length >= 2, `${it.glyph} teaches only one fact`);
    }
    // And the rad+kanji+word fold really occurs, so the "+ radical" arm above is
    // exercised and not dead.
    assert.ok(
      folded.some((it) => it.roles.includes("radical")),
      "no radical+kanji+word fold in range",
    );
  });

  test("a folded radical+kanji keeps the radical meaning fact", () => {
    const folded = GROUPS.flatMap((g) => g.items).find(
      (it) => it.roles.includes("radical") && it.roles.includes("kanji"),
    );
    assert.ok(folded);
    assert.ok(
      folded.facts.includes(radicalMeaningFactId(folded.glyph)),
      `${folded.glyph} is missing its radical meaning fact`,
    );
  });
});

describe("the totals are counted off the data, never typed in", () => {
  test("they are the shipped tables' own counts", () => {
    const radicalOnly = RADICALS.filter((r) => kanjiRow(r.glyph) === undefined);
    assert.equal(CURRICULUM_TOTALS.radical, radicalOnly.length);
    assert.equal(CURRICULUM_TOTALS.kanji, KANJI.length);
    assert.equal(CURRICULUM_TOTALS.word, CURRICULUM_WORDS.length);
  });

  test("and today those counts are 90, 2,136 and 6,187", () => {
    assert.equal(CURRICULUM_TOTALS.radical, 90);
    assert.equal(CURRICULUM_TOTALS.kanji, 2136);
    assert.equal(CURRICULUM_TOTALS.word, 6187);
  });

  test("a total does not move when the lesson length does", () => {
    for (const range of RANGES) {
      for (const g of packLessons(range)) {
        assert.equal(g.position.radical?.total ?? 90, 90);
        assert.equal(g.position.kanji?.total ?? 2136, 2136);
        assert.equal(g.position.word?.total ?? 6187, 6187);
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

// Bug 26: starting a lesson marks its facts (and the readings its words prove)
// seen, which advances the frontier BEFORE the drill. A discard scored nothing,
// so it must un-see exactly what the start added and leave the frontier where it
// was; completing keeps the advance. The app writes seen via applySeen and rolls
// it back via applyDropSeen (see home-feed startCurriculumLesson and quiz-session
// discardRun), so the invariant is a property of those two ops over the frontier.
describe("start-then-discard does not advance the frontier; start-then-complete does", () => {
  const EMPTY: HistoryFile = { sessions: [], facts: {} };
  const TS = Date.UTC(2026, 6, 24);

  // What the start marks seen: the lesson's own facts plus the readings its words
  // prove — exactly home-feed's `[...facts, ...readingsProvedBy(kebs)]`.
  function startSeed(lesson: NonNullable<ReturnType<typeof nextCurriculumLesson>>): FactId[] {
    const words = lesson.cards.filter((c) => c.roles.includes("word")).map((c) => c.glyph);
    return [...lesson.facts, ...readingsProvedBy(words)];
  }

  test("start advances the frontier, and discard restores it exactly", () => {
    const before = nextCurriculumLesson(EMPTY, RANGE)!;
    assert.ok(before, "there is a first lesson");

    // START: mark the lesson's facts (and proved readings) seen.
    const seed = startSeed(before);
    const started = applySeen(EMPTY, seed, TS);
    const advanced = nextCurriculumLesson(started, RANGE)!;
    assert.notDeepEqual(
      advanced.facts,
      before.facts,
      "starting moved the frontier off the lesson it just showed",
    );

    // DISCARD: un-see exactly what the start added.
    const discarded = applyDropSeen(started, seed);
    assert.deepEqual(
      nextCurriculumLesson(discarded, RANGE)!.facts,
      before.facts,
      "discard leaves the frontier where it was before starting",
    );
  });

  test("completing keeps the advance, even against the same un-see a discard runs", () => {
    const before = nextCurriculumLesson(EMPTY, RANGE)!;
    const seed = startSeed(before);
    const started = applySeen(EMPTY, seed, TS);

    // COMPLETE: finishSession claims the taught facts (and its rounds commit
    // them). Model the durable half as a claim on the lesson's facts.
    const completed = applyClaims(started, before.facts, TS);
    assert.notDeepEqual(
      nextCurriculumLesson(completed, RANGE)!.facts,
      before.facts,
      "completing advances the frontier",
    );

    // The claim, not the start's seen mark, now holds the frontier — so even
    // rolling the seen back (which a completed session never does) cannot pull a
    // completed lesson back onto the card.
    const completedThenUnseen = applyDropSeen(completed, seed);
    assert.notDeepEqual(
      nextCurriculumLesson(completedThenUnseen, RANGE)!.facts,
      before.facts,
      "a completed lesson stays advanced regardless of its seen marks",
    );
  });
});

// THE CROSS-TRACK GATE. A る-ending verb's class (godan vs ichidan) cannot be
// read off its spelling, so the words track holds the first one back until the
// て-form (grammar lesson 1) is learned and the word lesson can name the class.
// Grammar itself never waits on Words; this dependency points only from a class
// lesson to the word whose class it makes understandable. Pinned as properties of the data (the
// first gated verb is found, never typed) so it survives the sequence changing.
describe("a る-ending verb waits on the て-form", () => {
  const TE_FORM = patternMeaningFactId("te-sequence");

  /** The first る-ending verb the curriculum teaches, and the lesson it lands in
   * — discovered from the packing, so no glyph is hard-coded. */
  const gated = (() => {
    for (const g of GROUPS) {
      for (const it of g.items) {
        if (!it.roles.includes("word")) continue;
        const row = vocabRow(it.glyph);
        if (row && ruVerbKind(row) !== null) return { glyph: it.glyph, group: g };
      }
    }
    return null;
  })();

  test("the curriculum teaches one, and its written form ends in る", () => {
    assert.ok(gated, "no る-ending verb in the curriculum — the gate guards nothing");
    assert.equal(gated.glyph, "知る", "the first ambiguous る-ending verb changed");
    assert.ok(gated.glyph.endsWith("る"), `${gated.glyph} does not end in る`);
  });

  /** A learner who has been taught everything in the gated verb's lesson EXCEPT
   * the verb itself — the exact moment the spine would next teach it. */
  function reachedTheVerb(): FactId[] {
    const out: FactId[] = [];
    for (const g of GROUPS) {
      for (const it of g.items) {
        if (it.glyph === gated!.glyph) continue; // leave the verb unmet
        out.push(...it.facts);
      }
      if (g === gated!.group) break;
    }
    return out;
  }

  test("with the て-form unlearned, the spine skips the verb and teaches on rather than locking", () => {
    const h = history(reachedTheVerb()); // te-form fact absent → fresh
    // Skip-and-return: never a lock, and the frontier moves PAST the held-back
    // verb to the next teachable material rather than stopping.
    assert.equal(nextCurriculumLock(h, RANGE), null, "skip-and-return never locks");
    const lesson = nextCurriculumLesson(h, RANGE);
    assert.ok(lesson, "the spine keeps teaching past the gated verb");
    assert.ok(
      !lesson.cards.some((c) => c.glyph === gated!.glyph),
      "and the held-back verb is not in the lesson it hands out",
    );
  });

  test("once the て-form is learned, the verb teaches and the lock clears", () => {
    const h = history([...reachedTheVerb(), TE_FORM]);
    assert.equal(nextCurriculumLock(h, RANGE), null, "nothing gates any more");
    const lesson = nextCurriculumLesson(h, RANGE);
    assert.ok(lesson, "the verb's lesson is teachable");
    assert.ok(
      lesson.cards.some((c) => c.glyph === gated!.glyph),
      "and the held-back verb is now in it",
    );
  });

  test("the verb's own lesson still teaches its other items; only the verb waits", () => {
    // Reach the verb's lesson with nothing in it claimed yet, て-form fresh.
    const out: FactId[] = [];
    for (const g of GROUPS) {
      if (g === gated!.group) break;
      out.push(...g.facts);
    }
    const h = history(out);
    const lesson = nextCurriculumLesson(h, RANGE);
    assert.ok(lesson, "the lesson teaches");
    assert.equal(lesson.group.index, gated!.group.index, "it is the verb's own lesson");
    assert.ok(
      !lesson.cards.some((c) => c.glyph === gated!.glyph),
      "with the る-verb held back",
    );
    assert.ok(lesson.cards.length > 0, "but the rest of the lesson is taught");
    assert.equal(
      nextCurriculumLock(h, RANGE),
      null,
      "and no lock shows while other items are still teachable",
    );
  });

  test("later る-verbs are not gated once the て-form is learned", () => {
    // The gate is on the て-form, not on each verb: learning it opens every
    // remaining る-verb at once. Find the SECOND gated-shape verb and confirm it
    // teaches straight through with the て-form learned.
    const ruVerbs: string[] = [];
    for (const g of GROUPS) {
      for (const it of g.items) {
        if (!it.roles.includes("word")) continue;
        const row = vocabRow(it.glyph);
        if (row && ruVerbKind(row) !== null) ruVerbs.push(it.glyph);
      }
      if (ruVerbs.length >= 2) break;
    }
    if (ruVerbs.length < 2) return; // only one in range; nothing more to prove
    const second = ruVerbs[1];
    // Claim everything up to the second such verb, plus the て-form, and confirm
    // it is teachable (never held back).
    const out: FactId[] = [TE_FORM];
    outer: for (const g of GROUPS) {
      for (const it of g.items) {
        if (it.glyph === second) break outer;
        out.push(...it.facts);
      }
    }
    const h = history(out);
    assert.equal(nextCurriculumLock(h, RANGE), null, "no lock past the て-form");
    const lesson = nextCurriculumLesson(h, RANGE);
    assert.ok(lesson);
    assert.ok(
      lesson.cards.some((c) => c.glyph === second),
      `${second} teaches without being held back`,
    );
  });
});

describe("adjective words wait on the adjective-class introduction", () => {
  const PRENOMINAL_FORM = patternMeaningFactId("prenominal-form");
  const gated = (() => {
    for (const group of GROUPS) {
      for (const item of group.items) {
        if (!item.roles.includes("word")) continue;
        const row = vocabRow(item.glyph);
        if (row && adjectiveKind(row) !== null) return { glyph: item.glyph, group };
      }
    }
    return null;
  })();

  function reachedTheAdjective(): FactId[] {
    assert.ok(gated);
    const out: FactId[] = [];
    for (const group of GROUPS) {
      for (const item of group.items) {
        if (item.glyph !== gated.glyph) out.push(...item.facts);
      }
      if (group === gated.group) break;
    }
    return out;
  }

  test("the shipped curriculum contains an adjective for the gate to protect", () => {
    assert.ok(gated, "no adjective word occurs in the curriculum");
  });

  test("the adjective is skipped before lesson 1 and restored after it", () => {
    assert.ok(gated);
    const before = nextCurriculumLesson(history(reachedTheAdjective()), RANGE);
    assert.ok(before, "the spine should keep teaching past the held adjective");
    assert.ok(!before.cards.some((card) => card.glyph === gated.glyph));

    const after = nextCurriculumLesson(
      history([...reachedTheAdjective(), PRENOMINAL_FORM]),
      RANGE,
    );
    assert.ok(after, "the adjective should become teachable after lesson 1");
    assert.ok(after.cards.some((card) => card.glyph === gated.glyph));
  });
});
