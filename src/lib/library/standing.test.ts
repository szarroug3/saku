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
import { KANJI_SUBJECT, meaningFactId } from "@/data/kanji";
import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { claimedState } from "@/lib/claims";
import type { Claims } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { knownFactsOf, LIB_ENTRIES } from "@/lib/library/entries";
import {
  entryIsKnown,
  entryStanding,
  GETTING_THERE_PCT,
  SOLID_PCT,
  standingOf,
} from "@/lib/library/standing";
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

const DAY = 86_400_000;
const MIN = 60_000;

/** A fact tested `justNow`, so recall ≈ 1 and status is `quiet` — the recency
 * spike that used to read "solid" on its own. `firstTry`/`seen` set the record
 * the accuracy gate now weighs. */
function drilledJustNow(
  counts: { seen: number; missed: number; firstTry: number; correct: number },
  at: number,
): FactAggregate {
  return { ...counts, stability: 30, lastTested: at };
}

describe("standingOf — 'solid' takes accuracy, not just recency", () => {
  const NOW_T = Date.UTC(2026, 5, 1);
  const METRIC_S: AccuracyMetric = "firstTry";

  test("the bug: heavily-missed but drilled just now is NOT solid", () => {
    // The exact probe from the task: seen 3, missed 4, correct 1, firstTry 1,
    // last tested = now. Recency says `quiet`; the record says 1/3 = 33%.
    const agg = drilledJustNow(
      { seen: 3, missed: 4, firstTry: 1, correct: 1 },
      NOW_T,
    );
    const s = standingOf(agg, undefined, METRIC_S, NOW_T);
    assert.notEqual(s.standing, "solid", "recency must not launder into solid");
    assert.equal(s.standing, "shaky", "33% first-try is shaky");
  });

  test("a claim then a NEWER miss reflects the miss, not the claim — NOT solid", () => {
    // Claimed at T; a real quiz session misses it four minutes later. Built
    // through the actual fold so the newer-record path is the one under test.
    const claimedAt = NOW_T;
    const missAt = NOW_T + 4 * MIN;
    const agg = emptyAggregate();
    foldSession(
      agg,
      { seen: 1, missed: 1, firstTry: 0, correct: 0, firstTryHit: false },
      missAt,
    );
    assert.ok(agg.lastTested > claimedAt, "the miss is the newer record");
    const s = standingOf(agg, claimedAt, METRIC_S, missAt);
    assert.notEqual(s.standing, "solid");
    assert.equal(s.standing, "shaky", "0% first-try, claim discarded");
  });

  test("genuinely good accuracy, still fresh, IS solid — evidence earns the word", () => {
    const agg = drilledJustNow(
      { seen: 10, missed: 0, firstTry: 10, correct: 10 },
      NOW_T,
    );
    assert.equal(standingOf(agg, undefined, METRIC_S, NOW_T).standing, "solid");
  });

  test("a claimed-but-never-tested fact reads 'claimed' — neutral, untested", () => {
    // No aggregate at all (a claim writes no counts), claimed a moment ago.
    const s = standingOf(undefined, NOW_T - 1000, METRIC_S, NOW_T);
    assert.equal(s.standing, "claimed");
    assert.equal(s.seen, 0, "a claim records no showings");
  });

  test("good accuracy gone cold is NOT solid — it still surfaces for review", () => {
    // 100% first-try, but last tested 60 days ago at low stability: recall → 0,
    // so it re-enters as material to re-teach. Unchanged by this work: solid was
    // never available to a non-quiet fact, and must not become so.
    const agg: FactAggregate = {
      seen: 8,
      missed: 0,
      firstTry: 8,
      correct: 8,
      stability: 5,
      lastTested: NOW_T - 60 * DAY,
    };
    const s = standingOf(agg, undefined, METRIC_S, NOW_T);
    assert.notEqual(s.standing, "solid");
    assert.equal(s.standing, "slipping", "seen before, now lost → re-teach");
  });

  test("quiet + middling accuracy is 'getting there', not solid", () => {
    // 70% first-try: mostly right, but short of SOLID_PCT. The band the fix
    // opened — this used to read solid purely because it was quiet.
    const agg = drilledJustNow(
      { seen: 10, missed: 3, firstTry: 7, correct: 8 },
      NOW_T,
    );
    assert.equal(
      standingOf(agg, undefined, METRIC_S, NOW_T).standing,
      "getting-there",
    );
  });

  test("SOLID_PCT is the boundary: at it reads solid, just under does not", () => {
    assert.ok(SOLID_PCT > GETTING_THERE_PCT, "solid must sit above getting-there");
    const at = drilledJustNow(
      { seen: 100, missed: 0, firstTry: SOLID_PCT, correct: 100 },
      NOW_T,
    );
    assert.equal(standingOf(at, undefined, METRIC_S, NOW_T).standing, "solid");
    const under = drilledJustNow(
      { seen: 100, missed: 0, firstTry: SOLID_PCT - 1, correct: 100 },
      NOW_T,
    );
    assert.equal(
      standingOf(under, undefined, METRIC_S, NOW_T).standing,
      "getting-there",
    );
  });
});

