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
// The numbers are counted off the data, with the exceptions typed in on purpose:
// the seven cost examples (the owner verified them by hand — if they move, the
// cost function moved) and day one being 人 大 日 一 (the published head of the
// order at the default range). If either moves, every other assertion here is
// measuring against a moved ruler, and these are the lines that say so.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_ORDER, PREREQUISITE_ONLY, kanjiRow, orderRow } from "../data/kanji.ts";
import {
  clampLessonRange,
  kanjiCost,
  kanjiCurriculum,
  LESSON_RANGE_DEFAULT,
  nextKanjiLesson,
  packLessons,
} from "./kanji-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const ORDER: readonly string[] = KANJI_ORDER.map((o) => o.c);
const RANGE = LESSON_RANGE_DEFAULT;
const GROUPS = kanjiCurriculum(ORDER, RANGE);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** Claim these facts as known — the cheap way to move history forward without
 * inventing a session. Mirrors what /api/claim writes. */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = Date.UTC(2026, 0, 1);
  return history({ claims: claims as HistoryFile["claims"] });
}

/** Which lesson a kanji is in, at the default range. */
function lessonOf(c: string): number {
  return GROUPS.find((g) => g.chars.includes(c))!.index;
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
  test("is 人 大 日 一 — cheap because they're built from little", () => {
    const lesson = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(lesson);
    assert.deepEqual(
      lesson.cards.map((c) => c.c),
      ["人", "大", "日", "一"],
    );
    // 2 + 3 + 4 + 1 = 10, inside [6,12]. Gentle for the right reason: no
    // readings anywhere in this number.
    assert.equal(lesson.cost, 10);
    assert.equal(lesson.group.index, 1);
    assert.equal(lesson.over, false);
  });
});

describe("the curriculum is sane end to end, not just at the start", () => {
  const costs = GROUPS.map((g) => g.cost);

  test("every kanji in the order is in exactly one lesson, in order", () => {
    assert.deepEqual(
      GROUPS.flatMap((g) => g.chars),
      ORDER,
    );
  });

  test("the only lessons over max are single indivisible bundles", () => {
    const over = GROUPS.filter((g) => g.cost > RANGE.max);
    // Every over-max lesson is flagged, and flagged only for that reason.
    for (const g of GROUPS) assert.equal(g.over, g.cost > RANGE.max);
    // 鬱 (21) is the worst, and it is one kanji. Named so a packing change that
    // quietly lets a normal lesson run to 21 has to come through this line.
    assert.equal(Math.max(...costs), 21);
    assert.ok(over.some((g) => g.chars.length === 1 && g.chars[0] === "鬱"));
  });

  test("a lesson only ends below min when forced", () => {
    // Greedy-to-max gives the min guarantee for free: a sub-min lesson exists
    // only because the next bundle wouldn't fit, or the material ran out. So a
    // sub-min lesson must be immediately followed by a bundle that would have
    // taken it over max — or be the very last lesson.
    for (let i = 0; i < GROUPS.length; i++) {
      const g = GROUPS[i];
      if (g.cost >= RANGE.min) continue;
      const next = GROUPS[i + 1];
      assert.ok(
        !next || g.cost + firstBundleCost(next) > RANGE.max,
        `lesson ${g.index} is under min for no reason`,
      );
    }
  });
});

