// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/kanji-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// Kanji's lesson boundary is INVENTED — kana's was read off a data file that
// already had it, and there is no equivalent here (see kanji-lesson.ts). So the
// thing to test is not that the code does what it says; it is that the invented
// rule produces a SANE CURRICULUM over the real 2,136, and keeps doing so.
//
// That failure mode is not a crash. It is a day one of eight shapes, or a lesson
// that silently runs over the length you set, or a cost function that disagrees
// with the owner's own worked examples — each of which type-checks perfectly.
// So these tests pin the cost arithmetic to the numbers the owner verified by
// hand, then assert SIZE and BOUNDARY over the whole order.
//
// RADICALS ARE WOVEN IN NOW, so this file also owns the combined track's ONE
// hard promise: a radical-only component is taught in the SAME set as the first
// kanji that uses it, ordered before that kanji, and never in a set that kanji
// is not also in. See "the ordering invariant" below — the reason the radical
// track no longer has a test file of its own is that its one remaining rule is a
// property of THIS packer.
//
// The numbers are counted off the data, with the exceptions typed in on purpose:
// the seven cost examples (the owner verified them by hand — if they move, the
// cost function moved) and day one being 人 大 日 一 (the published head of the
// order at the default range). If either moves, every other assertion here is
// measuring against a moved ruler, and these are the lines that say so.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  KANJI_ORDER,
  PREREQUISITE_ONLY,
  kanjiRow,
  meaningFactId,
  orderRow,
} from "../data/kanji.ts";
import {
  isRadicalTaughtAsKanji,
  radicalMeaningFactId,
  radicalOfKanji,
} from "../data/radicals.ts";
import {
  clampLessonRange,
  kanjiCost,
  kanjiCurriculum,
  LESSON_RANGE_DEFAULT,
  nextKanjiLesson,
  packLessons,
  packUnits,
} from "./kanji-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const ORDER: readonly string[] = KANJI_ORDER.map((o) => o.c);
const RANGE = LESSON_RANGE_DEFAULT;
const GROUPS = kanjiCurriculum(ORDER, RANGE);
/** The groups that teach kanji — every group but the kanji-less orphan tail. The
 * spans and the "of 2,136" position are about these. */
const KANJI_GROUPS = GROUPS.filter((g) => g.spine === "kanji");

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, ...over };
}

/** Claim these facts as known — the cheap way to move history forward without
 * inventing a session. Mirrors what /api/claim writes. There is no radical gate
 * to satisfy anymore, so nothing is pre-claimed: radicals are woven into the
 * groups and ride along in their own facts. */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = Date.UTC(2026, 0, 1);
  return history({ claims: claims as HistoryFile["claims"] });
}

/** Which lesson a kanji is in, at the default range. */
function lessonOf(c: string): number {
  return GROUPS.find((g) => g.chars.includes(c))!.index;
}

/** The radical-only component a kanji must meet first, or null. A merged radical
 * IS its own kanji and is never a separate prerequisite (see radicalPrereqOf in
 * kanji-lesson.ts, which this mirrors for the tests). */
function radPrereqGlyph(c: string): string | null {
  const rad = radicalOfKanji(c);
  return rad && !isRadicalTaughtAsKanji(rad.num) ? rad.glyph : null;
}

