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
import { freshFacts, nextGroup } from "./budget.ts";
import { kanjiTeachOrder, meaningFactId } from "../data/kanji.ts";
import {
  isRadicalTaughtAsKanji,
  radicalMeaningFactId,
  radicalOfKanji,
} from "../data/radicals.ts";
import { RADICAL_TEACHING_ORDER } from "./radical-order.ts";
import { kanjiRadicalKnown, radicalKnown } from "./radical-known.ts";
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

/** The kanji of the NEXT fresh kanji group for a given history — the group the
 * radical track reads to decide what is due. Mirrors radical-lesson's own
 * internal `nextKanjiGroupChars`. */
function nextKanjiGroupChars(h: HistoryFile): string[] {
  const groups = kanjiCurriculum(ORDER, RANGE);
  const fresh = freshFacts(
    groups.flatMap((g) => g.facts),
    h,
  );
  const facts = nextGroup(
    groups.map((g) => g.facts),
    fresh,
  );
  if (!facts.length) return [];
  const group = groups.find((g) => g.facts.includes(facts[0]));
  return group ? [...group.chars] : [];
}

/** Walk the curriculum lesson by lesson from a fresh (kana-done) history until
 * the first NON-merged radical blocks a kanji group — the gate the radical
 * track exists to open. Returns that blocked-state history. */
function firstRadicalGate(): HistoryFile {
  let h = history();
  for (let step = 0; step < 4000; step++) {
    const kanji = nextKanjiLesson(h, ORDER, RANGE);
    const due = dueRadicals(h, ORDER, RANGE);
    if (!kanji && due.length) return h;
    if (kanji) {
      h = claiming(kanji.facts, h);
      continue;
    }
    if (due.length) {
      h = claiming(
        due.map((r) => radicalMeaningFactId(r.glyph)),
        h,
      );
      continue;
    }
    break;
  }
  throw new Error("no radical gate was ever reached");
}

describe("kanji gate on radicals", () => {
  test("day one is kanji, not radicals — the first group's radicals are all merged", () => {
    // 人 大 日 一 are each their own radical's first consumer, so they are taught
    // as kanji (labelled "also a radical"), with no radical pre-card. The kanji
    // lesson is available at once and the radical track has nothing due — the old
    // behaviour taught 人 the radical and then 人 the kanji, which was the
    // duplication this removes.
    const h = history();
    assert.ok(
      nextKanjiLesson(h, ORDER, RANGE),
      "the first kanji lesson is unblocked with no radicals learned",
    );
    assert.equal(
      dueRadicals(h, ORDER, RANGE).length,
      0,
      "no radical is due on day one",
    );
    for (const c of firstKanjiGroupChars()) {
      const rad = radicalOfKanji(c);
      assert.ok(rad && isRadicalTaughtAsKanji(rad.num), `${c} is a merged radical`);
    }
  });

  test("the due radicals are exactly the blocked group's unknown, non-merged radicals", () => {
    const h = firstRadicalGate();
    assert.equal(
      nextKanjiLesson(h, ORDER, RANGE),
      null,
      "the group is blocked by a radical",
    );
    const chars = nextKanjiGroupChars(h);
    const expected = new Set<number>();
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      // A merged radical never blocks (it is the kanji); only unknown non-merged
      // radicals are due.
      if (rad && !isRadicalTaughtAsKanji(rad.num) && !radicalKnown(rad.glyph, h)) {
        expected.add(rad.num);
      }
    }
    const due = new Set(dueRadicals(h, ORDER, RANGE).map((r) => r.num));
    assert.deepEqual(due, expected);
    assert.ok(due.size > 0, "something is actually due at the gate");
  });

  test("no merged radical is ever due — the radical track never re-teaches a kanji", () => {
    const h = firstRadicalGate();
    for (const r of dueRadicals(h, ORDER, RANGE)) {
      assert.equal(
        isRadicalTaughtAsKanji(r.num),
        false,
        `${r.glyph} is taught as a radical card, not a kanji`,
      );
    }
  });

  test("nextRadicalLesson teaches those radicals, and claiming them unlocks the kanji", () => {
    const h = firstRadicalGate();
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
      "the blocked kanji lesson unlocks once its radicals are known",
    );
  });

  test("every kanji in the unlocked group now passes the radical gate", () => {
    const h = firstRadicalGate();
    const chars = nextKanjiGroupChars(h);
    const rads = new Set<FactId>();
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      // Only the non-merged radicals need claiming; merged ones already pass.
      if (rad && !isRadicalTaughtAsKanji(rad.num)) {
        rads.add(radicalMeaningFactId(rad.glyph));
      }
    }
    const after = claiming([...rads], h);
    for (const c of chars) {
      assert.ok(kanjiRadicalKnown(c, after), `${c} passes the radical gate`);
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