describe("a bundle is the atom, and it is never split", () => {
  test("bundles are contiguous runs, so bundling cannot reorder", () => {
    const at = new Map(ORDER.map((c, i) => [c, i]));
    for (const g of GROUPS) {
      const seats = g.chars.map((c) => at.get(c)!);
      assert.deepEqual(
        seats,
        seats.map((_, i) => seats[0] + i),
        `lesson ${g.index} is not a run of the order`,
      );
    }
  });

  test("nothing is left over: every kanji is in exactly one lesson", () => {
    const seen = new Set(GROUPS.flatMap((g) => g.chars));
    assert.equal(seen.size, ORDER.length);
  });

  test("a bundle bigger than max is its own lesson, never dropped", () => {
    // 鬱 alone is 21 > 12. It must be a lesson, not skipped for not fitting.
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

  test("a consumer that needs two parts keeps both", () => {
    // 取 needs 又 (and 耳): all in one lesson.
    const l = GROUPS[lessonOf("又") - 1];
    assert.ok(l.chars.includes("又"));
    assert.ok(l.chars.includes("取"));
  });

  test("the card says what a part is for, and names it", () => {
    const consumer = orderRow("又")?.pulledFor;
    assert.ok(consumer);
    const lesson = nextKanjiLesson(claiming(lessonsBefore("又")), ORDER, RANGE);
    assert.ok(lesson);
    const mata = lesson.cards.find((c) => c.c === "又");
    assert.ok(mata, "又 is not in its own lesson");
    assert.equal(mata.neededFor, consumer);
    // The thing it names is on the same card, which is what lets the copy point
    // at it rather than promise a payoff in some later sitting.
    assert.ok(lesson.cards.some((c) => c.c === consumer));
  });

  test("a part with no reading is a card with a meaning, not a broken one", () => {
    // Every wordless part has a meaning to render. If one ever doesn't, the card
    // is a bare glyph, and this is the line that says so.
    for (const c of PREREQUISITE_ONLY) {
      assert.ok(kanjiRow(c)?.meanings[0], `${c} has no meaning to render`);
    }
  });

  test("KANJIDIC2's radical metadata never reaches the card", () => {
    // 18 kanji carry a "fishhook radical (no. 5)" style gloss in `meanings` —
    // catalogue metadata, not a definition. It is never FIRST, which is the only
    // reason the card is safe: it shows meanings[0]. Asserted over the whole
    // subject, because the day it stops being true the card prints a catalogue
    // number as a meaning.
    const junk = /radical \(no\. \d+\)/;
    for (const c of ORDER) {
      const first = kanjiRow(c)?.meanings[0];
      assert.ok(first && !junk.test(first), `${c} leads with radical metadata`);
    }
  });
});

describe("the lesson length is a setting, and the packing follows it", () => {
  test("a tighter max makes more, smaller lessons", () => {
    const tight = kanjiCurriculum(ORDER, { min: 3, max: 6 });
    assert.ok(tight.length > GROUPS.length);
    // Nothing over 6 except an indivisible bundle, and those are flagged.
    for (const g of tight) assert.equal(g.over, g.cost > 6);
  });

  test("鬱 warns at any max below 21, and is never silently oversized", () => {
    const lesson = nextKanjiLesson(claiming(lessonsBefore("鬱")), ORDER, {
      min: 6,
      max: 8,
    });
    assert.ok(lesson);
    assert.ok(lesson.cards.some((c) => c.c === "鬱"));
    assert.equal(lesson.over, true);
    assert.ok(lesson.cost > 8);
  });
});

// The card says "kanji 5–8 of 2,136" and not "lesson 1 of 1068", and the span
// is only meaningful if it lines up exactly with the order it indexes into.
// These are the assertions that keep it honest: a span that drifted by one, or
// that described a lesson's neighbours, would still type-check and would still
// render a plausible-looking number.
describe("the position counts KANJI, and the spans tile the order exactly", () => {
  test("the spans are contiguous, 1-based, and end at the order's length", () => {
    assert.equal(GROUPS[0].from, 1);
    assert.equal(GROUPS[GROUPS.length - 1].to, ORDER.length);
    for (let i = 0; i < GROUPS.length; i++) {
      const g = GROUPS[i];
      // The span is exactly as wide as the lesson is — this is what makes it a
      // count of kanji rather than of anything else.
      assert.equal(g.to - g.from + 1, g.chars.length, `lesson ${g.index} span`);
      if (i > 0) assert.equal(g.from, GROUPS[i - 1].to + 1, `gap before ${g.index}`);
    }
  });

  test("a span names the lesson's own kanji, not its neighbours'", () => {
    // The span is computed by counting, and the order is indexed separately.
    // If bundling ever reordered (the one thing the packer may not do), these
    // two ways of naming the same kanji would stop agreeing.
    for (const g of GROUPS) {
      assert.deepEqual(ORDER.slice(g.from - 1, g.to), g.chars, `lesson ${g.index}`);
    }
  });

  test("day one is kanji 1–4 of 2,136 — an item count, not a lesson count", () => {
    const lesson = nextKanjiLesson(history(), ORDER, RANGE);
    assert.ok(lesson);
    assert.deepEqual(lesson.position, { from: 1, to: 4, total: 2136 });
  });

  test("the total is the material and does not move when lesson length does", () => {
    // The whole point. 1068 lessons at max 12 and 1793 at max 6 are both true
    // and neither is sayable; 2,136 kanji is true under either.
    const tight = kanjiCurriculum(ORDER, { min: 3, max: 6 });
    assert.notEqual(tight.length, GROUPS.length);
    assert.equal(tight[tight.length - 1].to, GROUPS[GROUPS.length - 1].to);
    assert.equal(
      nextKanjiLesson(history(), ORDER, { min: 3, max: 6 })!.position.total,
      nextKanjiLesson(history(), ORDER, RANGE)!.position.total,
    );
  });

  test("2,136 covers the radicals too — the track has no radical pre-cards", () => {
    // PREREQUISITE_ONLY kanji (又, for 取) are pulled forward to serve a later
    // kanji, and they are ordinary jōyō kanji inside the order rather than an
    // extra class of card. So the denominator has nothing to add for them, and
    // no separate radical count is owed.
    assert.ok(PREREQUISITE_ONLY.length > 0);
    for (const c of PREREQUISITE_ONLY) assert.ok(ORDER.includes(c), c);
    assert.equal(ORDER.length, 2136);
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
    // Claim all but the last card of lesson 1.
    const keptBack = first.cards[first.cards.length - 1].c;
    const claimedFacts = first.facts.filter(
      (f) => f !== packLessons([keptBack], RANGE)[0].facts[0],
    );
    const rest = nextKanjiLesson(claiming(claimedFacts), ORDER, RANGE);
    assert.ok(rest);
    assert.equal(rest.group.index, 1);
    assert.deepEqual(
      rest.cards.map((c) => c.c),
      [keptBack],
    );
  });

  test("claiming the lot is null — done is a real state, not an empty lesson", () => {
    const all = GROUPS.flatMap((g) => g.facts);
    assert.equal(nextKanjiLesson(claiming(all), ORDER, RANGE), null);
  });
});

/** The cost of a lesson's first bundle — for the min-guarantee proof. A lesson's
 * leading run up to (and including) the first kanji that is some other kanji's
 * root boundary is fiddly to recover, so this leans on the packer: re-pack the
 * lesson's own chars and take the first result's cost. */
function firstBundleCost(g: { chars: string[] }): number {
  return packLessons(g.chars, { min: 1, max: 1 })[0].cost;
}

/** Every fact in the lessons before `c`'s — the cheap way to stand at a given
 * lesson without inventing a history for each one. */
function lessonsBefore(c: string): FactId[] {
  return GROUPS.filter((g) => g.index < lessonOf(c)).flatMap((g) => g.facts);
}
