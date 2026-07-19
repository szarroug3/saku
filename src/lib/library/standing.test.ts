// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/standing.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// `entryIsKnown` is the one boolean the Library's knowledge filter runs on, and
// its whole promise is that it reuses the SAME progress-and-claims resolution
// the tiles already show — no Library-only definition of known. So these run it
// against real entry ids the app mints, through `entryStanding`, and check the
// three things the filter depends on:
//
//   an item you CLAIMED ("I already know this") counts as known, with no test
//   evidence behind it — the claim is the whole point of the feature;
//   an entry the app has never asked you is NOT known;
//   a MULTI-fact entry is known only when EVERY fact is, never on a partial.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { claimedState } from "@/lib/claims";
import type { Claims } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { LIB_ENTRIES } from "@/lib/library/entries";
import { entryIsKnown, entryStanding } from "@/lib/library/standing";
import type { AccuracyMetric, EntryId, FactAggregate, FactId } from "@/types";

const METRIC: AccuracyMetric = "firstTry";
const NOW = Date.UTC(2026, 0, 1);
/** A claim made a moment ago — recent enough to still be `quiet` (never asked),
 * which is what makes its standing "claimed" and thus known. */
const JUST_NOW = NOW - 1000;

/** No facts, no claims — the state of a brand-new user. */
const NO_FACTS: Record<FactId, FactAggregate> = {};
const NO_CLAIMS: Claims = {};

/** One real entry of each shape the filter has to get right. A kana is a single
 * fact; a kanji carries several readings. */
const kana = LIB_ENTRIES.find((e) => e.kind === KANA_SUBJECT)!;
const kanji = LIB_ENTRIES.find(
  (e) => e.kind === KANJI_SUBJECT && factsOf(e.id).length > 1,
)!;

/** Claim every one of an entry's facts, as "I already know this" would. */
function claimAll(entryId: EntryId): Claims {
  const claims: Claims = {};
  for (const f of factsOf(entryId)) claims[f] = JUST_NOW;
  return claims;
}

describe("entryIsKnown — the knowledge filter's one boolean", () => {
  test("a never-seen entry is NOT known", () => {
    const s = entryStanding(factsOf(kana.id), NO_FACTS, NO_CLAIMS, METRIC, NOW);
    assert.equal(entryIsKnown(s), false);
  });

  test("a claimed single-fact entry IS known — a claim counts, with no test behind it", () => {
    const s = entryStanding(
      factsOf(kana.id),
      NO_FACTS,
      claimAll(kana.id),
      METRIC,
      NOW,
    );
    assert.equal(s.seen, 0, "a claim records no showings");
    assert.equal(entryIsKnown(s), true);
  });

  test("a multi-fact entry is known only when EVERY fact is claimed", () => {
    const facts = factsOf(kanji.id);
    assert.ok(facts.length > 1, "need a multi-fact entry for this case");

    // All but one claimed: still not known — the one unclaimed reading is work.
    const partial: Claims = {};
    for (const f of facts.slice(1)) partial[f] = JUST_NOW;
    const partialStanding = entryStanding(facts, NO_FACTS, partial, METRIC, NOW);
    assert.equal(partialStanding.needWork, 1);
    assert.equal(entryIsKnown(partialStanding), false);

    // Every fact claimed: known.
    const whole = entryStanding(facts, NO_FACTS, claimAll(kanji.id), METRIC, NOW);
    assert.equal(whole.needWork, 0);
    assert.equal(entryIsKnown(whole), true);
  });

  test("a solid tested fact IS known — evidence works the same as a claim", () => {
    // A real, well-stabilised test occasion: `quiet`, so the entry reads solid.
    const state = claimedState(JUST_NOW); // same shape as a strong tested state
    const facts: Record<FactId, FactAggregate> = {};
    for (const f of factsOf(kana.id)) {
      facts[f] = {
        stability: state.stability,
        lastTested: state.lastTested,
        seen: 4,
        missed: 0,
        slow: 0,
        firstTry: 4,
        correct: 4,
      };
    }
    const s = entryStanding(factsOf(kana.id), facts, NO_CLAIMS, METRIC, NOW);
    assert.equal(entryIsKnown(s), true);
  });

  test("an entry with no facts at all is never known", () => {
    // total === 0 must not read as \"all zero facts are solid\" — there is
    // nothing to know, so the honest answer is not-known.
    assert.equal(entryIsKnown({ standing: null, needWork: 0, total: 0, seen: 0 }), false);
  });
});
