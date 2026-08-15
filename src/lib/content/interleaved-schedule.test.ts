// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/interleaved-schedule.test.ts
//
// CROSS-TRACK REACHABILITY AND TIMING — a fair, ROUND-ROBIN simulation across
// every UNIT_TRACK at once (one lesson attempt per track per round), running
// the REAL scheduler (`nextTrackLesson`, unit-scheduler.ts) so cross-track
// `blockedBy` gates are honored exactly as the app enforces them. No track's
// own `seed()` is applied here — that exists only to make the isolated
// /dev/scheduling preview reachable in isolation (see unit-tracks.ts); folding
// it in here would hide exactly the cross-track lock-out this file exists to
// catch.
//
// Round-robin is the FAIREST possible interleaving: every track gets a turn
// every single round, so if content is still unreachable or slow to unlock
// here, it is at least that bad under any real (necessarily less generous)
// usage pattern. This is a lower bound, not an upper bound, on how bad the
// real experience can be.
//
// FOUR THINGS THIS GUARDS, matching four distinct failure modes a scheduling
// bug or a content gap can cause:
//   0. UNCOVERED — a glyph the curriculum DECLARES (CURRICULUM_SEQUENCE) that
//      never becomes a schedulable unit at all, so it is invisible to every
//      check below (there is nothing in `order` to call "unreachable" — it
//      was dropped before a unit ever existed). Caught the real gap: 6,906 of
//      9,140 curriculum glyphs (every MULTI-character word) never produce a
//      unit, because `orderedUnits` builds units through `buildGlyphItem`,
//      which is single-Han-character only (`characterRoles` →
//      `isSingleCharWordGlyph` excludes multi-character glyphs explicitly, by
//      its own comment). This is why marking literally everything reachable
//      as known still leaves the Library's "Not known" filter non-empty —
//      those words were never offered to teach in the first place, so
//      "curriculum complete" and "not known" are BOTH accurate readings of a
//      curriculum that only ever taught 24% of what it claims to declare. See
//      docs/interleaved-schedule-findings.md.
//   1. UNREACHABLE — a unit that DOES get built but can never be scheduled
//      (its `blockedBy` gate never clears because the curriculum never
//      teaches what it points at). Caught keigo/transitivity's own gap: 31+
//      verb-pair/keigo plain verbs are missing from CURRICULUM_SEQUENCE, so
//      their blockedBy edge onto that word never lifts.
//   2. A TRACK LOCKED TOO LONG before its first lesson ever appears.
//   3. A GAP TOO LONG between two consecutive lessons of the SAME track once
//      it has started.
//
// This test is EXPECTED TO FAIL on today's content (findings #0 and #1,
// above) — that is deliberate: the failure IS the signal that the curriculum
// has real, unaddressed gaps, not a bug in this test.

import assert from "node:assert/strict";
import test from "node:test";

import { UNIT_TRACKS } from "./unit-tracks.ts";
import { nextTrackLesson } from "./unit-scheduler.ts";
import { isUnitDue, orderedUnits } from "./teach-unit.ts";
import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order.ts";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { TeachingUnit } from "./teach-unit.ts";
import type { FactId } from "@/types";

test("every glyph CURRICULUM_SEQUENCE declares produces at least one schedulable unit", () => {
  // The vocab track's own order-builder — verbatim what unit-tracks.ts's
  // vocabUnits() calls — so this catches exactly what the real track would
  // silently drop, not a reimplementation that could disagree with it.
  const units = orderedUnits(CURRICULUM_SEQUENCE.map((i) => i.glyph));
  const covered = new Set(units.map((u) => u.item.glyph));
  const uncovered = CURRICULUM_SEQUENCE.map((i) => i.glyph).filter((g) => !covered.has(g));
  const multiChar = uncovered.filter((g) => [...g].length > 1);
  const singleChar = uncovered.filter((g) => [...g].length === 1);
  assert.deepEqual(
    { multiCharUncovered: multiChar.length, singleCharUncovered: singleChar.length },
    { multiCharUncovered: 0, singleCharUncovered: 0 },
    `${uncovered.length}/${CURRICULUM_SEQUENCE.length} curriculum glyphs produce ZERO teaching ` +
      `units and can never be scheduled or taught — buildGlyphItem (which orderedUnits builds on) ` +
      `is single-Han-character only, so every multi-character glyph in CURRICULUM_SEQUENCE is ` +
      `silently dropped`,
  );
});

// A safety cap on the simulation, not a pass/fail threshold — the walk is
// expected to terminate (nothing left schedulable anywhere) well before this;
// hitting it without terminating is itself a finding (a runaway/cyclic gate)
// asserted on below. Set comfortably above the real walk's length (~1,800
// rounds once the vocab track covers its full ~9,140-glyph curriculum) to
// leave headroom for curriculum growth.
const MAX_ROUNDS = 20000;