describe("cost is draw + assembly, and it matches the owner's own numbers", () => {
  // These are verified by hand, in the coordinator's brief. They are the spec;
  // if the function disagrees with them it is wrong, not they.
  test("the owner's worked examples reproduce exactly", () => {
    const expected: Array<[string, number]> = [
      ["不", 4], // radical 一, plus ｜ノ丶 drawn from scratch
      ["乞", 3], // 一乙人 all known, nothing left over (parts over-cover, clamped)
      ["人", 2], // no parts: two strokes
      ["大", 3], // no parts: three strokes
      ["一", 1],
      ["中", 2], // radical 口, plus one stroke
      ["生", 5], // no parts: five strokes
      ["鬱", 21], // 29 strokes, indivisible — the costliest kanji there is
    ];
    for (const [c, cost] of expected) {
      assert.equal(kanjiCost(c), cost, `${c} should cost ${cost}`);
    }
  });

  test("a known radical costs 1, not its stroke count — that's the whole idea", () => {
    // 中 is 口 (3 strokes, known) + one stroke. If the radical were charged its
    // strokes it would cost 4; it costs 2, because a shape you know is one thing
    // to place.
    assert.equal(kanjiCost("中"), 2);
    assert.notEqual(kanjiCost("中"), kanjiRow("中")!.strokes);
  });

  test("a stranger costs nothing rather than crashing", () => {
    assert.equal(kanjiCost("〇"), 0);
  });
});

describe("the range is made safe, and max can never fall below min", () => {
  test("a backwards range is pinned, not honoured", () => {
    assert.deepEqual(clampLessonRange(12, 6), { min: 12, max: 12 });
    assert.deepEqual(clampLessonRange(6, 3), { min: 6, max: 6 });
  });

  test("values are whole and at least 1", () => {
    assert.deepEqual(clampLessonRange(0, 0), { min: 1, max: 1 });
    assert.deepEqual(clampLessonRange(6.4, 12.6), { min: 6, max: 13 });
  });

  test("garbage degrades to the default rather than to a blank screen", () => {
    assert.deepEqual(clampLessonRange(NaN, NaN), {
      min: LESSON_RANGE_DEFAULT.min,
      max: LESSON_RANGE_DEFAULT.max,
    });
  });

  test("a good range is left exactly as it is", () => {
    assert.deepEqual(clampLessonRange(6, 12), { min: 6, max: 12 });
  });
});

describe("day one", () => {
  test("is 人 大 日 一 — cheap, and no radical pre-cards", () => {
    const lesson = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(lesson);
    assert.deepEqual(
      lesson.cards.map((c) => c.glyph),
      ["人", "大", "日", "一"],
    );
    // Every day-one kanji is its own radical's first consumer, so it is taught as
    // a kanji (labelled "also radical N"), never as a separate radical tile: day
    // one is kanji, not a wall of radical meanings.
    for (const card of lesson.cards) assert.equal(card.kind, "kanji");
    // 2 + 3 + 4 + 1 = 10, inside [6,12]. Gentle for the right reason: no
    // readings anywhere in this number.
    assert.equal(lesson.cost, 10);
    assert.equal(lesson.group.index, 1);
    assert.equal(lesson.over, false);
    assert.equal(lesson.spine, "kanji");
  });
});

