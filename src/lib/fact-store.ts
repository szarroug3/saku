import "server-only";

// SAK-237 — fold a quiz session's touched facts into their OWN rows
// (progress_facts), with the same "a concurrent writer cannot silently lose
// your fold" guarantee history-mutate.ts gives the whole document, but scoped
// to one fact at a time so two sessions touching DIFFERENT facts never contend
// with each other at all.
//
// This is the module history.ts's saveSession delegates to once it has
// confirmed (via a `migrated` flag from store/supabase-store.ts) that
// progress_facts exists — see that file for the pre-migration fallback that
// keeps the OLD whole-document fold working when it does not.

import { emptyAggregate, foldSession } from "@/lib/aggregate";
import {
  readFactRowVersioned,
  writeFactRowGuarded,
  type FactRowVersioned,
} from "@/lib/store/supabase-store";
import type { FactAggregate, FactId, SessionFactCounts } from "@/types";

/** How many times ONE fact's write may lose its compare-and-set before giving
 * up. Bounded well below history's MAX_HISTORY_WRITE_ATTEMPTS (history-mutate.
 * ts) — contention on a single fact_id, from two sessions racing to fold the
 * SAME fact at the same instant, is rarer still than contention on a whole
 * account's row, which is itself rare enough to bound at 5. */
export const MAX_FACT_WRITE_ATTEMPTS = 3;

/**
 * Fold `delta` into `factId`'s aggregate at time `ts`, retrying against a
 * fresh read on a lost CAS. `initial`, when given, is an already-in-hand
 * versioned read (from the batch read saveSession does for every touched fact
 * up front) so the common, uncontended case costs zero extra reads beyond
 * that one batch — a re-read only happens after an actual miss.
 */
export async function upsertFoldedFact(
  userId: string,
  factId: FactId,
  delta: Partial<SessionFactCounts>,
  ts: number,
  initial?: FactRowVersioned,
): Promise<void> {
  let current = initial ?? (await readFactRowVersioned(userId, factId));
  for (let attempt = 1; attempt <= MAX_FACT_WRITE_ATTEMPTS; attempt++) {
    const agg: FactAggregate = current.aggregate
      ? structuredClone(current.aggregate)
      : emptyAggregate();
    foldSession(agg, delta, ts);
    if (await writeFactRowGuarded(userId, factId, agg, current)) return;
    // Lost the CAS to a concurrent writer of the SAME fact — re-read their
    // result and fold onto it, exactly as history-mutate.ts does for the
    // whole document, just scoped to this one row.
    current = await readFactRowVersioned(userId, factId);
  }
  throw new Error(
    `fact write for user ${userId} / fact ${factId} lost to concurrent writers ${MAX_FACT_WRITE_ATTEMPTS} times`,
  );
}

/** Fold every touched fact in a session, in parallel — each fact is an
 * independent row, so there is no reason to serialize one fact's retry loop
 * behind another's. `initial` is the batch read saveSession already did for
 * every touched id (see readFactRowsVersioned), reused here to skip a
 * redundant read in the common uncontended case. */
export async function upsertSessionFacts(
  userId: string,
  touched: [FactId, SessionFactCounts][],
  ts: number,
  initial: Map<FactId, FactRowVersioned>,
): Promise<void> {
  await Promise.all(
    touched.map(([factId, delta]) =>
      upsertFoldedFact(userId, factId, delta, ts, initial.get(factId)),
    ),
  );
}
