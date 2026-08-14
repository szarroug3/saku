// THE SAFETY NET for scheduling-preview.json — its walk deliberately IGNORES
// blockedBy (see build-scheduling-preview.mjs's header for why), so it is not
// compared against simulateLessons (which respects it and legitimately produces
// fewer lessons for a blocked track like keigo). Instead this test rebuilds the
// exact same ignore-blocking walk here, independently, from the same verified
// core (unit-scheduler-core.ts) and real content deps, and asserts the
// precomputed JSON matches it byte-for-byte.

import { test } from "node:test";
import assert from "node:assert/strict";

import { UNIT_TRACKS } from "@/lib/content/unit-tracks";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { contentResolvePrereq } from "@/lib/content/unit-scheduler";
import { isFactFresh, nextTrackLessonCore } from "@/lib/content/unit-scheduler-core";
import { SCHEDULING_PREVIEW_TRACKS } from "@/lib/content/scheduling-preview";
import type { TeachingUnit, UnitLesson } from "@/lib/content/teach-unit";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { HistoryFile } from "@/types";

const MAX_LESSONS = 5000;

const IGNORE_BLOCKING_DEPS = {
  isFactFresh,
  resolvePrereq: contentResolvePrereq,
  isLearned: () => true,
};

function isUnitDue(unit: TeachingUnit, history: HistoryFile): boolean {
  return unit.facts.some((id) => isFactFresh(id, history));
}

function simulateCurriculum(
  track: (typeof UNIT_TRACKS)[number],
  range: LessonRange,
  maxLessons: number,
): { n: number; units: UnitLesson["units"] }[] {
  const lessons: { n: number; units: UnitLesson["units"] }[] = [];
  let history = emptyHistory();
  let ts = 1;
  const order = track.units(history);
  let cursor = 0;
  for (let n = 1; n <= maxLessons; n++) {
    const lesson = nextTrackLessonCore(order, history, range, IGNORE_BLOCKING_DEPS, cursor);
    if (!lesson) break;
    lessons.push({ n, units: lesson.units });
    const facts = lesson.units.flatMap((u) => u.facts);
    history = applyClaims(history, facts, ts++);
    while (cursor < order.length && !isUnitDue(order[cursor], history)) cursor++;
  }
  return lessons;
}

test("scheduling-preview tracks match UNIT_TRACKS, in order", () => {
  assert.equal(SCHEDULING_PREVIEW_TRACKS.length, UNIT_TRACKS.length);
  for (let i = 0; i < UNIT_TRACKS.length; i++) {
    assert.equal(SCHEDULING_PREVIEW_TRACKS[i].id, UNIT_TRACKS[i].id, `track ${i} id`);
    assert.equal(SCHEDULING_PREVIEW_TRACKS[i].title, UNIT_TRACKS[i].title, `track ${i} title`);
  }
});

for (const track of UNIT_TRACKS) {
  test(`scheduling-preview matches the ignore-blocking walk — ${track.id}`, () => {
    const expected = simulateCurriculum(track, LESSON_RANGE_DEFAULT, MAX_LESSONS);
    const pre = SCHEDULING_PREVIEW_TRACKS.find((t) => t.id === track.id)!.lessons;
    assert.deepEqual(pre, expected);
  });
}

// The specific bug this whole change fixes: keigo has 9 sets, 8 of them
// blockedBy a plain verb the isolated walk never learns, so the OLD
// simulateLessons-based preview showed only 1 lesson / 1 unit. Assert all 9
// keigo units now surface, regardless of blocking.
test("keigo shows every unit, not just the unblocked one", () => {
  const keigo = SCHEDULING_PREVIEW_TRACKS.find((t) => t.id === "keigo")!;
  const totalUnits = keigo.lessons.reduce((n, l) => n + l.units.length, 0);
  assert.equal(totalUnits, 9);
});
