// "How it's going" — the ONE place the app turns its model into a word.
//
// WHY THIS IS A MODULE AND NOT A TERNARY IN A TABLE CELL
// =====================================================
// Every number the ranking model holds is banned from the screen. `stability`,
// `p` and `weakness` are predictions that read as history — the user's own
// question, of a real stability figure, was "does stability 106d mean I did it
// 106 days in a row?", and no caption fixes that. FactState's comment settles
// it: "These two numbers exist to order a list. The order is the only thing the
// user sees."
//
// But a reference page has to say SOMETHING per row, or you cannot tell the four
// readings you own from the five you don't, and the whole page becomes a
// dictionary. So this file is the licensed narrow gap: model in, one adjective
// out, in one place, so that what the app is willing to claim about you is a
// thing you can read in thirty lines rather than reconstruct from six screens.
//
// WHAT EACH WORD IS ALLOWED TO MEAN
// =================================
// Two sources, and they answer different questions:
//
//   scoring.status()  — what the app wants to DO with it (teach / probe / quiet).
//                       Sanctioned: "`status` is the seam". Carries no number.
//   accuracy          — what you actually DID. Already on screen all over the
//                       app, already honest, already a count over a count.
//
// The words come from the crossing, and each one is a claim the app can defend:
//
//   not seen       no counts, no claim .......... it has never asked you.
//   claimed        a claim, never tested ........ YOU skipped the lesson. Untested.
//   solid          ≥ 80% of recent runs ......... eight in ten or better.
//   getting there  ≥ 60% of recent runs ......... six in ten or better.
//   shaky          < 60% of recent runs .......... fewer than six in ten.
//   slipping       teach, but you HAVE seen it .. you had it. It's gone.
//
// WHY "solid" TAKES BOTH, AND NOT `quiet` ALONE
// =============================================
// `status` is a RECENCY reading — recall(now) — so it spikes to `quiet` the
// instant after any drill, however badly the drill went (see scoring.recall:
// zero elapsed → p ≈ 1). Reading "solid" off `quiet` alone was the bug: a fact
// the learner had just missed four times out of five read `quiet` (drilled
// seconds ago) and therefore "solid" — the app's own green light on a fact its
// own accuracy number, one column over, called 20%. So "solid" is now the
// CROSSING the header promised and did not deliver: the model expects you to
// recall it right now (`quiet`) AND your record backs that up (accuracy ≥
// SOLID_PCT). A recently-drilled fact with a poor record is `getting there` or
// `shaky`, which is what its accuracy already said. Recency alone can quiet a
// fact out of the drill list; it can no longer alone call it known.
//
// "slipping" is the interesting one and it is the one word here that could not
// be said without the model. `teach` at p → 0 means "never met, or lost — the
// model cannot tell, and needn't". The COUNTS can tell: a fact with showings
// behind it was met. So the pair says something neither says alone, and it says
// it without printing a probability.

import { accuracyOf } from "@/lib/accuracy";
import type { Claims } from "@/lib/claims";
import { effectiveState } from "@/lib/claims";
import { status } from "@/lib/scoring";
import type { FactAggregate, FactId } from "@/types";

export type Standing =
  | "not-seen"
  | "claimed"
  | "solid"
  | "getting-there"
  | "shaky"
  | "slipping";

/** The word itself. Lower case: these are adjectives in a sentence about a row,
 * not statuses in a workflow. */
export const STANDING_LABEL: Record<Standing, string> = {
  "not-seen": "not seen",
  // Was "you know this". A claim now means "I skipped the lesson", NOT "I know
  // it" (owner's intent — see claims.ts), so the chip states the ACT you took
  // and lets the app keep its own counsel about whether you know it: the app has
  // not tested you, and "claimed" says exactly that without agreeing or
  // disagreeing. FLAGGED for Sam — "untested", "skipped" and "taken as read"
  // were the other candidates; this is the small defensible pick, not a verdict.
  claimed: "claimed",
  solid: "solid",
  "getting-there": "getting there",
  shaky: "shaky",
  slipping: "slipping",
};

/**
 * The chip's tone. `warning` for slipping is deliberate and `danger` would be
 * wrong: slipping is not a failure, it is time passing, and it is the one thing
 * on the page that is nobody's fault.
 */
export const STANDING_TONE: Record<Standing, "good" | "warn" | "bad" | "mute"> = {
  "not-seen": "mute",
  claimed: "mute",
  solid: "good",
  "getting-there": "warn",
  shaky: "bad",
  slipping: "warn",
};

/** At least 60% of recent runs is "getting there". */
export const GETTING_THERE_PCT = 60;

/** At least 80% of recent runs is solid. */
export const SOLID_PCT = 80;

/** Score from the ten most recent completed runs containing this fact. A run
 * is one vote regardless of requeues within it. For shorter histories, the
 * percentage is calculated from the runs available. Histories from before the
 * rolling window was introduced fall back to their aggregate until stored
 * sessions backfill it. */
export function recentRunAccuracy(
  agg: FactAggregate | undefined,
): number | null {
  if (!agg) return null;
  const runs = agg.recentRuns;
  if (!runs?.length) return accuracyOf(agg);
  const hits = runs.filter((run) => run.eventually).length;
  return (100 * hits) / runs.length;
}

/** Everything this needs to know about a fact. Not a HistoryFile: a caller that
 * has already gathered a fact's record should not have to hand over the whole
 * file, and a function that takes the whole file gets read as if it could look
 * anything up. */
