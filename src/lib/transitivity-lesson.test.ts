// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/transitivity-lesson.test.ts
//
// WHAT THESE PIN
// ==============
// The transitivity track has properties that all type-check when broken:
//
//   IN CURRICULUM  it teaches only pairs whose BOTH verbs the app teaches, so a
//                  pair can never be gated behind a verb that never unlocks.
//   THE GATE       a pair unlocks only once BOTH its verbs are learned vocab —
//                  one verb is not enough.
//   INTERLEAVED    a locked pair is SKIPPED, not blocked on: a later ready pair
//                  is taught even when an earlier one is still locked.
//   POSITION       counted in pairs, out of the fixed curriculum total.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CURRICULUM_PAIRS,
  TRANSITIVITY_CURRICULUM_TOTAL,
  TRANSITIVITY_PER_LESSON_DEFAULT,
  clampTransitivityPerLesson,
  hasStartedTransitivityTrack,
  nextTransitivityLesson,
} from "./transitivity-lesson.ts";
import { pairEntry, sideFactId } from "../data/transitivity-facts.ts";
import { VERB_PAIRS } from "../data/transitivity.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** Claim these facts known — a claim is non-fresh, so it counts as met/learned,
 * the same signal /api/claim writes. */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

/** The vocab meaning facts that unlock a pair's gate — one per verb. */
function verbsOf(p: (typeof CURRICULUM_PAIRS)[number]): FactId[] {
  return [wordMeaningFactId(p.happens.word), wordMeaningFactId(p.doIt.word)];
}

describe("the track is the pairs whose both verbs the app teaches", () => {
  const kebs = new Set(CURRICULUM_WORDS.map((w) => w.keb));

  test("every curriculum pair has both verbs in the words curriculum", () => {
    for (const p of CURRICULUM_PAIRS) {
      assert.ok(kebs.has(p.happens.word), `${p.happens.word} not taught`);
      assert.ok(kebs.has(p.doIt.word), `${p.doIt.word} not taught`);
    }
  });

  test("a pair with a verb outside the curriculum is excluded", () => {
    const excluded = VERB_PAIRS.filter(
      (p) => !kebs.has(p.happens.word) || !kebs.has(p.doIt.word),
    );
    for (const p of excluded) {
      assert.ok(!CURRICULUM_PAIRS.includes(p));
    }
  });

  test("the total is the curriculum pair count", () => {
    assert.equal(TRANSITIVITY_CURRICULUM_TOTAL, CURRICULUM_PAIRS.length);
  });
});

describe("the gate needs BOTH verbs learned", () => {
  test("empty history teaches nothing — every pair is locked", () => {
    assert.equal(
      nextTransitivityLesson(history(), TRANSITIVITY_PER_LESSON_DEFAULT),
      null,
    );
    assert.equal(hasStartedTransitivityTrack(history()), false);
  });

  test("one verb learned is not enough to unlock a pair", () => {
    const p = CURRICULUM_PAIRS[0];
    const oneVerb = claiming([wordMeaningFactId(p.happens.word)]);
    assert.equal(
      nextTransitivityLesson(oneVerb, TRANSITIVITY_PER_LESSON_DEFAULT),
      null,
    );
  });

  test("both verbs learned unlocks the pair", () => {
    const p = CURRICULUM_PAIRS[0];
    const lesson = nextTransitivityLesson(claiming(verbsOf(p)), 4);
    assert.ok(lesson);
    assert.equal(lesson.cards[0].entry, pairEntry(p));
    assert.deepEqual(lesson.position, {
      from: 1,
      to: lesson.cards.length,
      total: TRANSITIVITY_CURRICULUM_TOTAL,
    });
  });
});

describe("locked pairs are skipped, not blocked on", () => {
  test("a later ready pair is taught while an earlier one is still locked", () => {
    // Unlock only the SECOND curriculum pair. The first stays locked; the track
    // must reach past it rather than stalling.
    const later = CURRICULUM_PAIRS[1];
    const lesson = nextTransitivityLesson(claiming(verbsOf(later)), 4);
    assert.ok(lesson);
    const entries = lesson.cards.map((c) => c.entry);
    assert.ok(entries.includes(pairEntry(later)));
    assert.ok(!entries.includes(pairEntry(CURRICULUM_PAIRS[0])));
  });
});

describe("a taught pair drops out once met, and started flips", () => {
  test("claiming a pair's side facts removes it and marks the track started", () => {
    const p = CURRICULUM_PAIRS[0];
    // Both verbs learned AND both side facts met.
    const done = claiming([
      ...verbsOf(p),
      sideFactId(p, "happens"),
      sideFactId(p, "doIt"),
    ]);
    assert.equal(hasStartedTransitivityTrack(done), true);
    const lesson = nextTransitivityLesson(done, 4);
    // p is met, so it is not offered again.
    const entries = lesson?.cards.map((c) => c.entry) ?? [];
    assert.ok(!entries.includes(pairEntry(p)));
  });
});

describe("clampTransitivityPerLesson", () => {
  test("clamps to a whole size between 1 and 20", () => {
    assert.equal(clampTransitivityPerLesson(0), 1);
    assert.equal(clampTransitivityPerLesson(4), 4);
    assert.equal(clampTransitivityPerLesson(999), 20);
    assert.equal(clampTransitivityPerLesson(NaN), TRANSITIVITY_PER_LESSON_DEFAULT);
  });
});