describe("only a wordless part rides with its consumer, not a worded kanji", () => {
  // The owner saw "kanji 5 of 2,136" — 不, negative — taught alone, with 乙 乞 気
  // as the next lesson, and asked why 不 wasn't packed with them. The cause was a
  // bundling bug: 乙 (1 everyday word) and 乞 (2) entered the order via prereq for
  // 気, and `bundles` welded every prereq into its consumer's bundle regardless
  // of whether it carried its own words. That built ONE indivisible unit 乙 乞 气
  // 気 of cost 12 (exactly max), which forced 不 into a lesson by itself. Only the
  // genuinely wordless parts, and radical-only shapes, must ride along; a worded
  // kanji anchors its own bundle.
  test("乙 and 乞 are their own units; only 气 stays woven into 気", () => {
    const units = packUnits(ORDER);
    // Units 4-7 are now the four the owner expected, not one glued block.
    assert.deepEqual(
      units.slice(4, 8).map((u) => ({
        items: u.items.map((it) => `${it.kind}:${it.glyph}`),
        cost: u.cost,
      })),
      [
        { items: ["kanji:不"], cost: 4 },
        { items: ["kanji:乙"], cost: 1 },
        { items: ["kanji:乞"], cost: 3 },
        // 气 is a radical-only shape (not its own kanji), so it alone must stay
        // in the same unit as, and before, its first-using kanji 気.
        { items: ["radical:气", "kanji:気"], cost: 8 },
      ],
    );
  });

  test("不 now packs with 乙 乞 into a filled lesson, not alone", () => {
    // Greedy fill: lesson 1 fills to 10 (人 大 日 一); 不 (4) would overflow it, so
    // 不 opens lesson 2 and pulls 乙 (1) and 乞 (3) in for a cost of 8, inside
    // [6,12]. The 气 気 unit (8) would overflow (8 + 8 = 16), so it starts lesson
    // 3. 不 is no longer stranded below min.
    const l1 = GROUPS[0];
    const l2 = GROUPS[1];
    assert.deepEqual(l1.chars, ["人", "大", "日", "一"]);
    assert.equal(l1.cost, 10);
    assert.deepEqual(l2.chars, ["不", "乙", "乞"]);
    assert.equal(l2.cost, 8);
    assert.ok(l2.cost >= RANGE.min && l2.cost <= RANGE.max);
    // The kanji spine still counts 不 乙 乞 as positions 5-7.
    assert.equal(l2.from, 5);
    assert.equal(l2.to, 7);
    assert.equal(l2.over, false);
  });

  test("气 rides in the same lesson as 気, and before it — the hard invariant", () => {
    const group = GROUPS.find((g) => g.chars.includes("気"))!;
    const glyphs = group.items.map((it) => `${it.kind}:${it.glyph}`);
    const radAt = glyphs.indexOf("radical:气");
    const kanjiAt = glyphs.indexOf("kanji:気");
    assert.ok(radAt >= 0, "气 is not in 気's lesson");
    assert.ok(radAt < kanjiAt, "气 must come before 気");
  });
});

describe("the curriculum is sane end to end, not just at the start", () => {
  test("every kanji in the order is in exactly one lesson, in order", () => {
    assert.deepEqual(
      GROUPS.flatMap((g) => g.chars),
      ORDER,
    );
  });

  test("the only lessons over max are single indivisible units", () => {
    // Every over-max lesson is flagged, and flagged only for that reason.
    for (const g of GROUPS) assert.equal(g.over, g.cost > RANGE.max);
    // And an over-max lesson is always ONE unit — a kanji bundle with its woven
    // radicals, too big to split — never a lesson the packer let grow past max.
    const counts = unitsPerGroup(GROUPS, packUnits(ORDER));
    GROUPS.forEach((g, i) => {
      if (g.over) assert.equal(counts[i], 1, `over lesson ${g.index} is >1 unit`);
    });
  });

  test("a lesson only ends below min when forced", () => {
    // Greedy-to-max gives the min guarantee for free: a sub-min lesson exists
    // only because the next unit wouldn't fit, or the material ran out. So a
    // sub-min lesson must be immediately followed by a unit that would have taken
    // it over max — or be the very last lesson.
    const firstUnitCost = firstUnitCostPerGroup(GROUPS, packUnits(ORDER));
    for (let i = 0; i < GROUPS.length; i++) {
      const g = GROUPS[i];
      if (g.cost >= RANGE.min) continue;
      const next = GROUPS[i + 1];
      assert.ok(
        !next || g.cost + firstUnitCost[i + 1] > RANGE.max,
        `lesson ${g.index} is under min for no reason`,
      );
    }
  });
});