export interface FactStanding {
  readonly standing: Standing;
  /** Showings. 0 for anything you have never answered — including a claim,
   * which records no counts on purpose (see claims.ts). */
  readonly seen: number;
}

export function standingOf(
  agg: FactAggregate | undefined,
  claimedAt: number | undefined,
    now: number,
): FactStanding {
  const seen = agg?.seen ?? 0;
  const testedAt = agg?.lastTested ?? 0;
  const state = effectiveState(agg, claimedAt);
  const s = status(state, now);

  // A claim you have NEVER been tested on gets its own word, and it is checked
  // before anything the arithmetic would pick. It reports the ACT, not a
  // finding: the app has no evidence about you here, because you asked it to
  // skip the lesson rather than answer a quiz. Printing "solid" here would
  // launder your assertion into the app's finding, the exact move this file
  // exists to prevent — and the accuracy gate below would refuse it anyway,
  // since a claim writes no counts (accuracy is null) and cannot clear any bar.
  // `s !== "teach"` keeps a long-decayed claim from masquerading as still-fresh;
  // once its belief has decayed to "teach" it reads "not seen", as untested
  // material should.
  if (!seen && claimedAt && s !== "teach") return { standing: "claimed", seen };
  if (!seen) return { standing: "not-seen", seen };

  // A newer explicit claim over previously tested material is treated as the
  // learner deliberately marking it known now (the Clear now path in Results
  // uses this). The next real test can still move it back out of solid.
  if (claimedAt && claimedAt > testedAt) return { standing: "solid", seen };

  // A fact with showings behind it, lost to time: re-teach, not re-test.
  if (s === "teach") return { standing: "slipping", seen };

  const pct = recentRunAccuracy(agg);
  if (pct !== null && pct >= SOLID_PCT) {
    return { standing: "solid", seen };
  }
  return {
    standing: pct !== null && pct >= GETTING_THERE_PCT ? "getting-there" : "shaky",
    seen,
  };
}

/** Convenience over a whole history + claims map. */
export function standingFor(
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  fact: FactId,
    now: number,
): FactStanding {
  return standingOf(facts[fact], claims[fact], now);
}

// ---------- an ENTRY's standing, which is mostly a refusal ----------

/**
 * How an entry is going — as a COUNT, and as an adjective only when it honestly
 * has one.
 *
 * THE REFUSAL IS THE FEATURE. A tile wants a colour and a row wants a chip, and
 * the obvious way to get one for 生 is to average its nine readings. That is
 * forbidden, and not by taste: `decks.weakestEntries()` was DELETED for exactly
 * this, and its epitaph is the rule — "生 does not have a stability, it has
 * eleven. An entry's weakness could only be a mean of its facts' weaknesses — an
 * average of predictions, which is the same '61% true of nothing' the entry/fact
 * rekey exists to prevent." The same argument kills a mean of their STANDINGS,
 * which is just that average with the number filed off.
 *
 * So:
 *
 *   one fact  → the entry's standing IS that fact's standing. No pooling has
 *               happened, because there was nothing to pool. Every kana is here.
 *   many facts → NO ADJECTIVE. `standing` is null and the caller must print
 *                `needWork` of `total` instead — "4 need work", which is a count
 *                over a real population and says something an average cannot:
 *                WHICH parts of 生 are the problem is a question with an answer,
 *                one screen down.
 *
 * `standing: null` is deliberately awkward to render. A caller has to decide
 * what to say about a kanji, which is the decision this module refuses to make
 * on its behalf.
 */
export interface EntryStanding {
  /** The one fact's standing, or null when the entry has more than one. */
  readonly standing: Standing | null;
  /** Facts the model is not already sure of. A COUNT — it pools, legitimately. */
  readonly needWork: number;
  readonly total: number;
  /** Facts with any showings behind them. "7 seen, 11 in total". */
  readonly seen: number;
}

export function entryStanding(
  entryFacts: readonly FactId[],
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
    now: number,
): EntryStanding {
  let needWork = 0;
  let seen = 0;
  let only: Standing | null = null;
  for (const f of entryFacts) {
    const s = standingOf(facts[f], claims[f], now);
    if (s.seen > 0) seen++;
    if (s.standing !== "solid" && s.standing !== "claimed") needWork++;
    only = s.standing;
  }
  return {
    standing: entryFacts.length === 1 ? only : null,
    needWork,
    total: entryFacts.length,
    seen,
  };
}

/**
 * Is an entry KNOWN — the one boolean the Library's knowledge filter runs on?
 *
 * It reuses `entryStanding`, so it inherits the exact effective-progress and
 * claim resolution the tiles, rows and drills already use: an item marked
 * through "I already know this" counts, and a fact the app has proved counts.
 * There is deliberately no Library-only definition of known.
 *
 * KNOWN = every fact is solid or claimed (`needWork === 0`), over a real
 * population (`total > 0`). That is the ONE bar, and it never bends. What DOES
 * vary by kind is which facts the caller pools into that `entryStanding` in the
 * first place: `knownFactsOf` hands this all of a word's or kana's facts, but a
 * KANJI's meaning fact alone — the fact the curriculum teaches, claims and
 * displays as the character's standing (kanji-known.ts, and the entry page's
 * meaning chip). So a kanji is known when its meaning is, and everything else is
 * known only when every fact is. Not seen, slipping, shaky, getting there, or a
 * mix — over whichever facts define the entry — is NOT known, which is what the
 * "Not known" filter is for: the pile that still wants work.
 */
export function entryIsKnown(standing: EntryStanding): boolean {
  return standing.total > 0 && standing.needWork === 0;
}
