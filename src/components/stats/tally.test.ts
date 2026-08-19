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
  BUCKETS,
  factsByStanding,
  fillFor,
  groupEntriesByStanding,
  tallyFacts,
  TONE_FILL,
  UNTOUCHED_FILL,
} from "@/components/stats/tally";
import type { Tally } from "@/components/stats/tally";
import type { Claims } from "@/lib/claims";
import type { EntryId, FactAggregate, FactId } from "@/types";

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

// SAK-78: `factsByStanding` is `tallyFacts`'s own walk, kept as fact ids
// instead of counted. The click-through breakdown panel is only honest if
// this can never disagree with `tallyFacts` — a bucket's count and the list
// behind it coming from two independently-derived answers is exactly the kind
// of drift SAK-22 already had to reconcile once for a different pair of
// counts on this same page (see mix-ups.tsx). These tests pin that the two
// functions agree on the same input, not just that each individually looks
// right.

const NOW = 1_700_000_000_000;

test("factsByStanding's bucket sizes match tallyFacts's counts for the same input", () => {
  const facts = ["fact:a", "fact:b", "fact:c", "fact:d"] as FactId[];
  const aggregates: Record<FactId, FactAggregate> = {
    // Recently tested, high accuracy → solid.
    ["fact:a" as FactId]: {
      seen: 5,
      lastTested: NOW,
      recentRuns: [true, true, true, true, true],
    } as unknown as FactAggregate,
  };
  const claims: Claims = {
    // Claimed and never tested → claimed.
    ["fact:b" as FactId]: NOW,
  };
  // fact:c and fact:d have neither an aggregate nor a claim → not-seen.

  const t = tallyFacts(facts, aggregates, claims, NOW);
  const byBucket = factsByStanding(facts, aggregates, claims, NOW);

  for (const bucket of Object.keys(t) as (keyof Tally)[]) {
    assert.equal(
      byBucket[bucket].length,
      t[bucket],
      `bucket "${bucket}": factsByStanding's list length must equal tallyFacts's count`,
    );
  }
});

test("factsByStanding partitions every input fact into exactly one bucket", () => {
  const facts = ["fact:a", "fact:b", "fact:c"] as FactId[];
  const byBucket = factsByStanding(facts, {}, {}, NOW);

  const seen = Object.values(byBucket).flat();
  assert.deepEqual([...seen].sort(), [...facts].sort());
  // Untested, unclaimed facts land in not-seen and nowhere else.
  assert.deepEqual([...byBucket["not-seen"]].sort(), [...facts].sort());
  for (const bucket of ["claimed", "solid", "getting-there", "shaky", "slipping"] as const) {
    assert.deepEqual(byBucket[bucket], []);
  }
});

// SAK-78 (round 5): "the side panel should separate by status ... ordered
// ... claimed → solid → …". `groupEntriesByStanding` is the one place an
// entry (not a fact) gets sorted into a standing bucket for display — see its
// header comment in tally.ts for the full reasoning and the documented
// tension with by-subject.tsx's "an entry is never given a standing" rule.
// These tests pin the three load-bearing behaviours: BUCKETS order, "best
// standing among an entry's facts wins", and "a met entry can never end up in
// no section at all".