describe("a unit is the atom, and it is never split", () => {
  test("kanji are contiguous runs, so bundling cannot reorder", () => {
    const at = new Map(ORDER.map((c, i) => [c, i]));
    for (const g of KANJI_GROUPS) {
      const seats = g.chars.map((c) => at.get(c)!);
      assert.deepEqual(
        seats,
        seats.map((_, i) => seats[0] + i),
        `lesson ${g.index} is not a run of the order`,
      );
    }
  });

  test("packing loses no unit and reorders none", () => {
    // The lessons' items, concatenated, ARE the units' items concatenated — same
    // members, same order. A group is always a whole number of units (the helper
    // asserts it), which is what "never split a unit" means.
    const units = packUnits(ORDER);
    assert.deepEqual(
      GROUPS.flatMap((g) => g.items.map((it) => `${it.kind}:${it.glyph}`)),
      units.flatMap((u) => u.items.map((it) => `${it.kind}:${it.glyph}`)),
    );
  });

  test("a unit bigger than max is its own lesson, never dropped", () => {
    // 鬱 alone is 21 > 12. It must be a lesson, not skipped for not fitting. A
    // one-kanji order teaches no orphan tail (its other radicals' kanji aren't
    // present), so this is exactly one lesson.
    const solo = packLessons(["鬱"], RANGE);
    assert.equal(solo.length, 1);
    assert.deepEqual(solo[0].chars, ["鬱"]);
    assert.equal(solo[0].over, true);
  });
});

describe("a wordless part never leaves the kanji that justifies it", () => {
  test("not one of them is split from its consumer", () => {
    // The payoff of bundling, NOT a rule in the source: a part is in its
    // consumer's bundle by construction. Over the derived set, which has already
    // moved once (9 → 6) — this follows the data, it does not hard-code it.
    assert.ok(PREREQUISITE_ONLY.length > 0);
    for (const c of PREREQUISITE_ONLY) {
      const consumer = orderRow(c)?.pulledFor;
      assert.ok(consumer, `${c} is a part for nothing`);
      assert.equal(lessonOf(c), lessonOf(consumer), `${c} is split from ${consumer}`);
    }
  });

  test("the card says what a part is for, and names it", () => {
    const consumer = orderRow("又")?.pulledFor;
    assert.ok(consumer);
    const lesson = nextKanjiLesson(claiming(lessonsBefore("又")), ORDER, RANGE);
    assert.ok(lesson);
    const mata = lesson.cards.find((c) => c.glyph === "又");
    assert.ok(mata, "又 is not in its own lesson");
    assert.equal(mata.kind, "kanji");
    assert.equal(mata.neededFor, consumer);
    // The thing it names is on the same card, which is what lets the copy point
    // at it rather than promise a payoff in some later sitting.
    assert.ok(lesson.cards.some((c) => c.glyph === consumer));
  });

  test("a part with no reading is a card with a meaning, not a broken one", () => {
    for (const c of PREREQUISITE_ONLY) {
      assert.ok(kanjiRow(c)?.meanings[0], `${c} has no meaning to render`);
    }
  });

  test("KANJIDIC2's radical metadata never reaches the card", () => {
    const junk = /radical \(no\. \d+\)/;
    for (const c of ORDER) {
      const first = kanjiRow(c)?.meanings[0];
      assert.ok(first && !junk.test(first), `${c} leads with radical metadata`);
    }
  });
});

