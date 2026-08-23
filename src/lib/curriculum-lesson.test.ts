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
import {
  VOCAB,
  readingUnits,
  vocabRow,
  wordMeaningFactId,
  wordTeachingMetadata,
} from "../data/vocab.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { CURRICULUM_SEQUENCE } from "./curriculum-order.ts";
import {
  CURRICULUM_TOTALS,
  curriculum,
  nextCurriculumLesson,
  packLessons,
  packUnits,
} from "./curriculum-lesson.ts";
import { adjectiveKind, ruVerbKind } from "./word-forms.ts";
import { applyClaims, applyDropSeen, applySeen } from "./history-ops.ts";
import { emptyAggregate, foldSession } from "./aggregate.ts";
import { readingsProvedBy } from "./word-unlock.ts";
import { compositePositionLabel } from "./lesson-position.ts";
import {
  LESSON_RANGE_DEFAULT,
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

/** Where each glyph FIRST sits in the packing: which lesson, and where inside
 * it. FIRST occurrence wins (SAK-162): a word taught with more than one reading
 * (七) now occupies more than one item sharing a glyph, one per reading, and
 * only the first (its primary reading, folded into its kanji item when it is a
 * single-character word) is what "is c taught before/with this glyph" ever
 * means for a prerequisite check — the kanji is taught there, not at a later
 * secondary-reading item that carries no shape role at all. */
function locate(groups: ReturnType<typeof packLessons>) {
  const at = new Map<string, { g: number; i: number }>();
  groups.forEach((group, g) =>
    group.items.forEach((it, i) => {
      if (!at.has(it.glyph)) at.set(it.glyph, { g, i });
    }),
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

describe("what a word costs is its reading-units, one item at a time (SAK-162)", () => {
  test("a word-only item always costs exactly 1: one item, one reading-unit", () => {
    // SAK-162: a word is no longer one item pricing every reading-unit it has —
    // each reading-unit is now its OWN item (curriculum-order.ts's header), so a
    // word-only item never has more than one reading-unit left to price. A word
    // read several ways (開ける) is several word-only items, one per reading,
    // each costing 1 — never one item costing 2.
    const wordOnly = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.length === 1 && it.roles[0] === "word",
    );
    assert.ok(wordOnly.length > 0);
    for (const it of wordOnly) {
      assert.equal(it.cost, 1, `${it.glyph} (reading ${it.reading}) is not priced at 1`);
      const row = vocabRow(it.glyph);
      const kana = row ? row.keb === row.reb : false;
      assert.equal(it.facts.length, kana ? 1 : 2, `${it.glyph}/${it.reading} fact count`);
    }
  });

  test("a multi-reading word's items sum to its full reading-unit count", () => {
    // The word-level total this file's OLD "one item, one price" test used to
    // check directly is still true — just spread across N items instead of
    // charged on one. Group every word-role item by glyph and confirm the sum
    // of costs for a multi-reading word equals readingUnits(row).length.
    const byGlyph = new Map<string, number>();
    for (const it of GROUPS.flatMap((g) => g.items)) {
      if (!it.roles.includes("word")) continue;
      byGlyph.set(it.glyph, (byGlyph.get(it.glyph) ?? 0) + 1);
    }
    let sawMultiReading = false;
    for (const [glyph, wordItemCount] of byGlyph) {
      const row = vocabRow(glyph);
      if (!row) continue;
      assert.equal(
        wordItemCount,
        readingUnits(row).length,
        `${glyph} has ${wordItemCount} word items but ${readingUnits(row).length} reading-units`,
      );
      if (wordItemCount > 1) sawMultiReading = true;
    }
    assert.ok(sawMultiReading, "no multi-reading word split across items in range");
  });

  test("a standalone (non-kanji-tile, non-kana) word-role item names the reading it teaches, and readings never repeat for a glyph", () => {
    // `CurriculumLessonItem.reading` (readingOf, curriculum-lesson.ts) is
    // deliberately null in two cases, both unchanged from before SAK-162: a
    // KANA word (its reading IS the printed glyph) and a word folded into its
    // KANJI tile (人: the reading is what a later word will ask for, and a card
    // that shows the answer has spent the question). For every other word-role
    // item it now names THIS item's own pronunciation, and no two items for the
    // same glyph ever name the same one.
    const readingsOf = new Map<string, Set<string>>();
    for (const it of GROUPS.flatMap((g) => g.items)) {
      if (!it.roles.includes("word")) continue;
      if (it.roles.includes("kanji")) continue;
      const row = vocabRow(it.glyph);
      const kana = row ? row.keb === row.reb : false;
      if (kana) {
        assert.equal(it.reading, null, `${it.glyph} is kana but names a reading`);
        continue;
      }
      assert.ok(it.reading !== null, `${it.glyph} carries the word role but no reading`);
      const seen = readingsOf.get(it.glyph) ?? new Set<string>();
      assert.ok(!seen.has(it.reading), `${it.glyph}/${it.reading} taught twice`);
      seen.add(it.reading);
      readingsOf.set(it.glyph, seen);
    }
  });

  test("a folded item pays for its shape AND its own one reading-unit, never every reading of its word", () => {
    // 人 is a radical, a kanji and a word in one item at its PRIMARY reading
    // (ひと), and teaching it does all three jobs at that position — but its
    // other readings (にん, じん) are separate items elsewhere, each with their
    // own cost, not folded into this one's price.
    const folded = GROUPS.flatMap((g) => g.items).filter(
      (it) => it.roles.includes("kanji") && it.roles.includes("word"),
    );
    assert.ok(folded.length > 0);
    for (const it of folded) {
      const shape = (it.roles.includes("radical") ? 1 : 0) + 1; // kanji always
      assert.equal(it.cost, shape + 1, `${it.glyph} was not charged shape + one reading`);
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
    // SAK-162: the word total is no longer one count per glyph. Every scheduled
    // word UNION the single Han characters the dictionary teaches as words on
    // their own (十, 羊 …) now contributes one item PER TAUGHT READING
    // (readingUnits), because each reading is its own curriculum item — see
    // curriculum-order.ts's header. So the denominator is the sum of every such
    // glyph's reading-unit count, not the count of glyphs itself.
    const singleCharWords = VOCAB.filter(
      (w) => [...w.keb].length === 1 && /\p{Script=Han}/u.test(w.keb),
    ).map((w) => w.keb);
    const wordGlyphs = new Set([...CURRICULUM_WORDS.map((w) => w.keb), ...singleCharWords]);
    let expectedWordItems = 0;
    for (const glyph of wordGlyphs) {
      const row = vocabRow(glyph);
      if (row) expectedWordItems += readingUnits(row).length;
    }
    assert.equal(CURRICULUM_TOTALS.word, expectedWordItems);
  });

  // The word total rose from 7,589 to 12,543 when CURRICULUM_WORDS widened to
  // essentially all of VOCAB (~12,540 words) plus the single-Han-character
  // words already folded in — see word-lesson.ts. It dropped to 12,533 when
  // PARTICLE_TRACK_KEBS pulled the 10 core particles out to the grammar track
  // (see word-lesson.ts's "WHERE THE CURRICULUM ENDS"). It dropped to 12,490
  // when SAK-163 added day-of-month and month-of-year to COUNTER_CURRICULUM:
  // word-lesson.ts's COUNTER_KANJI_GLYPHS derives from that list, so their 43
  // vocab.json duplicates (１日…３１日, １月…１２月) are now excluded from the word
  // spine the same way 二十歳/一本/… already were — not a new exclusion SAK-163
  // wrote, a pre-existing generic one that picked them up automatically. It rose
  // to 12,588 with SAK-162: the word denominator counts taught READINGS now, not
  // glyphs, and 98 words in the curriculum carry more than one teachable reading.
  test("and today those counts are 90, 2,136 and 12,588", () => {
    assert.equal(CURRICULUM_TOTALS.radical, 90);
    assert.equal(CURRICULUM_TOTALS.kanji, 2136);
    assert.equal(CURRICULUM_TOTALS.word, 12588);
  });

  test("a total does not move when the lesson length does", () => {
    for (const range of RANGES) {
      for (const g of packLessons(range)) {
        assert.equal(g.position.radical?.total ?? 90, 90);
        assert.equal(g.position.kanji?.total ?? 2136, 2136);
        assert.equal(g.position.word?.total ?? 12588, 12588);
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

// SAK-13. "Library → I already know this" lets a learner claim an item OUT OF
// the normal lesson delivery order — ahead of the frontier, or scattered across
// many future lessons with nothing claimed in between. The prior "N of M"
// attempt computed its span from whatever was left once those claims were
// filtered out, which is neither contiguous nor small once claims scatter, and
// printed nonsense like "1–639 of 2,136" over a card that had actually taught 5
// items. These tests simulate exactly that shape of claim and pin that a
// position — the WHOLE group's, per nextCurriculumLesson's own contract above —
// is unmoved by it, because packLessons/curriculum position every group ONCE,
// over the static packing, and never read history at all (see lesson-position.ts,
// "SAFE UNDER OUT-OF-ORDER CLAIMS", and advancePosition there for the primitive
// this file's `position()` is built from).
describe("out-of-order Library claims never corrupt a position (SAK-13)", () => {
  test("claiming a far-future lesson whole does not move the current frontier's position", () => {
    const before = nextCurriculumLesson(history([]), RANGE)!;
    assert.equal(before.group.index, 1);

    // Reach past the frontier and claim an ENTIRE future lesson via the
    // Library's "I already know this" — completely out of delivery order, with
    // nothing before it (besides lesson 1 itself) ever taught.
    const future = GROUPS[Math.floor(GROUPS.length / 2)];
    const after = nextCurriculumLesson(history(future.facts), RANGE)!;

    assert.equal(after.group.index, 1, "the frontier does not jump to the claimed lesson");
    assert.deepEqual(
      after.position,
      before.position,
      "an out-of-order claim elsewhere must not move the frontier lesson's own position",
    );
  });

  test("scattered out-of-order claims across many future lessons leave every lesson's position exactly as packed", () => {
    // One fact from each of several lessons spread through the curriculum —
    // non-contiguous, out of delivery order, nothing claimed in between them.
    const targets = [0.01, 0.1, 0.4, 0.75, 0.95]
      .map((frac) => Math.floor(GROUPS.length * frac))
      .filter((i) => i > 0 && i < GROUPS.length);
    const scattered = targets.flatMap((i) => GROUPS[i].facts.slice(0, 1));

    // The packing (and every group's position within it) is a pure function of
    // `range` alone — recomputing it from scratch, with no history in sight,
    // must reproduce the exact same spans the scattered claims are being
    // checked against, proving the claims never had anywhere to feed in.
    const fresh = packLessons(RANGE);
    for (const i of targets) assert.deepEqual(GROUPS[i].position, fresh[i].position, `group ${i}`);

    // And the frontier, still resting on lesson 1 (none of ITS OWN items were
    // among the scattered claims), reports lesson 1's own unmoved position —
    // not something inflated by the out-of-order material claimed ahead of it.
    const frontier = nextCurriculumLesson(history(scattered), RANGE)!;
    assert.equal(frontier.group.index, 1);
    assert.deepEqual(frontier.position, GROUPS[0].position);
  });

  test("an item claimed long before its lesson is reached still yields the WHOLE group's frozen position, not a rebuilt one", () => {
    // A multi-item lesson a few groups in, so claiming one item early leaves a
    // genuine non-empty remainder once the frontier naturally reaches it.
    const targetIndex = GROUPS.findIndex((g, i) => i > 5 && g.items.length > 1);
    assert.ok(targetIndex >= 0, "fixture needs a multi-item lesson past the first few");
    const target = GROUPS[targetIndex];

    // Claim one of the target lesson's items' facts NOW — long before the
    // frontier would naturally reach it, exactly "Library → I already know
    // this" on material far ahead of the normal delivery order — alongside
    // every EARLIER lesson's facts, walked in normally so the frontier actually
    // arrives at the target lesson rather than stopping short of it. Plus the
    // two class-word gate prerequisites (て-form, adjective-prenominal): this
    // test is about out-of-order-claim POSITION correctness, not the unrelated
    // class gate (see "a る-ending verb waits on the て-form" / "adjective words
    // wait…" above), and SAK-162 moved which lesson this dynamically-found
    // index lands on — it can now land on one holding a gated adjective
    // (すごい), which would otherwise vanish off the card for a reason this
    // test has nothing to do with.
    const earlierFacts = GROUPS.slice(0, targetIndex).flatMap((g) => g.facts);
    const outOfOrderItem = target.items[0];
    const claimedNow = [
      ...earlierFacts,
      ...outOfOrderItem.facts,
      patternMeaningFactId("te-sequence"),
      patternMeaningFactId("prenominal-form"),
    ];

    const lesson = nextCurriculumLesson(history(claimedNow), RANGE)!;
    assert.equal(lesson.group.index, target.index);
    assert.deepEqual(
      lesson.cards.map((c) => c.glyph),
      target.items.slice(1).map((c) => c.glyph),
      "the item claimed out of order is off the card; its neighbours are not",
    );
    // The position is the WHOLE group's — unaffected by which item inside it was
    // claimed early, or how long before the lesson was reached the claim happened.
    assert.deepEqual(lesson.position, target.position);
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

  // SAK-52. Before the fix, finishSession claimed a taught session's material
  // UNCONDITIONALLY (the block above modelled exactly that), and a "Quiz me"
  // run's start-time seen mark was never rolled back by anything but a discard.
  // Together those are the audit's two repros: either door left a batch that
  // was never confirmed known permanently off Learn's frontier. The fix makes
  // the claim an explicit choice and rolls the seen marks back on any OTHER
  // ending — these tests model both endings against the real scheduler.

  test("REPRO 1 — Quiz me, miss the one fact actually asked, end WITHOUT marking known: the batch is due again", () => {
    const before = nextCurriculumLesson(EMPTY, RANGE)!;
    assert.ok(before.facts.length > 1, "the fixture needs more than one fact to show the split");
    const seed = startSeed(before);
    const [tested, ...untouched] = before.facts;
    assert.ok(untouched.length > 0);

    // QUIZ ME: home-feed's startTrack marks the WHOLE batch seen the instant
    // the button is pressed, before a single question is asked.
    const afterClick = applySeen(EMPTY, seed, TS);

    // ANSWER: the drill actually asks (and here, misses) only ONE of the
    // batch's facts — real evidence, from the fold every closeRound runs, is
    // exactly what a genuine miss looks like: a real `lastTested`, independent
    // of the seen mark.
    const missed = emptyAggregate();
    foldSession(missed, { seen: 1, missed: 1 }, TS);
    const afterAnswer: HistoryFile = {
      ...afterClick,
      facts: { ...afterClick.facts, [tested]: missed },
    };
    assert.notDeepEqual(
      nextCurriculumLesson(afterAnswer, RANGE)?.facts,
      before.facts,
      "seen (plus the one real miss) already moved the frontier off the batch — the bug's starting point",
    );

    // END WITHOUT MARKING KNOWN ("take me to the lesson"): finishSession's new
    // default path rolls back exactly the seen marks the start added. Each
    // word here is its OWN scheduling unit (one word, one fact, in this
    // fixture), so the result is precise rather than all-or-nothing: the one
    // word that was genuinely tested (and missed) stays off the lesson on its
    // own real evidence — correctly; that is not this fix's to undo, and
    // isFactFresh has never treated a real answer, anywhere in the app, as
    // reversible — but every OTHER word in the batch was only ever swept into
    // `seen` by the click, never actually asked, so undoing exactly those
    // marks brings exactly them back.
    const afterFinish = applyDropSeen(afterAnswer, seed);
    assert.deepEqual(
      nextCurriculumLesson(afterFinish, RANGE)?.facts,
      untouched,
      "the untested rest of the batch is reachable from Learn again — not stranded behind the one word that was actually quizzed",
    );
  });

  test("REPRO 2 — complete the lesson normally, quiz it, end WITHOUT marking known: the frontier never moves", () => {
    const before = nextCurriculumLesson(EMPTY, RANGE)!;

    // START (teach): a normal Start never seeds a seen mark — only "Quiz me"
    // does (home-feed's startTrack: `teach ? [] : newlySeen(facts)`). The
    // lesson cards are shown, the drill is answered (here, badly — one hit,
    // the rest missed), and the round closes normally: a real session record
    // lands in `sessions` and its facts fold into `facts` regardless of score.
    const hit = emptyAggregate();
    foldSession(hit, { seen: 1, correct: 1, firstTry: 1 }, TS);
    const miss = emptyAggregate();
    foldSession(miss, { seen: 1, missed: 1 }, TS);
    const afterQuiz: HistoryFile = {
      ...EMPTY,
      facts: Object.fromEntries(
        before.facts.map((fact, i) => [fact, i === 0 ? hit : miss]),
      ) as HistoryFile["facts"],
    };

    // END WITHOUT MARKING KNOWN: old finishSession claimed `session.teach`
    // (== the whole lesson for a taught session) here, unconditionally — that
    // write is the one this fix deletes. Modelled by doing nothing further:
    // no claim, and (unlike Quiz me) nothing to roll back either, since a
    // taught session's start never seeded a seen mark to begin with.
    assert.notDeepEqual(
      nextCurriculumLesson(afterQuiz, RANGE)?.facts,
      before.facts,
      "a poor score still leaves genuine per-fact evidence, so the batch itself is off the frontier on its OWN evidence",
    );
    // The important assertion isn't that the frontier holds still — the real
    // evidence above already moves it, correctly, same as any other quiz
    // anywhere in the app. It's that NOTHING is claimed: a claim is forever
    // (effectiveState never expires a nonzero lastTested), while the evidence
    // above is exactly what was actually answered — poorly. Prove the absence
    // of a claim directly, on the one record a claim would have written.
    assert.equal(
      afterQuiz.claims?.[before.facts[0]],
      undefined,
      "finishing without marking known writes no claim on the taught material",
    );
  });

  test("mark known: choosing it claims sessionKnownClaimTarget, which advances the frontier permanently — like case 2, but on purpose", () => {
    const before = nextCurriculumLesson(EMPTY, RANGE)!;
    // The explicit choice claims the taught set via the SAME postClaim
    // "I already know this" already uses — modelled here exactly as the
    // pre-existing "completing keeps the advance" test above models it,
    // because sessionKnownClaimTarget(session) === session.teach whenever
    // teach is non-empty, and a taught session's teach is its whole facts set.
    const claimed = applyClaims(EMPTY, before.facts, TS);
    assert.notDeepEqual(
      nextCurriculumLesson(claimed, RANGE)?.facts,
      before.facts,
      "marking known advances the frontier",
    );
    assert.notEqual(
      claimed.claims?.[before.facts[0]],
      undefined,
      "and it is a real claim, not evidence — the two repros above prove neither ending writes one",
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
    assert.equal(gated.glyph, "わかる", "the first ambiguous る-ending verb changed");
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
    // Skip-and-return: the frontier moves PAST the held-back verb to the next
    // teachable material rather than stopping.
    const lesson = nextCurriculumLesson(h, RANGE);
    assert.ok(lesson, "the spine keeps teaching past the gated verb");
    assert.ok(
      !lesson.cards.some((c) => c.glyph === gated!.glyph),
      "and the held-back verb is not in the lesson it hands out",
    );
  });

  test("once the て-form is learned, the verb teaches and the lock clears", () => {
    const h = history([...reachedTheVerb(), TE_FORM]);
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
        if (
          row &&
          wordTeachingMetadata(row.keb).dominantPosFamily === "adjective" &&
          adjectiveKind(row) !== null
        ) {
          return { glyph: item.glyph, group };
        }
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