describe("standingOf — the latest ten runs define the accuracy label", () => {
  const withRuns = (hits: number): FactAggregate => ({
    ...drilledJustNow(
      { seen: 100, missed: 90, firstTry: 10, correct: 10 },
      NOW,
    ),
    recentRuns: Array.from({ length: 10 }, (_, i) => ({
      firstTry: i < hits,
      eventually: i < hits,
    })),
  });

  test("8+ is solid, despite poor all-time accuracy", () => {
    assert.equal(standingOf(withRuns(8), undefined, METRIC, NOW).standing, "solid");
  });

  test("6–7 is getting there", () => {
    assert.equal(
      standingOf(withRuns(6), undefined, METRIC, NOW).standing,
      "getting-there",
    );
    assert.equal(
      standingOf(withRuns(7), undefined, METRIC, NOW).standing,
      "getting-there",
    );
  });

  test("fewer than 6 is shaky", () => {
    assert.equal(standingOf(withRuns(5), undefined, METRIC, NOW).standing, "shaky");
  });

  test("short histories use the percentage of available runs", () => {
    const short = (hits: number, runs: number): FactAggregate => ({
      ...drilledJustNow(
        {
          seen: runs,
          missed: runs - hits,
          firstTry: hits,
          correct: hits,
        },
        NOW,
      ),
      recentRuns: Array.from({ length: runs }, (_, i) => ({
        firstTry: i < hits,
        eventually: i < hits,
      })),
    });
    assert.equal(standingOf(short(1, 1), undefined, METRIC, NOW).standing, "solid");
    assert.equal(standingOf(short(4, 5), undefined, METRIC, NOW).standing, "solid");
    assert.equal(
      standingOf(short(3, 5), undefined, METRIC, NOW).standing,
      "getting-there",
    );
    assert.equal(standingOf(short(2, 5), undefined, METRIC, NOW).standing, "shaky");
  });
});

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

// The kanji exception: the filter runs over `knownFactsOf`, which is a kanji's
// MEANING fact alone — the fact the entry page shows as the character's standing
// and the lesson claims. So a kanji whose meaning is known reads Known on the
// shelf too, and readings it has never met no longer hold it back. The other
// kinds keep the all-facts bar: an unclaimed fact still means not known.
describe("knownFactsOf — the filter agrees with the entry page for a kanji", () => {
  const word = LIB_ENTRIES.find(
    (e) => e.kind !== KANA_SUBJECT && e.kind !== KANJI_SUBJECT && factsOf(e.id).length > 1,
  )!;

  test("a kanji's known-facts are its meaning fact alone", () => {
    // What the entry page reads for the meaning chip, and what the filter must
    // run on, are provably the same fact.
    assert.deepEqual(knownFactsOf(kanji), [meaningFactId(kanji.glyph)]);
    assert.ok(factsOf(kanji.id).length > 1, "the kanji still has many facts");
  });

  test("a kanji with only its MEANING claimed IS known — readings unseen don't hold it back", () => {
    const claims: Claims = { [meaningFactId(kanji.glyph)]: JUST_NOW };
    const s = entryStanding(knownFactsOf(kanji), NO_FACTS, claims, METRIC, NOW);
    assert.equal(entryIsKnown(s), true);
  });

  test("a kanji with NOTHING claimed is NOT known", () => {
    const s = entryStanding(knownFactsOf(kanji), NO_FACTS, NO_CLAIMS, METRIC, NOW);
    assert.equal(entryIsKnown(s), false);
  });

  test("a multi-fact NON-kanji with an unclaimed fact is still NOT known", () => {
    // A word keeps the all-facts bar: claim all but one of its facts and it must
    // still fail Known, because for a word every fact is curriculum.
    const facts = knownFactsOf(word);
    assert.ok(facts.length > 1, "need a multi-fact non-kanji");
    const partial: Claims = {};
    for (const f of facts.slice(1)) partial[f] = JUST_NOW;
    const s = entryStanding(facts, NO_FACTS, partial, METRIC, NOW);
    assert.equal(entryIsKnown(s), false);
  });

  test("a kana with its one fact unclaimed is NOT known", () => {
    const s = entryStanding(knownFactsOf(kana), NO_FACTS, NO_CLAIMS, METRIC, NOW);
    assert.equal(entryIsKnown(s), false);
  });
});
