import { cache } from "react";

import { timed, timedSync } from "@/lib/server-timing";
import "server-only";

// The Supabase backend for a user's progress. Reads and writes the JSON blobs —
// history and settings — as jsonb columns on that user's single `progress`
// row. Every call runs through the request-bound server
// client, so RLS confines it to the caller's own row; `userId` is passed for the
// explicit `.eq` and the upsert key, never to reach across users (RLS would
// refuse that anyway).
//
// These are the primitives history.ts / settings.ts call in Supabase mode, in
// place of the local file read/write. The read-modify-write LOGIC stays in those
// files; this only moves where the blob lives. Unset columns are left untouched
// on upsert, so writing history never disturbs settings and vice versa.
//
// The row also carries a `lists` column and a `session` column, neither of
// which anything reads or writes any more (SAK-375, SAK-376). Neither is
// selected below, and neither is part of ProgressSeedRow.

import { hydrateRecentRuns } from "@/lib/aggregate";
import { normalizeHistoryShell, withBackfilledLearnedAt } from "@/lib/history-ops";
import type { VersionedRead } from "@/lib/history-mutate";
import { normalizeSettings } from "@/lib/settings-merge";
import type { SettingsVersionedRead } from "@/lib/settings-mutate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FactAggregate, FactId, HistoryFile, SettingsFile } from "@/types";

export interface ProgressSeedRow {
  history: HistoryFile;
  settings: SettingsFile;
}

/**
 * The stored row plus the facts table, as one history.
 *
 * Split from the read so the two can be fetched at the same time (SAK-382).
 * They are independent — the facts table is keyed by the user, not by anything
 * in the row — but they used to run one after the other, because the second
 * was buried inside normalising the first. On a cold function that was two
 * sequential round trips to a database that answers in about a second.
 *
 * THE FACTS COME FROM THE TABLE, AND ONLY THE TABLE (SAK-405). The `facts`
 * key still sitting in the `history` jsonb used to be merged under this one
 * — the migration window's belt and braces, from when progress_facts might
 * not exist yet. It does exist, and it is where every fold has landed since
 * SAK-237, so reading the blob half could only ever return something older
 * than the row beside it. The key itself is not cleared here: that is
 * `clear_legacy_history_facts`'s job, called per user by
 * scripts/backfill-progress-facts.mjs once that user's copy has landed, and
 * two things clearing one key on two schedules is worse than one.
 */
function shapeHistory(raw: unknown, tableFacts: Record<FactId, FactAggregate>): HistoryFile {
  const h = (raw ?? {}) as Partial<HistoryFile>;
  const sessions = Array.isArray(h.sessions) ? h.sessions : [];
  // Backfill learnedAt best-effort so every server read carries a populated map
  // (existing entries win — see withBackfilledLearnedAt). This is where legacy
  // history predating the field gets its first-learned stamps derived.
  return withBackfilledLearnedAt({
    sessions,
    facts: hydrateRecentRuns(tableFacts, sessions),
    claims: h.claims ?? {},
    seen: h.seen ?? {},
    ...(h.learnedAt ? { learnedAt: h.learnedAt } : {}),
    ...(h.clearedMixups ? { clearedMixups: h.clearedMixups } : {}),
  });
}

/**
 * A learner's whole progress row and facts table, read ONCE per request
 * (SAK-382). The shell's seeds (root layout) and the page's history read the
 * same rows, and each was making its own two round trips, the facts table
 * twice over: at 8,000 facts that is two reads of four megabytes for one
 * page. React's `cache` scopes this to the request, so whichever of the two
 * asks first pays, and the other waits on the same promise (they render
 * concurrently, so it is usually a wait, not a free ride). Outside a request
 * (a script, a test) `cache` does nothing and each call reads.
 *
 * The row and the facts table at the same time, not one after the other:
 * reading the history once measured 1550 ms on a cold function, a 1240 ms
 * query and then a second round trip to progress_facts hidden inside
 * normalising the first. Nothing in the second depends on the first.
 */
const readProgress = cache(async (userId: string) => {
  const supabase = await timed("db:client", () => createSupabaseServerClient(), "making the database client");
  const [row, facts] = await Promise.all([
    timed("db:query", async () => await supabase
      .from("progress")
      .select("history, settings")
      .eq("user_id", userId)
      .maybeSingle(), "selecting the progress row"),
    timed("db:facts", () => readFactsTable(userId), "selecting the facts table"),
  ]);
  if (row.error) throw new Error(`reading progress failed: ${row.error.message}`);
  return { data: row.data, facts };
});

