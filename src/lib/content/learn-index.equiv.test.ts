// THE SAFETY NET for the /learn precompute (docs/perf-learn-bundle.md, Phase 1).
//
// Progress is a set of stable fact-id strings and the lesson is DERIVED from them.
// /learn no longer derives its units from the live dictionary — it schedules over a
// precomputed index (learn-index.json). If that index's frontier ever drifted from
// the live derivation, every user's history would silently corrupt (a lesson would
// teach or skip the wrong facts). This test asserts they cannot drift: across a
// spread of histories, the PRECOMPUTED /learn frontier returns the SAME lesson —
// same units, same order, same fact-ids — as the LIVE content frontier. It gates
// the merge; if it goes red, the precompute is wrong.
//
// The two sides:
//   LIVE:  nextTrackLesson(UNIT_TRACKS[t].units(h), h, range)   — dictionary-backed
//   /learn: nextLearnLesson(LEARN_TRACKS[t].units, h, range)    — precomputed, content-free

import { test } from "node:test";
import assert from "node:assert/strict";

import { UNIT_TRACKS } from "@/lib/content/unit-tracks";
import { nextTrackLesson } from "@/lib/content/unit-scheduler";
import {
  LEARN_TRACKS,
  nextLearnLesson,
  nextSentenceLearnLesson,
  nextSentenceTierId,
  sentenceLearnLessonForRun,
  sentenceTierIdOfEntry,
} from "@/lib/content/learn-index";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { nextSentenceOrderingLesson } from "@/lib/sentence-ordering-plan";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { VOCAB_FACTS } from "@/data/vocab";
import { GRAMMAR_FACTS } from "@/data/grammar";
import { wordMeaningFactId } from "@/lib/vocab-ids";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { HistoryFile, QuizSessionRecord } from "@/types";

/** A representative spread of lesson ranges — a tight single-unit lesson, the
 * default-ish band, and a wide one — so the budget/ceiling branches are exercised. */
const RANGES: readonly LessonRange[] = [
  { min: 1, max: 1 },
  { min: 3, max: 8 },
  { min: 5, max: 20 },
];

/** A lesson reduced to exactly what must not drift: the ordered units, each by its
 * entry, kind, reading (the pronunciation dedupe axis), cost, and — the load-bearing
 * bit — its fact-ids. Null for no lesson. Two lessons are equivalent iff their
 * signatures are deeply equal. */
function sig(
  lesson: { units: readonly { item: { entry: unknown }; kind: string; reading?: string | null; cost: number; facts: readonly unknown[] }[] } | null,
): unknown {
  if (!lesson) return null;
  return lesson.units.map((u) => ({
    entry: String(u.item.entry),
    kind: u.kind,
    reading: u.reading ?? null,
    cost: u.cost,
    facts: u.facts.map(String),
  }));
}

// The tracks line up by index and id (both come from UNIT_TRACKS), so a mismatch
// here would make every other assertion meaningless.
test("LEARN_TRACKS mirror UNIT_TRACKS (id + order)", () => {
  assert.equal(LEARN_TRACKS.length, UNIT_TRACKS.length);
  for (let t = 0; t < UNIT_TRACKS.length; t++) {
    assert.equal(LEARN_TRACKS[t].id, UNIT_TRACKS[t].id, `track ${t} id`);
    assert.equal(LEARN_TRACKS[t].title, UNIT_TRACKS[t].title, `track ${t} title`);
  }
});

// The precompute's core premise: a track's unit SET/ORDER ignores history. If this
// held only sometimes, computing the index against empty history would be wrong.
test("units are history-independent", () => {
  for (const track of UNIT_TRACKS) {
    const base = track.seed?.() ?? emptyHistory();
    const order = track.units(base);
    // Claim a scattered third of the units, then re-ask for the order.
    const claimed = order
      .filter((_, i) => i % 3 === 0)
      .flatMap((u) => u.facts);
    const after = track.units(applyClaims(base, claimed, 1));
    assert.deepEqual(
      after.map((u) => String(u.item.entry) + "␟" + (u as { reading?: string | null }).reading),
      order.map((u) => String(u.item.entry) + "␟" + (u as { reading?: string | null }).reading),
      `track ${track.id} order changed with history`,
    );
  }
});

// The main net: drive each track forward lesson-by-lesson from its seed (the same
// forward walk the app makes), claiming each lesson's facts, and assert the /learn
// frontier equals the live frontier at EVERY step — empty history, every partial
// state along the way, and past the frontier (the walk runs to exhaustion). Units
// are history-independent (asserted above), so the live order is computed ONCE and
// reused — the per-step lesson equivalence is what proves precomputed == live.
for (let t = 0; t < UNIT_TRACKS.length; t++) {
  const track = UNIT_TRACKS[t];
  test(`forward walk stays equivalent — ${track.id}`, () => {
    const seed = track.seed?.() ?? emptyHistory();
    const liveOrder = track.units(seed);
    const learnUnits = LEARN_TRACKS[t].units;

    for (const range of RANGES) {
      let history: HistoryFile = seed;
      // A generous cap: every track drains well within this, and it bounds a
      // runaway if a bug made the walk never advance.
      for (let step = 0; step < 600; step++) {
        const live = nextTrackLesson(liveOrder, history, range);
        const learn = nextLearnLesson(learnUnits, history, range);
        assert.deepEqual(
          sig(learn),
          sig(live),
          `${track.id} range ${range.min}-${range.max} step ${step}`,
        );
        if (!live) break;
        history = applyClaims(
          history,
          live.units.flatMap((u) => u.facts),
          step + 1,
        );
      }
    }
  });
}