// THE ORDERING INVARIANT — the one hard promise of the combined track.
// ====================================================================
// A radical-only component is introduced in the SAME set as the first kanji that
// uses it, ordered before that kanji, and never in a set that kanji is not also
// in. These are the lines that prove it, over the real curriculum at several
// lesson lengths (a tighter max splits harder and is where a stranded radical
// would show).
describe("the ordering invariant: a radical rides in with its first-using kanji", () => {
  const RANGES = [RANGE, { min: 3, max: 6 }, { min: 1, max: 2 }];

  for (const r of RANGES) {
    describe(`at range {min:${r.min}, max:${r.max}}`, () => {
      const groups = kanjiCurriculum(ORDER, r);
      // Where each item sits: group index and position within the group.
      const loc = new Map<string, { g: number; i: number }>();
      groups.forEach((g, gi) =>
        g.items.forEach((it, ii) => loc.set(`${it.kind}:${it.glyph}`, { g: gi, i: ii })),
      );
      // Each non-merged radical's FIRST consumer: the earliest kanji in the order
      // filed under it.
      const firstConsumer = new Map<string, string>();
      for (const c of ORDER) {
        const g = radPrereqGlyph(c);
        if (g && !firstConsumer.has(g)) firstConsumer.set(g, c);
      }

      test("no radical is ever taught after a kanji that uses it", () => {
        for (const c of ORDER) {
          const rg = radPrereqGlyph(c);
          if (!rg) continue;
          const radLoc = loc.get(`radical:${rg}`);
          const kanjiLoc = loc.get(`kanji:${c}`)!;
          assert.ok(radLoc, `radical ${rg} (needed by ${c}) was never taught`);
          // Earlier set, or same set but an earlier tile — never later.
          assert.ok(
            radLoc.g < kanjiLoc.g || (radLoc.g === kanjiLoc.g && radLoc.i < kanjiLoc.i),
            `radical ${rg} is taught after ${c}, which uses it`,
          );
        }
      });

      test("a radical is in the SAME set as its first-using kanji, before it", () => {
        // The coordinator's explicit ask: never strand a radical in a set that
        // lacks the kanji that first uses it. 气 does not go into a set unless 気
        // is in that same set.
        for (const [rg, consumer] of firstConsumer) {
          const radLoc = loc.get(`radical:${rg}`)!;
          const consumerLoc = loc.get(`kanji:${consumer}`)!;
          assert.equal(
            radLoc.g,
            consumerLoc.g,
            `radical ${rg} is in a different set from its first user ${consumer}`,
          );
          assert.ok(
            radLoc.i < consumerLoc.i,
            `radical ${rg} is not ordered before its first user ${consumer}`,
          );
        }
      });

      test("every radical-only shape is taught exactly once", () => {
        const counts = new Map<string, number>();
        for (const g of groups)
          for (const it of g.items)
            if (it.kind === "radical")
              counts.set(it.glyph, (counts.get(it.glyph) ?? 0) + 1);
        for (const [glyph, n] of counts)
          assert.equal(n, 1, `radical ${glyph} taught ${n} times`);
      });

      test("group facts are in teach order: a radical's fact precedes its kanji's", () => {
        // The teach walk steps facts in order, so a radical's meaning fact must
        // come before the fact of any kanji in the same group that uses it.
        for (const g of groups) {
          const factPos = new Map<FactId, number>();
          g.facts.forEach((f, i) => factPos.set(f, i));
          for (const it of g.items) {
            if (it.kind !== "kanji") continue;
            const rg = radPrereqGlyph(it.glyph);
            if (!rg) continue;
            const radFact = radicalMeaningFactId(rg);
            if (!factPos.has(radFact)) continue; // taught in an earlier set
            assert.ok(
              factPos.get(radFact)! < factPos.get(meaningFactId(it.glyph))!,
              `radical ${rg}'s fact is after ${it.glyph}'s in its group`,
            );
          }
        }
      });
    });
  }
});

describe("the combined card shows radicals, labelled, before their kanji", () => {
  test("the first set that needs a radical teaches it as a radical tile", () => {
    // The first group that carries a radical tile. Claim everything before it,
    // so nextKanjiLesson hands exactly that set back — the surfacing path the card
    // takes. The radical must be a radical-kind item, and its first-using kanji
    // must be on the same card, after it.
    const targetIndex = GROUPS.findIndex((g) =>
      g.items.some((it) => it.kind === "radical"),
    );
    assert.ok(targetIndex > 0, "some set weaves in a radical");
    const before = GROUPS.slice(0, targetIndex).flatMap((g) => g.facts);
    const lesson = nextKanjiLesson(claiming(before), ORDER, RANGE);
    assert.ok(lesson);
    const rad = lesson.cards.find((c) => c.kind === "radical");
    assert.ok(rad, "the surfaced set carries the woven radical");
    const consumer = ORDER.find((c) => radPrereqGlyph(c) === rad.glyph)!;
    const radIdx = lesson.cards.findIndex((c) => c.kind === "radical" && c.glyph === rad.glyph);
    const kanjiIdx = lesson.cards.findIndex((c) => c.kind === "kanji" && c.glyph === consumer);
    assert.ok(kanjiIdx >= 0, `${consumer} (uses ${rad.glyph}) is not on the same card`);
    assert.ok(radIdx < kanjiIdx, `${rad.glyph} is not before ${consumer} on the card`);
    assert.ok(rad.meaning.length > 0, "a radical tile has a meaning to show");
  });
});

