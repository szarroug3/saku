// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/stats/tally.test.ts
//
// WHAT THIS PINS
// ==============
// SAK-60 reverses an earlier, deliberate design choice: the coverage bars on
// /stats (knowledge-base.tsx's hero card and by-subject.tsx's per-subject
// rows) used to draw a bar whose full width was only what you had MET, with
// untouched material represented nowhere in the bar itself. Sam's call is that
// the bar should instead scale against the WHOLE population, with an
// untouched remainder segment — even though at real corpus scale (thousands
// of kanji/words, ~3% typical coverage) that remainder is most of the bar and
// the colour segments are a small sliver. That is the accepted tradeoff, not
// a bug; see by-subject.tsx's and knowledge-base.tsx's header comments.
//
// `barSegments` in tally.ts is the one function both components now go
// through to build a bar's segments, so it is the one place this needs
// pinning:
//
//   1. At low coverage, the coloured segments' combined width is
//      proportionally small next to the total, not the whole bar.
//   2. The untouched segment never carries a status colour — not `mute`,
//      not anything in TONE_FILL — because "haven't met it" is not a
//      condition of memory the way solid/shaky/slipping/claimed are.
//   3. When there's nothing untouched (total fully held), no untouched
//      segment is added at all, so a fully-covered subject's bar is not
//      quietly padded with an invisible sliver.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  barSegments,
  fillFor,
  TONE_FILL,
  UNTOUCHED_FILL,
} from "@/components/stats/tally";
import type { Tally } from "@/components/stats/tally";

/** A tally with everything at zero except what's overridden — the population
 * this stats page is drawn from never sees `not-seen` counted directly (see
 * tally.ts), so tests build tallies the same way tallyFacts does: only the
 * five held buckets ever carry a real count here. */
function tally(overrides: Partial<Tally>): Tally {
  return {
    "not-seen": 0,
    claimed: 0,
    solid: 0,
    "getting-there": 0,
    shaky: 0,
    slipping: 0,
    ...overrides,
  };
}

test("at low real-world coverage, the coloured portion is a small slice of the total, not the whole bar", () => {
  // The brief's own example: 5 of 214 kana known.
  const t = tally({ solid: 5 });
  const segments = barSegments(t, 214);

  const colouredWidth = segments
    .filter((s) => s.bucket !== "not-seen")
    .reduce((n, s) => n + s.flex, 0);
  const totalWidth = segments.reduce((n, s) => n + s.flex, 0);

  assert.equal(colouredWidth, 5);
  assert.equal(totalWidth, 214);
  // The coloured slice is a small fraction of the bar, not something close to
  // full width — this is the exact behaviour the old design avoided and the
  // new one accepts.
  assert.ok(colouredWidth / totalWidth < 0.05);

  // And there IS an untouched segment carrying the remainder, so the bar
  // actually renders mostly-empty rather than mostly-coloured.
  const untouched = segments.find((s) => s.bucket === "not-seen");
  assert.ok(untouched, "expected a not-seen segment at partial coverage");
  assert.equal(untouched?.flex, 209);
});

test("the not-seen segment never carries a status colour", () => {
  const t = tally({ solid: 3, shaky: 2, slipping: 1 });
  const segments = barSegments(t, 1000);
  const untouched = segments.find((s) => s.bucket === "not-seen");

  assert.ok(untouched);
  assert.equal(untouched?.fill, UNTOUCHED_FILL);
  // Belt and braces: whatever UNTOUCHED_FILL is, it must not collide with any
  // of the real status fills, including the one `fillFor("not-seen")` itself
  // would produce (STANDING_TONE spends "mute" on not-seen for the chip/label
  // case, which is a different rendering than a bar segment).
  assert.ok(!Object.values(TONE_FILL).includes(untouched!.fill));
  assert.notEqual(untouched?.fill, fillFor("not-seen"));
});

test("every non-not-seen segment uses its bucket's real status fill", () => {
  const t = tally({ solid: 3, shaky: 2, slipping: 1, claimed: 4 });
  const segments = barSegments(t, 50);

  for (const seg of segments) {
    if (seg.bucket === "not-seen") continue;
    assert.equal(seg.fill, fillFor(seg.bucket));
    assert.notEqual(seg.fill, UNTOUCHED_FILL);
  }
});

test("buckets with a zero count produce no segment", () => {
  const t = tally({ solid: 5 });
  const segments = barSegments(t, 214);
  const buckets = segments.map((s) => s.bucket);

  assert.deepEqual(
    buckets.filter((b) => b !== "not-seen"),
    ["solid"],
  );
});

test("full coverage adds no untouched segment", () => {
  const t = tally({ solid: 10, shaky: 4 });
  const segments = barSegments(t, 14);

  assert.ok(!segments.some((s) => s.bucket === "not-seen"));
  assert.equal(
    segments.reduce((n, s) => n + s.flex, 0),
    14,
  );
});

test("a total smaller than what's held (a caller bug) shows no negative-width segment", () => {
  const t = tally({ solid: 10 });
  const segments = barSegments(t, 3);

  assert.ok(!segments.some((s) => s.bucket === "not-seen"));
  assert.ok(segments.every((s) => s.flex >= 0));
});