export async function readProgressSeedRow(
  userId: string,
): Promise<ProgressSeedRow> {
  const { data, facts } = await readProgress(userId);
  return {
    history: shapeHistory(data?.history, facts),
    settings: normalizeSettings(data?.settings),
  };
}

export async function readHistoryRow(userId: string): Promise<HistoryFile> {
  const { data, facts } = await readProgress(userId);
  return timedSync("db:shape", () => shapeHistory(data?.history, facts), "shaping the history");
}

export async function writeHistoryRow(userId: string, hist: HistoryFile): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, history: hist, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`writing progress.history failed: ${error.message}`);
}

/**
 * The LEGACY-ONLY normalizer: `facts` comes straight from the jsonb column,
 * with no `progress_facts` lookup. Deliberately NOT the same as
 * `normalizeHistory` above — but the actual repair-a-corrupt-blob shell IS
 * shared (SAK-251): see `normalizeHistoryShell` in history-ops.ts, which
 * local-progress.ts's signed-out reader also calls.
 *
 * Used by `readHistoryRowVersioned` — the read half of the generic
 * compare-and-set `saveClaims`/`saveSeen`/`dropSeen`/`clearMixup` mutators in
 * history.ts, none of which ever read or write `.facts` (see history-ops.ts:
 * applyClaims/applySeen/applyDropSeen/applyClearMixup). Merging in the table
 * here would cost an extra query those callers get no use from, AND — for
 * `saveSession`/`dropClaims`/`deleteSessions`'s own pre-migration FALLBACK
 * branch (see history.ts), which still calls the original whole-document pure
 * ops (applySession/applyDropClaims/applyDeleteSessions) — a merged value would
 * be the wrong thing to fold onto: those ops must see the SAME legacy blob
 * they always have, untouched, so the fallback path behaves exactly as it did
 * before SAK-237.
 */
function normalizeHistoryLegacyOnly(raw: unknown): HistoryFile {
  return normalizeHistoryShell((raw ?? {}) as Partial<HistoryFile>);
}

/**
 * A versioned read of the history row, for the compare-and-set write below. The
 * `updated_at` is the concurrency token: a write only lands if the row still
 * carries the value seen here (see history-mutate.ts). `maybeSingle` returns null
 * for a user with no row yet, which reads as an empty history and `exists: false`.
 */
export async function readHistoryRowVersioned(userId: string): Promise<VersionedRead> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("history, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.history failed: ${error.message}`);
  return {
    history: normalizeHistoryLegacyOnly(data?.history),
    version: (data?.updated_at as string | null | undefined) ?? null,
    exists: data != null,
  };
}

/** Postgres unique-violation (a row inserted concurrently under the same
 * user_id). Not an error to surface — it is the "someone beat me to the first
 * write" signal, handled as a CAS miss. */
function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

/**
 * Write the history ONLY if the row still carries `expected` — optimistic
 * concurrency, so two overlapping writes cannot clobber each other. Returns true
 * when it landed, false when a concurrent writer moved the token first.
 *
 * The new `updated_at` is forced strictly greater than the one we guarded on, so
 * even two writes landing in the same millisecond leave DISTINCT tokens: after
 * the first commits, the second's guard cannot still match the value it read, so
 * the second is reliably detected as a miss and retried (Postgres re-checks the
 * WHERE against the freshly committed row under READ COMMITTED). No integer
 * version column, and so no schema migration, is needed.
 */