describe("the lesson length is a setting, and the packing follows it", () => {
  test("a tighter max makes more, smaller lessons", () => {
    const tight = kanjiCurriculum(ORDER, { min: 3, max: 6 });
    assert.ok(tight.length > GROUPS.length);
    for (const g of tight) assert.equal(g.over, g.cost > 6);
  });

  test("鬱 warns at any max below 21, and is never silently oversized", () => {
    const lesson = nextKanjiLesson(claiming(lessonsBefore("鬱")), ORDER, {
      min: 6,
      max: 8,
    });
    assert.ok(lesson);
    assert.ok(lesson.cards.some((c) => c.glyph === "鬱"));
    assert.equal(lesson.over, true);
    assert.ok(lesson.cost > 8);
  });
});

// The card says "kanji 5–8 of 2,136" and not "lesson 1 of 1068", and the span
// is only meaningful if it lines up exactly with the order it indexes into. The
// radicals woven in are NOT counted here: the kanji are the numbered spine, the
// radicals are building blocks shown alongside.
describe("the position counts KANJI, and the spans tile the order exactly", () => {
  test("the spans are contiguous, 1-based, and end at the order's length", () => {
    assert.equal(KANJI_GROUPS[0].from, 1);
    assert.equal(KANJI_GROUPS[KANJI_GROUPS.length - 1].to, ORDER.length);
    for (let i = 0; i < KANJI_GROUPS.length; i++) {
      const g = KANJI_GROUPS[i];
      assert.equal(g.to - g.from + 1, g.chars.length, `lesson ${g.index} span`);
      if (i > 0)
        assert.equal(g.from, KANJI_GROUPS[i - 1].to + 1, `gap before ${g.index}`);
    }
  });

  test("a span names the lesson's own kanji, not its neighbours'", () => {
    for (const g of KANJI_GROUPS) {
      assert.deepEqual(ORDER.slice(g.from - 1, g.to), g.chars, `lesson ${g.index}`);
    }
  });

  test("day one is kanji 1–4 of 2,136 — an item count, not a lesson count", () => {
    const lesson = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(lesson);
    assert.deepEqual(lesson.position, { from: 1, to: 4, total: 2136 });
  });

  test("the total is the material and does not move when lesson length does", () => {
    const tight = kanjiCurriculum(ORDER, { min: 3, max: 6 });
    const tightKanji = tight.filter((g) => g.spine === "kanji");
    assert.notEqual(tight.length, GROUPS.length);
    assert.equal(tightKanji[tightKanji.length - 1].to, ORDER.length);
    assert.equal(
      nextKanjiLesson(history(), ORDER, { min: 3, max: 6 })!.position.total,
      nextKanjiLesson(history(), ORDER, RANGE)!.position.total,
    );
  });
});

