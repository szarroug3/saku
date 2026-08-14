// BUILD THE SCHEDULING DEV-VIEW PREVIEW — src/data/generated/scheduling-preview.json.
//
// WHY. /dev/scheduling exists so its owner can see the curriculum, track by
// track, in teach order — NOT a lesson-by-lesson simulation of what a single
// learner would actually be shown. `simulateLessons` (unit-tracks.ts) walks ONE
// track in total isolation from an empty history, so any unit `blockedBy`
// another track's progress (a keigo set behind its plain verb, a transitivity
// pair behind its two verbs) looks PERMANENTLY blocked — 8 of keigo's 9 sets
// never appear, because their gate verbs are only ever learned on the VOCAB
// track, which this isolated walk never simulates. That is correct for the real
// app (cross-track state is real there) but wrong for "show me the curriculum":
// this build binds the SAME scheduler core to a deps set that never blocks
// anything (`isLearned: () => true`), so every unit surfaces in its track's own
// order regardless of cross-track gates. Prereqs, cost/budget packing and the
// depth gate are untouched — only the blocking check is disabled.
//
// It is a dev-only page (gated to non-production), so bundle size is not a goal
// here — this precompute exists so the page renders fast, from data, without
// recomputing every track's full walk (vocab alone is ~480 lessons) on every
// visit. It carries the FULL unit shape (every type-specific display field),
// unlike src/data/generated/learn-index.json (the /learn scheduling-only
// precompute, which deliberately excludes glosses so the SHIPPED page stays off
// the dictionary). This file is never imported by /learn's page.
//
// BYTE-CORRECTNESS. The walk itself is the same verified core
// (unit-scheduler-core.ts) Phase 1 already proved correct; only the injected
// `isLearned` differs from the live app's. Nothing here re-derives scheduling
// logic — it reuses the real `contentResolvePrereq`/`isFactFresh`.
//
// Run with the test harness's loader so Node resolves `@/` and extensionless
// imports:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-scheduling-preview.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { UNIT_TRACKS } from "@/lib/content/unit-tracks";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { contentResolvePrereq } from "@/lib/content/unit-scheduler";
import { isFactFresh, nextTrackLessonCore } from "@/lib/content/unit-scheduler-core";

const MAX_LESSONS = 5000; // matches the dev page's own runaway guard

// The blocking gate disabled; everything else is the real content-backed core.
const IGNORE_BLOCKING_DEPS = {
  isFactFresh,
  resolvePrereq: contentResolvePrereq,
  isLearned: () => true,
};

function isUnitDue(unit, history) {
  return unit.facts.some((id) => isFactFresh(id, history));
}

/** simulateLessons (unit-tracks.ts), with blocking disabled — a track's WHOLE
 * curriculum in teach order, not one learner's isolated walk. */
function simulateCurriculum(track, range, maxLessons) {
  const lessons = [];
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

const tracks = UNIT_TRACKS.map((t) => ({
  id: t.id,
  title: t.title,
  lessons: simulateCurriculum(t, LESSON_RANGE_DEFAULT, MAX_LESSONS),
}));

const outPath = fileURLToPath(
  new URL("../src/data/generated/scheduling-preview.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify({ tracks }) + "\n");

console.log(
  `scheduling-preview.json written: ${tracks
    .map((t) => `${t.id}=${t.lessons.length}`)
    .join(", ")} lessons`,
);