export async function writeHistoryRowGuarded(
  userId: string,
  hist: HistoryFile,
  expected: VersionedRead,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  // No row yet: INSERT. A row that appeared since our read violates the user_id
  // uniqueness, which is precisely the CAS miss we retry on.
  if (!expected.exists) {
    const { error } = await supabase
      .from("progress")
      .insert({ user_id: userId, history: hist, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress.history failed: ${error.message}`);
    }
    return true;
  }

  // Row exists: UPDATE guarded on the token. `.select` reports the affected rows,
  // so zero rows means the guard did not match — a concurrent writer got there
  // first. A legacy row with a null token is guarded with `.is`, not `.eq`.
  const base = supabase
    .from("progress")
    .update({ history: hist, updated_at: nextTs })
    .eq("user_id", userId);
  const guarded =
    expected.version == null
      ? base.is("updated_at", null)
      : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress.history failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// ---------- progress_facts (SAK-237) ----------
//
// One row per (user_id, fact_id) instead of one entry in `progress.history`'s
// `facts` blob — see supabase/schema.sql for the schema and the full
// rationale (moved there from scripts/sql in SAK-379, so one file describes
// the whole database).
//
// THE MIGRATION WINDOW IS OVER (SAK-405). Every primitive below used to catch
// a Postgres 42P01 ("relation does not exist") and report it as
// `migrated: false`, so history.ts could fall back to the pre-SAK-237
// whole-document behaviour rather than erroring every save if this code
// shipped ahead of the SQL. It did not ship ahead of it: the table is there
// and it has held every fold since. So the flag is gone, the fallbacks are
// gone, and a missing table is what it should have become the day after the
// migration landed — an error, loudly, rather than a silent slide back onto a
// document that has been stale ever since.

/** ALL of a user's fact rows, assembled into the map shape `HistoryFile.facts`
 * has always had. Used only by the full-document reads (readHistoryRow /
 * readProgressSeedRow) that the app's initial load needs the complete picture
 * for — NOT by any mutator, which would defeat the point of this table. */
export async function readFactsTable(
  userId: string,
): Promise<Record<FactId, FactAggregate>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress_facts")
    .select("fact_id, aggregate")
    .eq("user_id", userId);
  if (error) throw new Error(`reading progress_facts failed: ${error.message}`);
  const facts: Record<FactId, FactAggregate> = {};
  for (const row of data ?? []) {
    facts[row.fact_id as FactId] = row.aggregate as FactAggregate;
  }
  return facts;
}

/** A versioned read of ONE fact row — the fold-and-CAS-retry unit `saveSession`
 * (history.ts) builds on. `aggregate: null` + `exists: false` is a fact this
 * table has never seen (not yet backfilled, or genuinely new). */
export interface FactRowVersioned {
  aggregate: FactAggregate | null;
  version: string | null;
  exists: boolean;
}

/**
 * Versioned reads for a SET of fact ids — the ones one quiz session actually
 * touched, never the learner's whole history. An id with no row comes back as
 * the not-exists default, which is what a fact this table has never seen is.
 */
export async function readFactRowsVersioned(
  userId: string,
  factIds: FactId[],
): Promise<Map<FactId, FactRowVersioned>> {
  const rows = new Map<FactId, FactRowVersioned>();
  for (const id of factIds) rows.set(id, { aggregate: null, version: null, exists: false });
  if (factIds.length === 0) return rows;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress_facts")
    .select("fact_id, aggregate, updated_at")
    .eq("user_id", userId)
    .in("fact_id", factIds);
  if (error) throw new Error(`reading progress_facts failed: ${error.message}`);
  for (const row of data ?? []) {
    rows.set(row.fact_id as FactId, {
      aggregate: row.aggregate as FactAggregate,
      version: (row.updated_at as string | null) ?? null,
      exists: true,
    });
  }
  return rows;
}

/** The same versioned read, narrowed to one fact — used to re-read after a
 * lost CAS (see fact-store.ts's retry loop). */
export async function readFactRowVersioned(
  userId: string,
  factId: FactId,
): Promise<FactRowVersioned> {
  const rows = await readFactRowsVersioned(userId, [factId]);
  return rows.get(factId) ?? { aggregate: null, version: null, exists: false };
}

/**
 * Write one fact's aggregate ONLY if the row still carries `expected` —
 * optimistic concurrency scoped to a SINGLE fact instead of a learner's whole
 * history, which is the entire point of SAK-237: two sessions folding
 * DIFFERENT facts never contend with each other at all, and two folding the
 * SAME fact serialize on one small row instead of the whole document.
 *
 * Same insert-vs-update-guarded-on-token shape as writeHistoryRowGuarded, and
 * the same reasoning for forcing the new token strictly past the one guarded
 * on. Returns false (never throws) for a genuine CAS miss; throws for anything
 * else.
 */
export async function writeFactRowGuarded(
  userId: string,
  factId: FactId,
  aggregate: FactAggregate,
  expected: FactRowVersioned,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  if (!expected.exists) {
    const { error } = await supabase
      .from("progress_facts")
      .insert({ user_id: userId, fact_id: factId, aggregate, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress_facts failed: ${error.message}`);
    }
    return true;
  }

  const base = supabase
    .from("progress_facts")
    .update({ aggregate, updated_at: nextTs })
    .eq("user_id", userId)
    .eq("fact_id", factId);
  const guarded =
    expected.version == null ? base.is("updated_at", null) : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress_facts failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Delete specific fact rows outright — no read, no fold, just the rows a
 * dropped claim named (see history.ts's dropClaims / SAK-103's "withdrawing a
 * claim also forgets what quizzing it proved").
 */
export async function deleteFactRows(
  userId: string,
  factIds: FactId[],
): Promise<void> {
  if (factIds.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress_facts")
    .delete()
    .eq("user_id", userId)
    .in("fact_id", factIds);
  if (error) throw new Error(`deleting progress_facts rows failed: ${error.message}`);
}

/** Wipe every fact row for a user — resetAll's full-history-reset counterpart. */
export async function deleteAllFactRows(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("progress_facts").delete().eq("user_id", userId);
  if (error) throw new Error(`deleting progress_facts rows failed: ${error.message}`);
}

/**
 * Replace a user's ENTIRE fact table with `facts` — delete-all then bulk
 * insert. Used only by deleteSessions' rebuild-from-surviving-sessions, which
 * is inherently a whole-account operation (an explicit, rare user action, not
 * the per-answer hot path SAK-237 targets) bounded by the 200-session cap
 * rather than lifetime fact count.
 */
export async function replaceAllFactRows(
  userId: string,
  facts: Record<FactId, FactAggregate>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase.from("progress_facts").delete().eq("user_id", userId);
  if (deleteError) throw new Error(`deleting progress_facts rows failed: ${deleteError.message}`);
  const entries = Object.entries(facts);
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  const rows = entries.map(([factId, aggregate]) => ({
    user_id: userId,
    fact_id: factId,
    aggregate,
    updated_at: now,
  }));
  const { error: insertError } = await supabase.from("progress_facts").insert(rows);
  if (insertError) throw new Error(`writing progress_facts rows failed: ${insertError.message}`);
}

// The `settings` jsonb is the second live blob on the row, beside `history`.
// It is defined in supabase/schema.sql (SAK-253) and inherits the row's
// existing RLS (which scopes every read/write to `user_id`), so no new
// policy is needed. Same read-modify-write split as history: the MERGE
// logic lives in settings.ts, this only moves the blob to and from the row, and
// an unset `settings` column reads as the empty (all-default) settings.
//
// SAK-258: the plain upsert this used to be (load -> merge -> write the WHOLE
// blob back, unconditionally) had no concurrency guard at all — the same gap
// SAK-220 closed for the lists column. readSettingsRowVersioned /
// writeSettingsRowGuarded
// below are the CAS pair settings.ts's mutateSettingsWithRetry runs its
// read-modify-write through, so two overlapping writes serialize instead of
// racing. The old unguarded writeSettingsRow is gone so no unprotected path
// survives.

export async function readSettingsRow(userId: string): Promise<SettingsFile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.settings failed: ${error.message}`);
  return normalizeSettings(data?.settings);
}

/**
 * A versioned read of the settings row, for the compare-and-set write below.
 * The twin of readHistoryRowVersioned over the `settings` column, guarded on
 * the SAME `updated_at` token as history, right, because it is the same row: a
 * history write landing mid-flight costs a settings retry, never a lost field.
 */
export async function readSettingsRowVersioned(
  userId: string,
): Promise<SettingsVersionedRead> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("settings, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.settings failed: ${error.message}`);
  return {
    settings: normalizeSettings(data?.settings),
    version: (data?.updated_at as string | null | undefined) ?? null,
    exists: data != null,
  };
}

/**
 * Write the settings ONLY if the row still carries `expected` — the same
 * optimistic concurrency writeHistoryRowGuarded uses, applied to the column
 * that never had it. Returns true when it landed, false
 * when a concurrent writer moved the token first.
 *
 * Without this, two devices changing DIFFERENT settings in the same window
 * each read the same row, each wrote back their own full merged copy, and the
 * later write silently overwrote the earlier device's field with no error
 * shown on either device. See settings-mutate.ts for the retry that turns a
 * `false` here into a merge.
 *
 * The new `updated_at` is forced strictly greater than the one we guarded on,
 * so two writes landing in the same millisecond still leave DISTINCT tokens
 * and the second is reliably detected as a miss (identical reasoning to
 * history's).
 */
export async function writeSettingsRowGuarded(
  userId: string,
  settings: SettingsFile,
  expected: SettingsVersionedRead,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  // No row yet: INSERT. A row that appeared since our read violates the user_id
  // uniqueness, which is precisely the CAS miss we retry on.
  if (!expected.exists) {
    const { error } = await supabase
      .from("progress")
      .insert({ user_id: userId, settings, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress.settings failed: ${error.message}`);
    }
    return true;
  }

  // Row exists: UPDATE guarded on the token. `.select` reports the affected
  // rows, so zero rows means the guard did not match. A legacy row with a null
  // token is guarded with `.is`, not `.eq`.
  const base = supabase
    .from("progress")
    .update({ settings, updated_at: nextTs })
    .eq("user_id", userId);
  const guarded =
    expected.version == null
      ? base.is("updated_at", null)
      : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress.settings failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
