-- Saku — Supabase schema for hosted, per-user progress.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It replaces the local history.json file: on Vercel the same JSON blobs live in
-- one row per signed-in user, and Row-Level Security makes a user able to touch
-- only their own row.
--
-- The app keeps its existing JSON shapes — history (facts + sessions) goes into
-- `history` verbatim, so nothing about how the app reads or writes that blob
-- changes; only WHERE it lives does.
--
-- Two live jsonb blobs on this one row, both read/written by
-- src/lib/store/supabase-store.ts:
--   history  — finished practice history (facts + sessions), folded in forever.
--   settings — server-synced preferences (quiz config, theme/appearance/accents,
--              dismissal flags); read/written via src/lib/settings.ts.
--
-- And two dead ones. `lists` held the old app's saved lists (SAK-375); `session`
-- held its IN-PROGRESS run envelope, the deck position and current question a
-- half-answered quiz could be resumed from on another device (SAK-376). Nothing
-- reads or writes either one: the API routes, the store primitives, the client
-- provider, the local copies and the sign-in replay are all gone, and
-- readProgressSeedRow selects neither. Both columns are left in place because
-- dropping them is a by-hand migration that buys nothing, and whatever a
-- learner's row still holds is kept rather than thrown away. A fresh setup gets
-- them too, from the create below, so this file keeps describing the table as it
-- actually is. The Sky's quiz has no resume of its own yet; when it grows one,
-- `session` is the column waiting for it.
--
-- `settings` is read unconditionally by readProgressSeedRow (`select history,
-- settings`) — unlike `progress_facts` below, there is no fallback for that
-- column being absent, so it belongs in this table's own definition rather than
-- a separate "run this by hand" script that a fresh setup could skip. RLS
-- policies gate the ROW, not the column list, so it inherits the same policies
-- as `history` automatically.
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  history    jsonb not null default '{}'::jsonb,
  lists      jsonb not null default '{}'::jsonb,
  settings   jsonb,
  session    jsonb,
  updated_at timestamptz not null default now()
);

-- Idempotent upgrade path for a `progress` table that already existed before
-- `settings`/`session` were added to the create-table definition above (the
-- create above only takes effect on a brand-new table).
alter table public.progress add column if not exists settings jsonb;
alter table public.progress add column if not exists session jsonb;

-- Every user sees and edits only their own row.
alter table public.progress enable row level security;

drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own"
  on public.progress for select
  using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own"
  on public.progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Give a new sign-up an empty progress row automatically, so the app never has
-- to special-case "row does not exist yet".
create or replace function public.seed_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.progress (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_progress();

-- ---------------------------------------------------------------------------
-- progress_facts — the per-fact quiz aggregate, one row per (user_id, fact_id).
-- ---------------------------------------------------------------------------
--
-- SAK-237 split this out of `progress.history`'s `facts` key. That key had no
-- size cap and grew with total curriculum size, so updating ONE fact's
-- aggregate meant reading and rewriting the WHOLE `history` jsonb: every quiz
-- save, and every "actually, I don't know this", cost a learner's ENTIRE
-- lifetime fact count rather than the handful of facts the request touched.
-- This table gives a fact an address of its own, so `upsert` / `delete ...
-- where fact_id =` touches exactly the rows a request changed. See
-- src/lib/history.ts's saveSession/dropClaims/deleteSessions and
-- src/lib/store/supabase-store.ts's per-fact primitives. `sessions`, `claims`,
-- `seen`, `learnedAt` and `clearedMixups` are UNCHANGED and stay in the
-- `history` jsonb: they are either capped (sessions, at 200) or one small
-- number per fact, so they were never the growth driver.
--
-- MOVED HERE (SAK-379) from scripts/sql/add-progress-facts-table.sql, which was
-- the only definition and lived outside this file, so nothing in the repo said
-- whether a given database had the table. This file is that one definition now.
--
-- ROLLOUT ORDER — READ BEFORE APPLYING TO A DATABASE THAT ALREADY HAS LEARNERS
-- ============================================================================
-- The app code tolerates this table being ABSENT: every query against it is
-- wrapped to detect Postgres' "relation does not exist" (42P01) and falls back
-- to the original whole-document behaviour, so merging code before applying
-- this is safe. The reverse is NOT safe on its own. Once the table exists, a
-- fact's FIRST post-migration session-fold looks up its prior aggregate ONLY
-- here, never in the legacy `history.facts` blob (reading that blob to seed one
-- fact would reintroduce the whole-document cost this table exists to avoid).
-- So run scripts/backfill-progress-facts.mjs IMMEDIATELY after applying this
-- file, in the same maintenance window: treat "apply the schema" and "run the
-- backfill" as ONE step. Until the backfill completes for a learner, any fact
-- their next session touches for the first time restarts that one fact's
-- stability and recent runs from zero (its counts and confidence, not their
-- claims/seen/sessions, which are untouched). Facts the backfill has already
-- copied are unaffected regardless of ordering. On an EMPTY database there is
-- nothing to back fill and nothing to sequence.
--
-- RLS mirrors `progress`: every learner sees and edits only their own rows.

create table if not exists public.progress_facts (
  user_id    uuid not null references auth.users (id) on delete cascade,
  fact_id    text not null,
  aggregate  jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, fact_id)
);