test("groupEntriesByStanding orders sections in BUCKETS order and drops empty buckets", () => {
  const entries = ["entry:solid", "entry:claimed", "entry:shaky"] as EntryId[];
  const entryFacts = new Map<EntryId, FactId[]>([
    ["entry:solid" as EntryId, ["fact:solid" as FactId]],
    ["entry:claimed" as EntryId, ["fact:claimed" as FactId]],
    ["entry:shaky" as EntryId, ["fact:shaky" as FactId]],
  ]);
  const aggregates: Record<FactId, FactAggregate> = {
    // stability: 30, lastTested: NOW → recall ≈ 1 → status `quiet`, so the
    // standing comes from accuracy alone (5/5 = 100% → solid).
    ["fact:solid" as FactId]: {
      seen: 5,
      correct: 5,
      stability: 30,
      lastTested: NOW,
    } as unknown as FactAggregate,
    // Same recency, 1/5 = 20% accuracy → shaky (below GETTING_THERE_PCT).
    ["fact:shaky" as FactId]: {
      seen: 5,
      correct: 1,
      stability: 30,
      lastTested: NOW,
    } as unknown as FactAggregate,
  };
  const claims: Claims = { ["fact:claimed" as FactId]: NOW };

  const groups = groupEntriesByStanding(
    entries,
    (e) => entryFacts.get(e) ?? [],
    aggregates,
    claims,
    NOW,
  );

  assert.deepEqual(
    groups.map((g) => g.standing),
    // Only the buckets actually present, but in BUCKETS's own order —
    // "getting-there" and "slipping" have nothing in them here and are
    // absent, not present-and-empty.
    (["claimed", "solid", "shaky"] as const).filter((b) => BUCKETS.includes(b)),
  );
  assert.deepEqual(groups.find((g) => g.standing === "solid")?.entries, ["entry:solid"]);
  assert.deepEqual(groups.find((g) => g.standing === "claimed")?.entries, ["entry:claimed"]);
  assert.deepEqual(groups.find((g) => g.standing === "shaky")?.entries, ["entry:shaky"]);
});

test("an entry with facts in multiple standings groups under its best (BUCKETS-order) standing", () => {
  // One fact solid, one fact shaky, on the SAME entry — the case
  // by-subject.tsx's own header comment uses 生's nine readings for.
  const entries = ["entry:mixed"] as EntryId[];
  const entryFacts = new Map<EntryId, FactId[]>([
    ["entry:mixed" as EntryId, ["fact:a" as FactId, "fact:b" as FactId]],
  ]);
  const aggregates: Record<FactId, FactAggregate> = {
    ["fact:a" as FactId]: {
      seen: 5,
      correct: 1,
      stability: 30,
      lastTested: NOW,
    } as unknown as FactAggregate, // 20% → shaky
    ["fact:b" as FactId]: {
      seen: 5,
      correct: 5,
      stability: 30,
      lastTested: NOW,
    } as unknown as FactAggregate, // 100% → solid
  };

  const groups = groupEntriesByStanding(
    entries,
    (e) => entryFacts.get(e) ?? [],
    aggregates,
    {},
    NOW,
  );

  assert.deepEqual(
    groups.map((g) => g.standing),
    ["solid"],
  );
  assert.deepEqual(groups[0]?.entries, ["entry:mixed"]);
});

test("a met entry whose only record is a decayed claim groups as claimed, never disappears into not-seen", () => {
  // No seen fact at all — the entry is only "met" via a claim, and that claim
  // is old enough that standingOf alone would call the fact not-seen (the
  // decay standing.ts documents: "once its belief has decayed to teach it
  // reads not seen"). groupEntriesByStanding's job is to keep this entry
  // inside a section anyway, since it WAS counted as met.
  const entries = ["entry:old-claim"] as EntryId[];
  const entryFacts = new Map<EntryId, FactId[]>([
    ["entry:old-claim" as EntryId, ["fact:old-claim" as FactId]],
  ]);
  const claimedAt = NOW;
  const farFuture = NOW + 10 * 365 * 24 * 60 * 60 * 1000; // 10 years later
  const claims: Claims = { ["fact:old-claim" as FactId]: claimedAt };

  const groups = groupEntriesByStanding(
    entries,
    (e) => entryFacts.get(e) ?? [],
    {},
    claims,
    farFuture,
  );

  // Every met entry lands in exactly one section — never silently dropped.
  const allGrouped = groups.flatMap((g) => g.entries);
  assert.deepEqual(allGrouped, ["entry:old-claim"]);
  assert.deepEqual(
    groups.map((g) => g.standing),
    ["claimed"],
  );
});
