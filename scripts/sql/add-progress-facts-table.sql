-- SAK-237 — split the per-fact quiz aggregate out of `progress.history`'s
-- `facts` key into its own table, one row per (user_id, fact_id).
--
-- THE PROBLEM THIS FIXES
-- =======================
-- `history.facts` — every distinct fact a learner has ever been quizzed on —
-- has no size cap and grows with total curriculum size. Before this table
-- existed, updating the aggregate for ONE fact meant reading and rewriting the
-- WHOLE `history` jsonb blob (see history.ts / history-mutate.ts), because a
-- single fact had no address of its own smaller than the whole document. That
-- made every quiz-session save, and every "actually, I don't know this" drop,
-- cost proportional to a learner's ENTIRE lifetime fact count, not to the
-- handful of facts the request actually touched.
--
-- This table gives a fact that address: `upsert`/`delete ... where fact_id =`
-- touches exactly the rows a request changed, independent of how many other
-- facts the learner has ever seen. See src/lib/history.ts's rewritten
-- saveSession/dropClaims/deleteSessions, and src/lib/store/supabase-store.ts's
-- new read/write primitives, for the code that now targets this table instead
-- of the whole `history` column for facts specifically. `sessions`, `claims`,
-- `seen`, `learnedAt` and `clearedMixups` are UNCHANGED and stay in the
-- `history` jsonb — they are either capped (sessions, at 200) or one small
-- number per fact rather than a full aggregate object, so they were never the
-- growth driver SAK-237 was filed against.
--
-- ROLLOUT ORDER — READ BEFORE APPLYING
-- =====================================
-- The app code tolerates this table being ABSENT: every query against it is
-- wrapped to detect Postgres' "relation does not exist" (42P01) and fall back
-- to the original whole-document behaviour, so merging the code before this
-- migration is safe.
--
-- The reverse is NOT fully safe on its own: once this table exists, a fact's
-- FIRST post-migration session-fold looks up its prior aggregate ONLY here —
-- not in the legacy `history.facts` blob (reading that blob to seed one fact
-- would reintroduce the exact whole-document cost this table exists to avoid).
-- So run scripts/backfill-progress-facts.mjs IMMEDIATELY after applying this
-- file, in the same maintenance window — treat "apply this SQL" and "run the
-- backfill" as ONE combined step. Until the backfill completes for a given
-- learner, any fact their next session happens to touch for the first time
-- restarts that one fact's stability/recentRuns from zero (its counts and
-- confidence, not their claims/seen/sessions, which are untouched) instead of
-- continuing from what they already knew. Facts the backfill has already
-- copied are unaffected regardless of ordering.
--
-- RLS: mirrors `progress` — every learner sees and edits only their own rows.
--
-- Idempotent: `if not exists` / `drop policy if exists` make re-running this
-- harmless.
--
-- APPLY THIS BY HAND against the production database (e.g. the Supabase SQL
-- editor), THEN run the backfill script (see above). Nothing in the app runs
-- migrations.

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