create index if not exists progress_facts_user_id_idx on public.progress_facts (user_id);

alter table public.progress_facts enable row level security;

drop policy if exists "progress_facts_select_own" on public.progress_facts;
create policy "progress_facts_select_own"
  on public.progress_facts for select
  using (auth.uid() = user_id);

drop policy if exists "progress_facts_insert_own" on public.progress_facts;
create policy "progress_facts_insert_own"
  on public.progress_facts for insert
  with check (auth.uid() = user_id);

drop policy if exists "progress_facts_update_own" on public.progress_facts;
create policy "progress_facts_update_own"
  on public.progress_facts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "progress_facts_delete_own" on public.progress_facts;
create policy "progress_facts_delete_own"
  on public.progress_facts for delete
  using (auth.uid() = user_id);

-- Called ONLY by scripts/backfill-progress-facts.mjs, and only for a user
-- whose legacy facts it just finished copying into progress_facts above —
-- clears the jsonb `facts` key so it stops being a dead weight every OTHER
-- write to this row has to carry over the wire from here on (sessions/claims/
-- seen/learnedAt/clearedMixups all live in the SAME `history` column; see
-- history.ts's meta-only writes). `jsonb_set` touches ONLY the `facts` key —
-- it is safe to run alongside live traffic updating `sessions`/`claims`/`seen`
-- on the same row, unlike a read-modify-write of the whole column from a
-- script would be.
create or replace function public.clear_legacy_history_facts(p_user_id uuid)
returns void
language sql
as $$
  update public.progress
  set history = jsonb_set(coalesce(history, '{}'::jsonb), '{facts}', '{}'::jsonb)
  where user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- content_entries
-- ---------------------------------------------------------------------------
--
-- DEAD as of SAK-379, and this table is safe to drop by hand.
--
-- It held Library entry DETAIL payloads, fetched by id: one row per entry,
-- `payload` being whatever that entry's detail VIEW needed, a precomputed
-- view-model rather than raw dictionary rows, so a visitor's browser did not
-- have to carry every entry's detail to show one. The views that read it went
-- with the old app (SAK-398) and the Atlas builds an entry from the bundled
-- tables per request instead, so the seed script that filled this in on every
-- push to main was writing rows nobody opened. The script and its CI job are
-- gone.
--
-- Content, not progress: the SAME payload for every reader, so unlike `progress`
-- there was no per-user row and no auth-scoped RLS — anyone (including signed
-- out) could read; only the service role could write. That also means there is
-- no learner data in here, which is why dropping it is free, unlike the dead
-- `lists` and `session` columns above:
--
--   drop table if exists public.content_entries;
--
-- Kept described here, rather than deleted from this file, so a fresh setup run
-- against an existing database does not silently differ from production.
create table if not exists public.content_entries (
  entry_id           text primary key,
  kind               text not null,
  payload            jsonb not null,
  content_version    text not null,
  updated_at         timestamptz not null default now()
);

create index if not exists content_entries_kind_idx on public.content_entries (kind);

alter table public.content_entries enable row level security;

drop policy if exists "content_entries_select_all" on public.content_entries;
create policy "content_entries_select_all"
  on public.content_entries for select
  using (true);

-- No insert/update/delete policy for anon/authenticated: RLS denies both by
-- default once enabled, so only the service-role key (which bypasses RLS
-- entirely) can write — exactly the seed script's own access, never the browser's.