// Orphan radicals — the ones no kanji uses — have no first-using kanji to ride in
// with, so they are taught after the whole order, for completeness. This is the
// one place a set is all radicals.
describe("orphan radicals are taught at the very end, for completeness", () => {
  test("the tail is kanji-less radical sets, after every kanji", () => {
    const tail = GROUPS.filter((g) => g.spine === "radical");
    assert.ok(tail.length > 0, "there is an orphan tail");
    // Every orphan-tail set comes after every kanji set.
    const lastKanji = GROUPS.findIndex(
      (g) => g === KANJI_GROUPS[KANJI_GROUPS.length - 1],
    );
    for (const g of tail) {
      assert.ok(GROUPS.indexOf(g) > lastKanji, "an orphan set precedes a kanji set");
      assert.equal(g.chars.length, 0);
      for (const it of g.items) assert.equal(it.kind, "radical");
    }
  });

  test("an orphan set's position counts radicals with no invented total", () => {
    // Claim the whole kanji spine, so the next lesson is the orphan tail. Its
    // header must not print a stale 'of 98' or a kanji count — it counts radicals
    // and promises no denominator.
    const spine = KANJI_GROUPS.flatMap((g) => g.facts);
    const lesson = nextKanjiLesson(claiming(spine), ORDER, RANGE);
    assert.ok(lesson, "the orphan tail is a real lesson");
    assert.equal(lesson.spine, "radical");
    assert.equal(lesson.position.total, null);
    for (const c of lesson.cards) assert.equal(c.kind, "radical");
  });
});

describe("the next lesson is a function of history, and there is no cursor", () => {
  test("claiming day one advances to lesson 2", () => {
    const first = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(first);
    const second = nextKanjiLesson(claiming(first.facts), ORDER, RANGE);
    assert.ok(second);
    assert.equal(second.group.index, 2);
  });

  test("a half-claimed lesson yields its other half, not the whole thing again", () => {
    const first = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(first);
    // Claim every fact but the last card's — day one is all kanji, so the last
    // card's fact is its meaning fact.
    const keptBack = first.cards[first.cards.length - 1];
    const keptFact = keptBack.fact;
    const claimedFacts = first.facts.filter((f) => f !== keptFact);
    const rest = nextKanjiLesson(claiming(claimedFacts), ORDER, RANGE);
    assert.ok(rest);
    assert.equal(rest.group.index, 1);
    assert.deepEqual(
      rest.cards.map((c) => c.glyph),
      [keptBack.glyph],
    );
  });

  test("claiming the lot is null — done is a real state, not an empty lesson", () => {
    const all = GROUPS.flatMap((g) => g.facts);
    assert.equal(nextKanjiLesson(claiming(all), ORDER, RANGE), null);
  });
});

/** Split the packed groups back into their units: how many units each group is,
 * asserting every group is a WHOLE number of units (the packer never splits one).
 * The oracle for the over/min tests, computed independently of the packing. */
function unitsPerGroup(
  groups: readonly { items: readonly unknown[] }[],
  units: readonly { items: readonly unknown[] }[],
): number[] {
  let ui = 0;
  return groups.map((g) => {
    let consumed = 0;
    let count = 0;
    while (consumed < g.items.length) {
      consumed += units[ui].items.length;
      ui++;
      count++;
    }
    assert.equal(consumed, g.items.length, "a group is not a whole number of units");
    return count;
  });
}

/** The cost of each group's FIRST unit — what the next unit would add if it led
 * a lesson. Used to prove the min floor: a sub-min lesson is only ever followed
 * by a unit too big to have joined it. */
function firstUnitCostPerGroup(
  groups: readonly { items: readonly unknown[] }[],
  units: readonly { items: readonly unknown[]; cost: number }[],
): number[] {
  let ui = 0;
  return groups.map((g) => {
    const first = units[ui].cost;
    let consumed = 0;
    while (consumed < g.items.length) {
      consumed += units[ui].items.length;
      ui++;
    }
    return first;
  });
}

/** Every fact in the lessons before `c`'s — the cheap way to stand at a given
 * lesson without inventing a history for each one. */
function lessonsBefore(c: string): FactId[] {
  return GROUPS.filter((g) => g.index < lessonOf(c)).flatMap((g) => g.facts);
}
