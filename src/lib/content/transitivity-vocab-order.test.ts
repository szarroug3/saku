// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/transitivity-vocab-order.test.ts
//
// SAK-43 (QA, not new content): confirm Transitivity verb pairs are actually
// taught in Vocabulary before their pair lesson unlocks, in NORMAL (non-mass-
// claimed) progression — not eyeballed on 出る/出す alone, which is exactly how
// the original audit finding got produced (see the ticket): reaching the
// transitivity track by mass-claiming Vocabulary bypasses the natural order,
// so a spot-check under that path proves nothing about real play.
//
// THE MECHANISM THIS VERIFIES. verb-pair-unit.ts builds every transitivity
// item with `blockedBy: [wordEntry(happens), wordEntry(doIt)]`, and
// unit-scheduler-core.ts's `planUnitLessonCore` refuses to schedule a unit
// whose `blockedBy` entry isn't yet `isLearned` (all of that entry's own
// facts claimed) — see its "BLOCKING gate" line. That is a hard, structural
// guarantee IF the entry ids line up and IF nothing outside Vocabulary can
// ever satisfy a word entry's facts first. This test does not trust the
// mechanism by reading it; it runs the REAL round-robin cross-track
// simulation (the same one interleaved-schedule.test.ts uses to catch
// cross-track scheduling gaps) over every real curriculum pair
// (`transitivityItems()`, the exact list /learn's transitivity track ships)
// and checks the actual chronological order lessons were taken in: was each
// pair's verb fully taught in the VOCAB track strictly before the pair's own
// lesson?
//
// PAIRS THAT NEVER UNLOCK AT ALL are a separate, already-tracked finding
// (interleaved-schedule.test.ts's "every unit in every track is eventually
// reachable" test, docs/interleaved-schedule-findings.md — today's known gap
// is 生まれる/産む and 濡れる/濡らす). This file is about ORDER for whatever
// does unlock, not reachability, so an unreached pair is counted and reported
// separately, not folded into a pass/fail here.

import assert from "node:assert/strict";
import test from "node:test";

import { UNIT_TRACKS } from "./unit-tracks.ts";
import { nextTrackLesson } from "./unit-scheduler.ts";
import { isUnitDue } from "./teach-unit.ts";
import { transitivityItems } from "./verb-pair-unit.ts";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { TeachingUnit } from "./teach-unit.ts";
import type { FactId } from "@/types";

// Safety cap, not a threshold — mirrors interleaved-schedule.test.ts's own cap
// with the same rationale: the walk is expected to exhaust well before this.
const MAX_ROUNDS = 20000;

/**
 * Run every UNIT_TRACK forward together, one lesson attempt per track per
 * round (fair round-robin, no track's own `seed()` applied) — the real
 * scheduler, `nextTrackLesson`, over a single shared history, so a
 * transitivity pair's `blockedBy` gate is evaluated exactly as the app
 * enforces it.
 *
 * Records, per track, the SEQUENCE NUMBER (a single global counter
 * incremented once per lesson taken by ANY track, across the whole
 * simulation — NOT the round number) at which an entry last had a unit
 * taught. Round number is too coarse to order-check against: within one
 * round, every track gets a turn in a fixed order (vocab before
 * transitivity), so a verb the vocab track teaches and the pair the
 * transitivity track unlocks in reaction to it can land in the SAME round
 * while still being strictly sequential — vocab's claim is applied to the
 * shared history before transitivity's turn in that same round is even
 * evaluated. The monotonic sequence number preserves that real
 * happens-before order that "round" collapses.
 */
function simulateEntrySequence(): {
  roundsRun: number;
  exhausted: boolean;
  entrySeqByTrack: ReadonlyMap<string, ReadonlyMap<string, number>>;
} {
  const range = LESSON_RANGE_DEFAULT;
  let history = emptyHistory();
  let ts = 1;
  let seq = 0;

  const orders: readonly (readonly TeachingUnit[])[] = UNIT_TRACKS.map((t) => t.units(history));
  const cursors = orders.map(() => 0);
  const entrySeqByTrack = new Map<string, Map<string, number>>();
  for (const t of UNIT_TRACKS) entrySeqByTrack.set(t.id, new Map());

  let round = 0;
  let anyTaken = true;
  while (anyTaken && round < MAX_ROUNDS) {
    anyTaken = false;
    round++;
    for (let i = 0; i < UNIT_TRACKS.length; i++) {
      const order = orders[i]!;
      const lesson = nextTrackLesson(order, history, range, cursors[i]!);
      if (!lesson) continue;
      anyTaken = true;
      seq++;
      const entrySeq = entrySeqByTrack.get(UNIT_TRACKS[i]!.id)!;
      for (const u of lesson.units) entrySeq.set(String(u.item.entry), seq);
      const facts = lesson.units.flatMap((u) => u.facts) as FactId[];
      history = applyClaims(history, facts, ts++);
      while (cursors[i]! < order.length && !isUnitDue(order[cursors[i]!], history)) cursors[i]!++;
    }
  }

  return { roundsRun: round, exhausted: !anyTaken, entrySeqByTrack };
}

const SIM = simulateEntrySequence();

test("the shared simulation exhausts (not a runaway/cyclic gate)", () => {
  assert.ok(
    SIM.exhausted,
    `simulation still scheduling new lessons after ${MAX_ROUNDS} rounds — raise MAX_ROUNDS or investigate`,
  );
});

test("every Transitivity pair's both verbs are fully taught in Vocabulary strictly before the pair's own lesson", () => {
  const vocabSeq = SIM.entrySeqByTrack.get("vocab")!;
  const transitivitySeq = SIM.entrySeqByTrack.get("transitivity")!;
  const items = transitivityItems();
  assert.ok(items.length > 0, "sanity: the transitivity track has items to check");

  const neverUnlocked: string[] = [];
  const failures: string[] = [];
  let checked = 0;

  for (const item of items) {
    const pairSeq = transitivitySeq.get(String(item.entry));
    if (pairSeq === undefined) {
      // Reachability is a distinct, already-tracked failure mode — see the
      // header. Not asserted on here; only counted for the report below.
      neverUnlocked.push(String(item.entry));
      continue;
    }
    checked++;
    for (const verbEntry of item.blockedBy) {
      const verbSeq = vocabSeq.get(String(verbEntry));
      if (verbSeq === undefined) {
        failures.push(
          `${item.entry}: verb ${verbEntry} was NEVER taught in Vocabulary, yet the pair ` +
            `unlocked (sequence #${pairSeq}) — the blockedBy gate did not hold`,
        );
      } else if (verbSeq >= pairSeq) {
        failures.push(
          `${item.entry}: verb ${verbEntry} taught in Vocabulary at sequence #${verbSeq}, ` +
            `which is NOT strictly before the pair's own lesson (sequence #${pairSeq})`,
        );
      }
    }
  }

  console.log(
    `\ntransitivity-vocab-order: ${items.length} curriculum pairs, ${checked} unlocked and ` +
      `checked, ${neverUnlocked.length} never unlocked in ${SIM.roundsRun} rounds (separate, ` +
      `already-tracked reachability gap — see interleaved-schedule.test.ts)` +
      (neverUnlocked.length ? `: ${neverUnlocked.join(", ")}` : ""),
  );

  assert.deepEqual(
    failures,
    [],
    `${failures.length}/${checked} unlocked pairs had a verb NOT already taught in Vocabulary ` +
      `first:\n${failures.join("\n")}`,
  );
});
