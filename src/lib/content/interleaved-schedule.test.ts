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
import { isFactFresh } from "./unit-scheduler-core.ts";
import { factsOf } from "@/lib/facts";
import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order.ts";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { TeachingUnit } from "./teach-unit.ts";
import type { ContentItem } from "./item.ts";
import type { FactId, HistoryFile } from "@/types";

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

// keigo and transitivity are exempt from BOTH timing checks below (first-
// unlock and same-track-gap), on a real product distinction, not a data
// artifact: their content only matters once a learner already knows every
// word it's about — a keigo set is unusable before its plain verb is known,
// a transitivity pair means nothing until both sides are — so there is
// nothing lost by them arriving in a burst whenever their gating vocabulary
// happens to line up. A learner who cares about a specific word's
// transitivity before its pair lesson arrives can look it up directly; nothing
// is blocked on the pair lesson itself. Reachability is NOT exempt — the
// test above still requires every keigo/transitivity unit to eventually
// unlock, since "arrives late" and "never arrives" are different failure
// modes and only the second one is a bug. kana/vocab/numbers/grammar/sentence
// stay in the timing checks because they don't have this property: a learner
// wants a steady drip of new words, and sentence structure (word order) is
// basic-enough language function that a long silence there is a real gap in
// the experience, not a "look it up if you care" case.
const GAP_CHECK_EXEMPT_TRACKS: ReadonlySet<string> = new Set(["keigo", "transitivity"]);

// A flat ceiling, not a fraction of the walk. The fraction-of-walk approach
// existed to keep pace with tracks whose worst-case wait scales with total
// curriculum size — exactly the property keigo/transitivity have (their gate
// depends on however far out a specific word sits in vocab's rank order) and
// exactly why they're now exempt above. The tracks still checked here don't
// have that property: none of them wait on an arbitrarily-ranked cross-track
// word, so their pacing is bounded by their own content, not by curriculum
// size — today's real worst gap among them is 1 round (see the console.table
// below). 30 leaves comfortable room for a legitimate future dependency chain
// (grammar prereqs, sentence-ordering gates) without tolerating the kind of
// silent multi-hundred-round drought that would mean a real track is stuck.
const MAX_REASONABLE_ROUNDS = 30;

/** One taught unit's round and the entry it belongs to, in teaching order —
 * NOT declared/curriculum order, since a due-but-blocked unit can be pulled
 * past by a later one that unblocks sooner (see unitGapRange's header). */
interface UnitTaken {
  readonly round: number;
  readonly entry: string;
}

interface SimResult {
  readonly trackId: string;
  readonly totalUnits: number;
  readonly residualDue: number;
  /** The round number at which each of this track's lessons was taken, in
   * order — e.g. [1, 1, 3, 3, 3, 9] for six lessons. */
  readonly unlockRounds: readonly number[];
  /** Every individual UNIT (not lesson) this track taught, in teaching order —
   * a lesson bundles several units into one round, so this is longer than
   * `unlockRounds` and is what unit-to-unit gap size is measured from. */
  readonly unitsTaken: readonly UnitTaken[];
  /** Every unit STILL due once the walk exhausts, with the entry(ies) its
   * blockedBy gate is stuck on — empty `blockers` means it's stuck for some
   * other reason (a depth-gated prereq chain), not an unlearned blocker. */
  readonly unreachableUnits: readonly UnreachableUnit[];
}

interface UnreachableUnit {
  readonly entry: string;
  readonly glyph: string;
  readonly blockers: readonly string[];
}

/** The blockedBy entries of an item that are NOT learned — no facts at all (the
 * entry doesn't exist in the curriculum under that spelling), or at least one
 * fact still fresh (met, but not yet fully learned). Mirrors unit-scheduler.ts's
 * own (unexported) `isLearned`, restated here as its own report tool rather
 * than importing a private function. */
function unlearnedBlockers(item: ContentItem, history: HistoryFile): string[] {
  return item.blockedBy
    .filter((entry) => {
      const facts = factsOf(entry);
      return facts.length === 0 || facts.some((f) => isFactFresh(f, history));
    })
    .map(String);
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
  const unitsTaken: UnitTaken[][] = orders.map(() => []);

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
      for (const u of lesson.units) unitsTaken[i].push({ round, entry: String(u.item.entry) });
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
    unitsTaken: unitsTaken[i],
    unreachableUnits: orders[i]
      .filter((u) => isUnitDue(u, history))
      .map((u) => ({
        entry: String(u.item.entry),
        glyph: u.item.glyph,
        blockers: unlearnedBlockers(u.item, history),
      })),
  }));

  return { results, roundsRun: round, exhausted: !anyTaken };
}

const SIM = simulate();

interface UnitGapRange {
  readonly min: number | null;
  readonly max: number | null;
  /** The two units bounding the MAX gap, so the report can name what a learner
   * would actually be waiting on — e.g. a compound word (見つかる/見つける)
   * sorted early by a common shared kanji (見) but not itself taught by the
   * vocab track until much later. `null` when there's no gap to bound. */
  readonly maxGapBetween: readonly [UnitTaken, UnitTaken] | null;
}

/** The smallest and largest round-gap between two consecutively-taught units in
 * a track's own TEACHING order — which can differ from its declared/curriculum
 * order: a due-but-blocked unit can never be skipped by the cursor (only a
 * fully-learned one can), so a later unit whose own blockers clear sooner gets
 * pulled ahead of it within the same scan. 0 when a lesson bundles several
 * units into the same round. `{ min: null, max: null, maxGapBetween: null }`
 * when a track never taught 2+ units to gap between. */
