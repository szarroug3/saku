// SAK-237 — one-time backfill: copy every learner's `progress.history.facts`
// (the legacy whole-document blob) into the new per-row `progress_facts` table
// (see supabase/schema.sql, which defines it).
//
// RUN THIS IMMEDIATELY AFTER applying that schema, in the same
// maintenance window — see schema.sql's own "ROLLOUT ORDER" note for
// why the gap between "table exists" and "data copied" is not fully safe on
// its own (a fact touched for the first time in that gap starts its
// stability/recentRuns over instead of continuing from what was already known).
//
// SKIP-IF-ALREADY-THERE, NOT OVERWRITE. Uses `ON CONFLICT (user_id, fact_id) DO
// NOTHING`: if a learner's session already folded a fact into `progress_facts`
// after the migration landed but before this ran, that fold is STRICTLY newer
// than the legacy snapshot and must win — this backfill only fills gaps, never
// clobbers forward progress. Re-running it is therefore harmless (idempotent):
// every fact it already copied is skipped on the next pass.
//
// CLEARS THE LEGACY BLOB, PER USER, ONLY AFTER ITS COPY LANDS. Once a user's
// facts are in progress_facts, the copy still sitting in `progress.history`'s
// `facts` key is dead weight that every OTHER write to that row (a claim, a
// seen mark, a session append) would otherwise keep carrying over the wire
// for no reason — see history.ts's meta-only writes, which pass that key
// through untouched. Cleared via the `clear_legacy_history_facts` SQL function
// (see the migration file), which touches ONLY that one jsonb key and so
// cannot clobber a concurrent write to `sessions`/`claims`/`seen` on the same
// row. Skipped for a user with no legacy facts to begin with (nothing to
// clear) and — in --dry-run — reported but not called.
//
// Writes with the SERVICE ROLE key (bypasses RLS), because this touches every
// learner's row, not one request-scoped user.
//
// Run with:
//   node --env-file=.env.local scripts/backfill-progress-facts.mjs
// Add --dry-run to report counts without writing anything.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "backfill-progress-facts: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY not set — run with --env-file=.env.local",
  );
}

const DRY_RUN = process.argv.includes("--dry-run");
const PAGE_SIZE = 200;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Every `progress` row's user_id + history.facts, paginated so a large table
 * never loads into memory at once. */
async function* progressRows() {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("progress")
      .select("user_id, history")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`reading progress failed: ${error.message}`);
    if (!data || data.length === 0) return;
    yield* data;
    if (data.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

/** Copy one user's legacy facts into progress_facts (one call per user rather
 * than a cross-user batch — this is a one-time background script, not the
 * per-answer hot path, so the extra round trips are not a concern, and they
 * are what let each user's copy-then-clear be judged independently below). */
async function upsertUserFacts(userId, entries) {
  if (DRY_RUN) return;
  const now = new Date().toISOString();
  const rows = entries.map(([factId, aggregate]) => ({
    user_id: userId,
    fact_id: factId,
    aggregate,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("progress_facts")
    .upsert(rows, { onConflict: "user_id,fact_id", ignoreDuplicates: true });
  if (error) throw new Error(`writing progress_facts for ${userId} failed: ${error.message}`);
}

/** See the migration file: touches ONLY the jsonb `facts` key, so it cannot
 * clobber a concurrent write to `sessions`/`claims`/`seen` on the same row. */
async function clearLegacyFacts(userId) {
  if (DRY_RUN) return;
  const { error } = await supabase.rpc("clear_legacy_history_facts", { p_user_id: userId });
  if (error) throw new Error(`clearing legacy facts for ${userId} failed: ${error.message}`);
}

async function main() {
  let usersSeen = 0;
  let usersWithFacts = 0;
  let factsCopied = 0;

  for await (const row of progressRows()) {
    usersSeen++;
    const facts = row.history?.facts;
    if (!facts || typeof facts !== "object") continue;
    const entries = Object.entries(facts);
    if (entries.length === 0) continue;
    usersWithFacts++;
    factsCopied += entries.length;

    await upsertUserFacts(row.user_id, entries);
    // Only clear the legacy copy once ITS upsert above has actually landed —
    // upsertUserFacts throws (aborting the whole run) on any failure, so
    // reaching this line means this user's facts are durably in the table.
    await clearLegacyFacts(row.user_id);
  }

  console.log(
    `${DRY_RUN ? "[dry run] " : ""}scanned ${usersSeen} progress rows, ` +
      `${usersWithFacts} had facts, ${factsCopied} fact rows ${DRY_RUN ? "would be" : "were"} upserted ` +
      `and their legacy copy ${DRY_RUN ? "would be" : "was"} cleared ` +
      `(any progress_facts rows already there — e.g. from a session saved after the migration but before this ran — were left untouched)`,
  );
}

await main();
