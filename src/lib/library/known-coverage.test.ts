// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/library/known-coverage.test.ts
//
// THE GAP interleaved-schedule.test.ts CANNOT SEE. That file checks whether the
// SCHEDULER can eventually reach a unit — a question about `unit-tracks.ts` and
// `nextTrackLesson`. This file checks a completely different question: once a
// learner HAS claimed everything there is to claim, does the Library's
// Known/Not-known filter (`knownFactsOf` → `entryStanding` → `entryIsKnown`,
// standing.ts) actually recognize that? A kind whose `knownFactsOf` always
// returns `[]` fails this silently — `entryStanding`'s `total > 0` guard means
// `entryIsKnown` can NEVER be true for it, no matter what's claimed, and
// nothing about that shows up in a scheduling test. This is exactly how the
// sentence-rule bug shipped invisibly: its marker fact
// (`sentenceTierMarkerFact`) really was being claimed on completion, but
// `knownFactsOf` never looked for it — see the fix in `entries.ts`.
//
// WHAT "EVERYTHING CLAIMABLE" MEANS HERE. Not just `ALL_FACTS` — that registry
// deliberately excludes track-local markers like `sentenceTierMarkerFact`
// (documented in `sentence-ordering-progress.ts` as "intentionally not a
// registered quiz fact"), so a claim set built from `ALL_FACTS` alone would
// have hidden the exact bug this file exists to catch. Every extra claimable
// surface the app has gets added here explicitly, by name, so a FUTURE one
// (another track-local marker, another special case) doesn't silently repeat
// the same shape of bug — grep this file for "extra claimable surfaces" when
// adding one.

import assert from "node:assert/strict";
import test from "node:test";

import { LIB_ENTRIES, KINDS } from "@/lib/library/entries";
import { knownFactsOf } from "@/lib/library/library-index";
import { entryStanding, entryIsKnown } from "@/lib/library/standing";
import { ALL_FACTS } from "@/lib/facts";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import type { FactId } from "@/types";

// ---- extra claimable surfaces (not in ALL_FACTS) ----------------------------
const EXTRA_CLAIMABLE: readonly FactId[] = SENTENCE_ORDERING_TIERS.map((t) =>
  sentenceTierMarkerFact(t.id),
);

const now = Date.now();
const claims: Record<FactId, number> = {};
for (const f of ALL_FACTS) claims[f] = now - 1000;
for (const f of EXTRA_CLAIMABLE) claims[f] = now - 1000;

/** Kinds that are genuinely reference/explanatory content with no learnable
 * fact behind them — `knownFactsOf` returning `[]` for every one of their
 * entries is accepted as-is, not a bug. This is a documented product decision
 * (see docs/interleaved-schedule-findings.md's "Known, partially-intentional
 * design wrinkle"), not an oversight: a "Not known" filter that can never
 * clear for these is the honest answer for content that was never meant to be
 * quizzed. If this list ever needs to grow, that is itself worth a second
 * look before just adding to it — it is the allowlist for "we accept this
 * gap," not a place to silence a new, real regression. */
const ACCEPTED_UNKNOWABLE_KINDS: ReadonlySet<string> = new Set([
  "term",
  "grammar-concept",
  "writing-rule",
  "primitive",
]);

test("every kind NOT on the accepted-unknowable list has SOME entry that can become known", () => {
  // "Some", not "every" — a kind can have a few genuinely-unaskable stragglers
  // (transitivity's unaskable distractor side, keigo sets blocked on a curriculum
  // gap) without the kind itself being structurally broken. What this catches is
  // the sentence-rule shape: 100% of a kind's entries permanently stuck despite
  // everything claimable being claimed — a systemic bug, not a scattered gap.
  const byKind = new Map<string, { total: number; known: number }>();
  for (const entry of LIB_ENTRIES) {
    const facts = knownFactsOf(entry.id);
    const standing = entryStanding(facts, {}, claims, now);
    const known = entryIsKnown(standing);
    const bucket = byKind.get(entry.kind) ?? { total: 0, known: 0 };
    bucket.total++;
    if (known) bucket.known++;
    byKind.set(entry.kind, bucket);
  }

  const fullyStuck: string[] = [];
  for (const [kind, b] of byKind) {
    if (ACCEPTED_UNKNOWABLE_KINDS.has(kind)) continue;
    if (b.known === 0 && b.total > 0) fullyStuck.push(`${kind}: 0/${b.total} known`);
  }
  assert.deepEqual(
    fullyStuck,
    [],
    "one or more kinds NOT on the accepted-unknowable list have ZERO entries that can ever " +
      "be known, even with everything claimable claimed — knownFactsOf is returning [] " +
      "(or an unclaimable fact) for every entry of that kind, the same shape of bug the " +
      "sentence-rule marker-fact mismatch was",
  );
});

test("the accepted-unknowable list is exactly right — no more, no less", () => {
  // Every KINDS entry not on the list must have knownFactsOf return non-empty
  // for AT LEAST one of its entries (the positive check above already covers
  // this more precisely); this test instead catches the list itself drifting
  // stale — a kind added to ACCEPTED_UNKNOWABLE_KINDS that didn't actually need
  // it (masking a fixable bug, same as sentence-rule was silently doing before
  // its fix) shows up here as "actually knowable, remove it from the list".
  for (const kind of ACCEPTED_UNKNOWABLE_KINDS) {
    const entries = LIB_ENTRIES.filter((e) => e.kind === kind);
    assert.ok(entries.length > 0, `${kind} is on the accepted-unknowable list but has no entries at all`);
    const anyKnown = entries.some((e) =>
      entryIsKnown(entryStanding(knownFactsOf(e.id), {}, claims, now)),
    );
    assert.equal(
      anyKnown,
      false,
      `${kind} is on the accepted-unknowable list, but at least one of its entries CAN become ` +
        `known with everything claimed — the list is stale, or a fix already landed and the ` +
        `kind should be removed from ACCEPTED_UNKNOWABLE_KINDS`,
    );
  }
  // Every kind the app has must be accounted for one way or the other.
  const seen = new Set(LIB_ENTRIES.map((e) => e.kind));
  for (const kind of KINDS) {
    assert.ok(seen.has(kind) || ACCEPTED_UNKNOWABLE_KINDS.has(kind), `KINDS lists "${kind}" but no entry has that kind`);
  }
});
