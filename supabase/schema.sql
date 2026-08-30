-- Saku — Supabase schema for hosted, per-user progress.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It replaces the local history.json / lists.json files: on Vercel the same two
-- JSON blobs live in one row per signed-in user, and Row-Level Security makes a
-- user able to touch only their own row.
--
-- The app keeps its existing JSON shapes — history (facts + sessions) and lists
-- go into `history` and `lists` verbatim, so nothing about how the app reads or
-- writes those blobs changes; only WHERE they live does.
--
-- Four jsonb blobs live on this one row, all read/written by
-- src/lib/store/supabase-store.ts:
--   history  — finished practice history (facts + sessions), folded in forever.
--   lists    — saved lists.
--   settings — server-synced preferences (quiz config, theme/appearance/accents,
--              dismissal flags); read/written via src/lib/settings.ts.
--   session  — the IN-PROGRESS run envelope (deck position, current question,
--              answers so far, requeue state, phase + round), separate from
--              `history` on purpose so a stale in-progress copy can never
--              resurrect a finished run; read/written via src/lib/session-store.ts.
-- `settings` and `session` are read unconditionally by readProgressSeedRow
-- (`select history, settings, session, lists`) — unlike `progress_facts` below,
-- there is no fallback for these columns being absent, so they belong in this
-- table's own definition rather than a separate "run this by hand" script that
-- a fresh setup could skip. RLS policies gate the ROW, not the column list, so
-- both inherit the same policies as `history`/`lists` automatically.
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

-- Library entry DETAIL content, fetched by id — see docs/perf-library-list-bundle.md
-- ("What's still deferred"). A generic one-row-per-entry table: `payload` is
-- whatever that entry's detail VIEW needs (a precomputed view-model, not raw
-- dictionary rows), seeded by scripts/seed-content-entries.mjs and read by the
-- app on demand instead of being bundled into the client for every visitor.
--
-- Content, not progress: the SAME payload for every reader, so unlike `progress`
-- there is no per-user row and no auth-scoped RLS — anyone (including signed-out)
-- can read; only the service role (used server-side by the seed script) writes.
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
