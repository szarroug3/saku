import { timed } from "@/lib/server-timing";
import "server-only";

// The Supabase backend for a user's progress. Reads and writes the two JSON
// blobs — history and lists — as jsonb columns on that user's single `progress`
// row. Every call runs through the request-bound server client, so RLS confines
// it to the caller's own row; `userId` is passed for the explicit `.eq` and the
// upsert key, never to reach across users (RLS would refuse that anyway).
//
// These are the primitives history.ts / lists.ts call in Supabase mode, in place
// of the local file read/write. The read-modify-write LOGIC stays in those
// files; this only moves where the blob lives. Unset columns are left untouched
// on upsert, so writing history never disturbs lists and vice versa.

import {
  normalizeEnvelope,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { hydrateRecentRuns } from "@/lib/aggregate";
import { normalizeHistoryShell, withBackfilledLearnedAt } from "@/lib/history-ops";
import type { VersionedRead } from "@/lib/history-mutate";
import type { ListsVersionedRead } from "@/lib/lists-mutate";
import { normalizeSettings } from "@/lib/settings-merge";
import type { SettingsVersionedRead } from "@/lib/settings-mutate";
import type { SessionVersionedRead } from "@/lib/session-mutate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FactAggregate, FactId, HistoryFile, ListsFile, SettingsFile } from "@/types";

export interface ProgressSeedRow {
  history: HistoryFile;
  settings: SettingsFile;
  session: SessionStateEnvelope;
  lists: ListsFile;
}

/**
 * Merge the legacy jsonb `facts` (whatever `progress.history.facts` still
 * carries — a full learner's history predating SAK-237, or a fact this account
 * has not been touched since it moved to `progress_facts`) with the per-row
 * table's contents, table WINNING on any key both sides have.
 *
 * Both sides only need to disagree on a key while a learner is mid-migration:
 * before scripts/backfill-progress-facts.mjs runs, the table is empty and this
 * is a pure passthrough of the legacy blob; after it runs (and thereafter, as
 * saveSession/dropClaims/deleteSessions/resetAll write ONLY to the table — see
 * history.ts), the table is authoritative for anything it has an entry for.
 */
function mergeFacts(
  legacy: Record<FactId, FactAggregate>,
  table: Record<FactId, FactAggregate>,
): Record<FactId, FactAggregate> {
  return { ...legacy, ...table };
}

async function normalizeHistory(raw: unknown, userId: string): Promise<HistoryFile> {
  const h = (raw ?? {}) as Partial<HistoryFile>;
  const sessions = Array.isArray(h.sessions) ? h.sessions : [];
  const { facts: tableFacts } = await readFactsTable(userId);
  const merged = mergeFacts((h.facts ?? {}) as Record<FactId, FactAggregate>, tableFacts);
  // Backfill learnedAt best-effort so every server read carries a populated map
  // (existing entries win — see withBackfilledLearnedAt). This is where legacy
  // history predating the field gets its first-learned stamps derived.
  return withBackfilledLearnedAt({
    sessions,
    facts: hydrateRecentRuns(merged, sessions),
    claims: h.claims ?? {},
    seen: h.seen ?? {},
    ...(h.learnedAt ? { learnedAt: h.learnedAt } : {}),
    ...(h.clearedMixups ? { clearedMixups: h.clearedMixups } : {}),
  });
}

export async function readProgressSeedRow(
  userId: string,
): Promise<ProgressSeedRow> {
  const supabase = await timed("seed:client", () => createSupabaseServerClient(), "making the database client");
  const { data, error } = await timed("seed:query", async () => await supabase
    .from("progress")
    .select("history, settings, session, lists")
    .eq("user_id", userId)
    .maybeSingle(), "selecting the whole progress row");
  if (error) throw new Error(`reading progress seed failed: ${error.message}`);
  const rawLists = (data?.lists ?? {}) as Partial<ListsFile> | null;
  return {
    history: await normalizeHistory(data?.history, userId),
    settings: normalizeSettings(data?.settings),
    session: normalizeEnvelope(data?.session),
    lists: { lists: rawLists?.lists ?? [] },
  };
}

export async function readHistoryRow(userId: string): Promise<HistoryFile> {
  // Split three ways on purpose (SAK-382). "Reading the history" measured
  // 755 ms of a 1778 ms response on the deployed app, and that one number
  // covers making a client, a query over the network, and normalising what
  // comes back over a learner's whole record. They want different fixes.
  const supabase = await timed("db:client", () => createSupabaseServerClient(), "making the database client");
  const { data, error } = await timed("db:query", async () => await supabase
    .from("progress")
    .select("history")
    .eq("user_id", userId)
    .maybeSingle(), "selecting the history row");
  if (error) throw new Error(`reading progress.history failed: ${error.message}`);
  return timed("db:normalise", async () => await normalizeHistory(data?.history, userId), "normalising the history");
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
// `facts` blob — see scripts/sql/add-progress-facts-table.sql for the schema
// and the full rationale. Every primitive below is written to be safe to call
// BEFORE that migration is applied: a Postgres 42P01 ("relation does not
// exist") is caught and reported through a `migrated: false` result (or, for
// the void-returning deletes, simply swallowed — there is nothing to delete
// from a table that is not there yet) rather than thrown, so history.ts's
// callers can fall back to the pre-SAK-237 whole-document behaviour instead of
// erroring every save in production the moment this code ships ahead of the
// SQL.

/** Postgres "relation does not exist" — thrown by every query below until
 * scripts/sql/add-progress-facts-table.sql has been applied. */
function isUndefinedTable(error: { code?: string }): boolean {
  return error.code === "42P01";
}

/** ALL of a user's fact rows, assembled into the map shape `HistoryFile.facts`
 * has always had. Used only by the full-document reads (readHistoryRow /
 * readProgressSeedRow) that the app's initial load needs the complete picture
 * for — NOT by any mutator, which would defeat the point of this table. */
export async function readFactsTable(
  userId: string,
): Promise<{ facts: Record<FactId, FactAggregate>; migrated: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress_facts")
    .select("fact_id, aggregate")
    .eq("user_id", userId);
  if (error) {
    if (isUndefinedTable(error)) return { facts: {}, migrated: false };
    throw new Error(`reading progress_facts failed: ${error.message}`);
  }
  const facts: Record<FactId, FactAggregate> = {};
  for (const row of data ?? []) {
    facts[row.fact_id as FactId] = row.aggregate as FactAggregate;
  }
  return { facts, migrated: true };
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
 * touched, never the learner's whole history. `migrated: false` means the
 * table does not exist yet; callers must not trust the (empty) map in that
 * case and should fall back to the whole-document path instead.
 */
export async function readFactRowsVersioned(
  userId: string,
  factIds: FactId[],
): Promise<{ rows: Map<FactId, FactRowVersioned>; migrated: boolean }> {
  const rows = new Map<FactId, FactRowVersioned>();
  for (const id of factIds) rows.set(id, { aggregate: null, version: null, exists: false });
  if (factIds.length === 0) return { rows, migrated: true };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress_facts")
    .select("fact_id, aggregate, updated_at")
    .eq("user_id", userId)
    .in("fact_id", factIds);
  if (error) {
    if (isUndefinedTable(error)) return { rows, migrated: false };
    throw new Error(`reading progress_facts failed: ${error.message}`);
  }
  for (const row of data ?? []) {
    rows.set(row.fact_id as FactId, {
      aggregate: row.aggregate as FactAggregate,
      version: (row.updated_at as string | null) ?? null,
      exists: true,
    });
  }
  return { rows, migrated: true };
}

/** The same versioned read, narrowed to one fact — used to re-read after a
 * lost CAS (see fact-store.ts's retry loop). */
export async function readFactRowVersioned(
  userId: string,
  factId: FactId,
): Promise<FactRowVersioned> {
  const { rows } = await readFactRowsVersioned(userId, [factId]);
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
 * else, INCLUDING a still-missing table — a caller that got this far already
 * confirmed the table exists via an earlier `migrated` read this same request,
 * so a 42P01 here would mean the table disappeared mid-request, which is not a
 * condition to silently paper over.
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
 * claim also forgets what quizzing it proved"). Returns `migrated: false`
 * (and does nothing) when the table does not exist yet, so callers can fall
 * back to deleting the same keys out of the whole-document blob instead.
 */
export async function deleteFactRows(
  userId: string,
  factIds: FactId[],
): Promise<{ migrated: boolean }> {
  if (factIds.length === 0) return { migrated: true };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress_facts")
    .delete()
    .eq("user_id", userId)
    .in("fact_id", factIds);
  if (error) {
    if (isUndefinedTable(error)) return { migrated: false };
    throw new Error(`deleting progress_facts rows failed: ${error.message}`);
  }
  return { migrated: true };
}

/** Wipe every fact row for a user — resetAll's full-history-reset counterpart.
 * A missing table is simply nothing to clean up. */
export async function deleteAllFactRows(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("progress_facts").delete().eq("user_id", userId);
  if (error && !isUndefinedTable(error)) {
    throw new Error(`deleting progress_facts rows failed: ${error.message}`);
  }
}

/**
 * Replace a user's ENTIRE fact table with `facts` — delete-all then bulk
 * insert. Used only by deleteSessions' rebuild-from-surviving-sessions, which
 * is inherently a whole-account operation (an explicit, rare user action, not
 * the per-answer hot path SAK-237 targets) bounded by the 200-session cap
 * rather than lifetime fact count. Returns `migrated: false` when the table
 * does not exist, so the caller can fall back to writing `facts` into the
 * jsonb blob instead, exactly as it did before this table existed.
 */
export async function replaceAllFactRows(
  userId: string,
  facts: Record<FactId, FactAggregate>,
): Promise<{ migrated: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase.from("progress_facts").delete().eq("user_id", userId);
  if (deleteError) {
    if (isUndefinedTable(deleteError)) return { migrated: false };
    throw new Error(`deleting progress_facts rows failed: ${deleteError.message}`);
  }
  const entries = Object.entries(facts);
  if (entries.length === 0) return { migrated: true };
  const now = new Date().toISOString();
  const rows = entries.map(([factId, aggregate]) => ({
    user_id: userId,
    fact_id: factId,
    aggregate,
    updated_at: now,
  }));
  const { error: insertError } = await supabase.from("progress_facts").insert(rows);
  if (insertError) throw new Error(`writing progress_facts rows failed: ${insertError.message}`);
  return { migrated: true };
}

/** Cheap existence probe for the table, scoped to this user's rows so RLS
 * still applies — used by deleteSessions, which (unlike saveSession/
 * dropClaims) does not already know which fact ids it will touch before
 * computing the rebuild, so it cannot fold a targeted read into its normal
 * work the way those two do. */
export async function factsTableMigrated(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("progress_facts").select("user_id").eq("user_id", userId).limit(1);
  if (error) {
    if (isUndefinedTable(error)) return false;
    throw new Error(`checking progress_facts failed: ${error.message}`);
  }
  return true;
}

export async function readListsRow(userId: string): Promise<ListsFile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("lists")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.lists failed: ${error.message}`);
  const raw = (data?.lists ?? {}) as Partial<ListsFile> | null;
  return { lists: raw?.lists ?? [] };
}

/**
 * A versioned read of the lists row, for the compare-and-set write below. The
 * twin of readHistoryRowVersioned over the other column, and guarded on the SAME
 * `updated_at` token — right, because it is the same row: a history write
 * landing mid-flight costs a lists retry, never a lost list.
 */
export async function readListsRowVersioned(
  userId: string,
): Promise<ListsVersionedRead> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("lists, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.lists failed: ${error.message}`);
  const raw = (data?.lists ?? {}) as Partial<ListsFile> | null;
  return {
    lists: { lists: raw?.lists ?? [] },
    version: (data?.updated_at as string | null | undefined) ?? null,
    exists: data != null,
  };
}

/**
 * Write the lists ONLY if the row still carries `expected` — the same optimistic
 * concurrency writeHistoryRowGuarded uses, applied to the column that never had
 * it. Returns true when it landed, false when a concurrent writer moved the
 * token first.
 *
 * Without this, two devices signing in within the same second each replayed
 * their own local lists over a stale read, both got a 2xx, and both cleared
 * their local copy — the later write's lists were the only ones left. See
 * lists-mutate.ts for the retry that turns a `false` here into a merge.
 *
 * The new `updated_at` is forced strictly greater than the one we guarded on, so
 * two writes landing in the same millisecond still leave DISTINCT tokens and the
 * second is reliably detected as a miss (identical reasoning to history's).
 */
export async function writeListsRowGuarded(
  userId: string,
  file: ListsFile,
  expected: ListsVersionedRead,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  // No row yet: INSERT. A row that appeared since our read violates the user_id
  // uniqueness, which is precisely the CAS miss we retry on.
  if (!expected.exists) {
    const { error } = await supabase
      .from("progress")
      .insert({ user_id: userId, lists: file, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress.lists failed: ${error.message}`);
    }
    return true;
  }

  // Row exists: UPDATE guarded on the token. `.select` reports the affected rows,
  // so zero rows means the guard did not match. A legacy row with a null token is
  // guarded with `.is`, not `.eq`.
  const base = supabase
    .from("progress")
    .update({ lists: file, updated_at: nextTs })
    .eq("user_id", userId);
  const guarded =
    expected.version == null
      ? base.is("updated_at", null)
      : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress.lists failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// The `settings` jsonb is the third blob on the row, beside `history` and
// `lists`. It is defined in supabase/schema.sql (SAK-253) and inherits the
// row's existing RLS (which scopes every read/write to `user_id`), so no new
// policy is needed. Same read-modify-write split as history/lists: the MERGE
// logic lives in settings.ts, this only moves the blob to and from the row, and
// an unset `settings` column reads as the empty (all-default) settings.
//
// SAK-258: the plain upsert this used to be (load -> merge -> write the WHOLE
// blob back, unconditionally) had no concurrency guard at all — the same gap
// SAK-220 closed for lists. readSettingsRowVersioned / writeSettingsRowGuarded
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
 * The twin of readListsRowVersioned over the `settings` column, guarded on the
 * SAME `updated_at` token as history and lists — right, because it is the same
 * row: a history or lists write landing mid-flight costs a settings retry,
 * never a lost field.
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
 * optimistic concurrency writeHistoryRowGuarded / writeListsRowGuarded use,
 * applied to the column that never had it. Returns true when it landed, false
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
 * history's and lists').
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

// The `session` jsonb is the fourth blob on the row, beside `history`, `lists`
// and `settings`. It holds the IN-PROGRESS run envelope (see session-state.ts) —
// separate from `history`, which holds what you FINISHED. Defined in
// supabase/schema.sql (SAK-253) and inherits the row's RLS. An unset column
// reads as the empty envelope (no synced run).
//
// SAK-260: the plain read-then-write this used to be (load -> pickNewer(loaded,
// incoming) -> upsert the WHOLE blob back, unconditionally) had no concurrency
// guard: two devices posting near-simultaneously each read the same row, each
// independently decided their own update was the winner, and each blindly
// overwrote it — so the reconcile-newer-version logic never actually ran
// against the row that was really there, only against a stale snapshot each
// device took on its own. readSessionRowVersioned / writeSessionRowGuarded
// below are the CAS pair session-mutate.ts's mutateSessionStateWithRetry runs
// its read-reconcile-write through, so two overlapping writes serialize instead
// of racing — the same guard lists.ts and settings.ts already have (SAK-220,
// SAK-258), applied here to round state.

export async function readSessionRow(userId: string): Promise<SessionStateEnvelope> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("session")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.session failed: ${error.message}`);
  return normalizeEnvelope(data?.session);
}

/**
 * A versioned read of the session row, for the compare-and-set write below.
 * The twin of readSettingsRowVersioned over the `session` column, guarded on
 * the SAME `updated_at` token as history, lists and settings — right, because
 * it is the same row: a history, lists or settings write landing mid-flight
 * costs a session retry, never a lost round.
 */
export async function readSessionRowVersioned(
  userId: string,
): Promise<SessionVersionedRead> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("session, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.session failed: ${error.message}`);
  return {
    envelope: normalizeEnvelope(data?.session),
    version: (data?.updated_at as string | null | undefined) ?? null,
    exists: data != null,
  };
}

/**
 * Write the session envelope ONLY if the row still carries `expected` — the
 * same optimistic concurrency writeSettingsRowGuarded / writeListsRowGuarded
 * use, applied to round state. Returns true when it landed, false when a
 * concurrent writer moved the token first.
 *
 * Without this, two devices updating the same in-progress round within the
 * same window each read the same row, each computed their own "newer" answer
 * against that stale read, and the later write won outright regardless of
 * which envelope actually carried the newer `updatedAt` — losing whichever
 * device's progress did not happen to write last. See session-mutate.ts for
 * the retry that turns a `false` here into a re-reconcile against the real
 * winner.
 *
 * The new `updated_at` is forced strictly greater than the one we guarded on,
 * so two writes landing in the same millisecond still leave DISTINCT tokens
 * and the second is reliably detected as a miss (identical reasoning to
 * history's, lists' and settings').
 */
export async function writeSessionRowGuarded(
  userId: string,
  session: SessionStateEnvelope,
  expected: SessionVersionedRead,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  // No row yet: INSERT. A row that appeared since our read violates the user_id
  // uniqueness, which is precisely the CAS miss we retry on.
  if (!expected.exists) {
    const { error } = await supabase
      .from("progress")
      .insert({ user_id: userId, session, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress.session failed: ${error.message}`);
    }
    return true;
  }

  // Row exists: UPDATE guarded on the token. `.select` reports the affected
  // rows, so zero rows means the guard did not match. A legacy row with a null
  // token is guarded with `.is`, not `.eq`.
  const base = supabase
    .from("progress")
    .update({ session, updated_at: nextTs })
    .eq("user_id", userId);
  const guarded =
    expected.version == null
      ? base.is("updated_at", null)
      : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress.session failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