// OUT-OF-ORDER Library claims: a learner can mark items known from anywhere in the
// Library, not just front-to-back. Claim units from scattered positions in a
// deliberately jumbled order and assert equivalence holds after each — the case the
// position-independent fact ids exist to make safe.
test("out-of-order Library claims stay equivalent", () => {
  const range: LessonRange = { min: 3, max: 8 };
  for (let t = 0; t < UNIT_TRACKS.length; t++) {
    const track = UNIT_TRACKS[t];
    const seed = track.seed?.() ?? emptyHistory();
    const order = track.units(seed);
    const learnUnits = LEARN_TRACKS[t].units;

    const picks = [7, 1, 40, 13, 100, 4, 250, 30].filter((i) => i < order.length);
    let history: HistoryFile = seed;
    let ts = 1;
    for (const i of picks) {
      history = applyClaims(history, [...order[i].facts], ts++);
      assert.deepEqual(
        sig(nextLearnLesson(learnUnits, history, range)),
        sig(nextTrackLesson(track.units(seed), history, range)),
        `${track.id} after out-of-order claim at index ${i}`,
      );
    }
  }
});

function assertSentenceGateEquivalent(history: HistoryFile, label: string): void {
  const live = nextSentenceOrderingLesson(true, history);
  assert.equal(nextSentenceTierId(history), live?.tierId ?? null, label);

  const sentenceUnits = LEARN_TRACKS.find((track) => track.id === "sentence")!.units;
  const lesson = nextSentenceLearnLesson(sentenceUnits, history);
  assert.equal(
    lesson ? sentenceTierIdOfEntry(lesson.units[0].item.entry) : null,
    live?.tierId ?? null,
    `${label} lesson`,
  );
}

test("sentence gate matches the live planner across partial vocabulary", () => {
  assertSentenceGateEquivalent(emptyHistory(), "empty");

  let history = applyClaims(
    emptyHistory(),
    [wordMeaningFactId("寿司")],
    1,
  );
  assertSentenceGateEquivalent(history, "one curated-sentence word");

  history = applyClaims(history, [wordMeaningFactId("食べる")], 2);
  assertSentenceGateEquivalent(history, "one readable simple sentence");

  for (const count of [10, 50, 100, 500, 1000, VOCAB_FACTS.length]) {
    const partial = applyClaims(
      emptyHistory(),
      VOCAB_FACTS.slice(0, count).map((fact) => fact.id),
      count,
    );
    assertSentenceGateEquivalent(partial, `${count} vocabulary facts`);
  }
});

test("sentence gate stays linear through every fully-unlocked tier", () => {
  let history = applyClaims(
    emptyHistory(),
    [...VOCAB_FACTS, ...GRAMMAR_FACTS].map((fact) => fact.id),
    1,
  );

  for (let step = 0; step < 20; step++) {
    const live = nextSentenceOrderingLesson(true, history);
    assertSentenceGateEquivalent(history, `full knowledge step ${step}`);
    if (!live) break;
    history = applyClaims(
      history,
      [sentenceTierMarkerFact(live.tierId)],
      step + 2,
    );
  }
  assert.equal(nextSentenceTierId(history), null);
});

test("an assembly-completed tier advances like the live planner", () => {
  let history = applyClaims(
    emptyHistory(),
    [...VOCAB_FACTS, ...GRAMMAR_FACTS].map((fact) => fact.id),
    1,
  );
  const simple = nextSentenceOrderingLesson(true, history);
  assert.ok(simple?.facts[0]);
  const session = {
    ts: 2,
    mode: "assembly",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {
      [simple.facts[0]]: { seen: 1, missed: 0, firstTry: 1, correct: 1 },
    },
  } as QuizSessionRecord;
  history = { ...history, sessions: [session] };
  assertSentenceGateEquivalent(history, "simple completed by assembly session");
  assert.notEqual(nextSentenceTierId(history), "simple");
});

test("an open sentence run stays pinned to its marker tier", () => {
  const history = applyClaims(
    emptyHistory(),
    [...VOCAB_FACTS, ...GRAMMAR_FACTS].map((fact) => fact.id),
    1,
  );
  const sentenceUnits = LEARN_TRACKS.find((track) => track.id === "sentence")!.units;
  const current = nextSentenceLearnLesson(sentenceUnits, history);
  assert.ok(current);
  const tierId = sentenceTierIdOfEntry(current.units[0].item.entry);
  assert.ok(tierId);

  const resting = sentenceLearnLessonForRun(sentenceUnits, [
    sentenceTierMarkerFact(tierId),
  ]);
  assert.equal(
    resting && sentenceTierIdOfEntry(resting.units[0].item.entry),
    tierId,
  );
  assert.equal(sentenceLearnLessonForRun(sentenceUnits, []), null);
});