// "Unreasonable" for both the first-unlock and same-track-gap checks: no
// legitimate prerequisite chain in this curriculum should take more than a
// FIFTH of the entire interleaved walk to clear, under an interleaving this
// generous (every track tried every round). A FRACTION of the measured walk
// length, not a fixed constant — the walk's own length scales with the
// curriculum (it roughly quadrupled, ~470 to ~1,800 rounds, the moment
// orderedUnits stopped silently dropping multi-character words), so a fixed
// number would need re-tuning on every curriculum-size change and would
// silently stop meaning "a fifth of the walk" the moment it drifted out of
// sync. Computed after the simulation runs, once SIM.roundsRun is known.
const MAX_REASONABLE_FRACTION = 0.2;

interface SimResult {
  readonly trackId: string;
  readonly totalUnits: number;
  readonly residualDue: number;
  /** The round number at which each of this track's lessons was taken, in
   * order — e.g. [1, 1, 3, 3, 3, 9] for six lessons. */
  readonly unlockRounds: readonly number[];
}

/**
 * The shared simulation every test below reads from — run ONCE (module-level,
 * not per-test) since it walks the real scheduler ~473 rounds deep across
 * every track. A pure function of nothing but the app's own content and
 * scheduling code, so re-running it never disagrees with itself.
 */
function simulate(): { results: readonly SimResult[]; roundsRun: number; exhausted: boolean } {
  const range = LESSON_RANGE_DEFAULT;
  let history = emptyHistory();
  let ts = 1;

  // Every track orders statically (the scheduler filters dueness against the
  // evolving shared history), so each order is computed once up front — same
  // optimization unit-tracks.ts's own simulateLessons makes.
  const orders: readonly (readonly TeachingUnit[])[] = UNIT_TRACKS.map((t) => t.units(history));
  const cursors = orders.map(() => 0);
  const unlockRounds: number[][] = orders.map(() => []);

  let round = 0;
  let anyTaken = true;
  while (anyTaken && round < MAX_ROUNDS) {
    anyTaken = false;
    round++;
    for (let i = 0; i < UNIT_TRACKS.length; i++) {
      const order = orders[i];
      const lesson = nextTrackLesson(order, history, range, cursors[i]);
      if (!lesson) continue;
      anyTaken = true;
      unlockRounds[i].push(round);
      const facts = lesson.units.flatMap((u) => u.facts) as FactId[];
      history = applyClaims(history, facts, ts++);
      while (cursors[i] < order.length && !isUnitDue(order[cursors[i]], history)) cursors[i]++;
    }
  }

  const results = UNIT_TRACKS.map((track, i) => ({
    trackId: track.id,
    totalUnits: orders[i].length,
    residualDue: orders[i].filter((u) => isUnitDue(u, history)).length,
    unlockRounds: unlockRounds[i],
  }));

  return { results, roundsRun: round, exhausted: !anyTaken };
}

const SIM = simulate();

// Derived from the actual measured walk length, not a constant — see
// MAX_REASONABLE_FRACTION above.
const MAX_REASONABLE_ROUNDS = Math.ceil(SIM.roundsRun * MAX_REASONABLE_FRACTION);

test("the simulation terminates by exhaustion, not by hitting the safety cap", () => {
  // Hitting the cap while units are still being taken would mean something is
  // scheduling forever (a cycle, or a track vastly larger than expected) —
  // a different failure mode than the three below, worth its own clear signal.
  assert.ok(
    SIM.exhausted,
    `simulation still scheduling new lessons after ${MAX_ROUNDS} rounds — raise MAX_ROUNDS or investigate a runaway/cyclic gate`,
  );
});

test("every unit in every track is eventually reachable under a fair interleaved walk", () => {
  const unreachable = SIM.results.filter((r) => r.residualDue > 0);
  assert.deepEqual(
    unreachable.map((r) => `${r.trackId}: ${r.residualDue}/${r.totalUnits} units never scheduled`),
    [],
    "one or more tracks have units that can NEVER be scheduled — their blockedBy gate never " +
      "clears because the curriculum never teaches what it points at (a verb missing from " +
      "CURRICULUM_SEQUENCE is the known cause for keigo/transitivity today)",
  );
});

test(`no track takes more than ${MAX_REASONABLE_ROUNDS} rounds to produce its first lesson`, () => {
  for (const r of SIM.results) {
    assert.ok(
      r.unlockRounds.length > 0,
      `${r.trackId}: never produced a single lesson in ${SIM.roundsRun} rounds`,
    );
    assert.ok(
      r.unlockRounds[0] <= MAX_REASONABLE_ROUNDS,
      `${r.trackId}: first lesson didn't unlock until round ${r.unlockRounds[0]} (> ${MAX_REASONABLE_ROUNDS})`,
    );
  }
});

test(`no lesson is more than ${MAX_REASONABLE_ROUNDS} rounds after the previous lesson in its own track`, () => {
  for (const r of SIM.results) {
    for (let i = 1; i < r.unlockRounds.length; i++) {
      const gap = r.unlockRounds[i] - r.unlockRounds[i - 1];
      assert.ok(
        gap <= MAX_REASONABLE_ROUNDS,
        `${r.trackId}: lesson ${i + 1} landed ${gap} rounds after lesson ${i} (> ${MAX_REASONABLE_ROUNDS}), ` +
          `at round ${r.unlockRounds[i]}`,
      );
    }
  }
});
