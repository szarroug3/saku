// SCHEDULING DEV-VIEW PREVIEW LOADER — the precomputed twin of
// UNIT_TRACKS/simulateLessons, for /dev/scheduling only.
//
// Reads scheduling-preview.json instead of calling simulateLessons live: the
// FULL simulated lesson set (vocab alone is ~477 lessons), with every
// type-specific display field intact (meanings, patterns, verb pairs, …) — the
// dev page's whole point is to show the real thing, in full detail. Unlike
// learn-index.ts (the /learn scheduling-only precompute), this carries content
// on purpose; it is dev-only (gated to non-production) and never imported by a
// shipped route.
//
// Equivalence with the live path is asserted by
// scheduling-preview.equiv.test.ts.

import schedulingPreviewJson from "@/data/generated/scheduling-preview.json" with { type: "json" };
import type { SimulatedLesson } from "./unit-tracks";

interface SchedulingPreviewTrack {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly SimulatedLesson[];
}

interface SchedulingPreview {
  readonly tracks: readonly SchedulingPreviewTrack[];
}

const PREVIEW = schedulingPreviewJson as unknown as SchedulingPreview;

/** Every track's full simulated lesson walk, precomputed. */
export const SCHEDULING_PREVIEW_TRACKS: readonly SchedulingPreviewTrack[] = PREVIEW.tracks;