function unitGapRange(unitsTaken: readonly UnitTaken[]): UnitGapRange {
  if (unitsTaken.length < 2) return { min: null, max: null, maxGapBetween: null };
  let min = Infinity;
  let max = -Infinity;
  let maxGapBetween: readonly [UnitTaken, UnitTaken] | null = null;
  for (let i = 1; i < unitsTaken.length; i++) {
    const gap = unitsTaken[i]!.round - unitsTaken[i - 1]!.round;
    if (gap < min) min = gap;
    if (gap > max) {
      max = gap;
      maxGapBetween = [unitsTaken[i - 1]!, unitsTaken[i]!];
    }
  }
  return { min, max, maxGapBetween };
}

// Printed once, independent of pass/fail, so `npm test -- interleaved-schedule`
// always answers "what does the walk actually look like" without editing the
// test to find out.
console.log(
  `\ninterleaved-schedule simulation: ${SIM.roundsRun} rounds, ${SIM.exhausted ? "exhausted" : "hit MAX_ROUNDS"}\n` +
    `thresholds: MAX_ROUNDS=${MAX_ROUNDS} (safety cap), ` +
    `MAX_REASONABLE_ROUNDS=${MAX_REASONABLE_ROUNDS} (first-lesson and same-track-gap bound, ` +
    `skipped for ${[...GAP_CHECK_EXEMPT_TRACKS].join("/")})`,
);
console.table(
  SIM.results.map((r) => {
    const { min, max, maxGapBetween } = unitGapRange(r.unitsTaken);
    return {
      track: r.trackId,
      "units taught": r.totalUnits - r.residualDue,
      "units total": r.totalUnits,
      "min gap (rounds)": min ?? "n/a",
      "max gap (rounds)": max ?? "n/a",
      "max gap between": maxGapBetween
        ? `${maxGapBetween[0].entry} (r${maxGapBetween[0].round}) \u2192 ${maxGapBetween[1].entry} (r${maxGapBetween[1].round})`
        : "n/a",
      unreachable: r.residualDue,
    };
  }),
);

// One row per stuck unit, naming exactly what it's waiting on — the detail the
// summary table's count alone can't show.
const anyUnreachable = SIM.results.some((r) => r.unreachableUnits.length > 0);
if (anyUnreachable) {
  console.log("\nunreachable units, and what each is blocked on:");
  console.table(
    SIM.results.flatMap((r) =>
      r.unreachableUnits.map((u) => ({
        track: r.trackId,
        entry: u.entry,
        glyph: u.glyph,
        "unmet blockers": u.blockers.length > 0 ? u.blockers.join(", ") : "(none \u2014 stuck for another reason)",
      })),
    ),
  );
}

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
  // No allowlist here on purpose: an unreachable unit is a real content gap
  // (today, 生まれる/産む and 濡れる/濡らす — see docs/interleaved-schedule-findings.md
  // for why), and this test's whole point is to keep failing until it is
  // actually fixed, not to go quiet the moment the gap is named.
  const unreachable = SIM.results
    .filter((r) => r.residualDue > 0)
    .map((r) => `${r.trackId}: ${r.residualDue}/${r.totalUnits} units never scheduled`);
  assert.deepEqual(
    unreachable,
    [],
    "one or more tracks have units that can NEVER be scheduled — their blockedBy gate never " +
      "clears because the curriculum never teaches what it points at (a verb missing from " +
      "CURRICULUM_SEQUENCE is the known cause for keigo/transitivity today)",
  );
});

test("every track eventually produces at least one lesson", () => {
  // Kept separate from, and unconditional on, the exemption below: a track
  // that never fires at all is the UNREACHABLE failure mode (a real bug),
  // not the "arrives late" one keigo/transitivity are excused from.
  for (const r of SIM.results) {
    assert.ok(
      r.unlockRounds.length > 0,
      `${r.trackId}: never produced a single lesson in ${SIM.roundsRun} rounds`,
    );
  }
});

test(`no track takes more than ${MAX_REASONABLE_ROUNDS} rounds to produce its first lesson (keigo/transitivity exempt)`, () => {
  for (const r of SIM.results) {
    if (GAP_CHECK_EXEMPT_TRACKS.has(r.trackId)) continue;
    assert.ok(
      r.unlockRounds[0]! <= MAX_REASONABLE_ROUNDS,
      `${r.trackId}: first lesson didn't unlock until round ${r.unlockRounds[0]} (> ${MAX_REASONABLE_ROUNDS})`,
    );
  }
});

test(`no lesson is more than ${MAX_REASONABLE_ROUNDS} rounds after the previous lesson in its own track (keigo/transitivity exempt)`, () => {
  for (const r of SIM.results) {
    if (GAP_CHECK_EXEMPT_TRACKS.has(r.trackId)) continue;
    for (let i = 1; i < r.unlockRounds.length; i++) {
      const gap = r.unlockRounds[i]! - r.unlockRounds[i - 1]!;
      assert.ok(
        gap <= MAX_REASONABLE_ROUNDS,
        `${r.trackId}: lesson ${i + 1} landed ${gap} rounds after lesson ${i} (> ${MAX_REASONABLE_ROUNDS}), ` +
          `at round ${r.unlockRounds[i]}`,
      );
    }
  }
});
