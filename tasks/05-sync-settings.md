# 05 — Sync Part 1: settings + kanaquiz→saku rename 🟢 ready to merge

**Branch:** `sync-settings` (worktree `../saku-sync-settings`). Not yet served.

- Settings (cfg, theme/appearance/accents, dismissal flags, latency) now persist to the server (`settings` jsonb on `progress`, `settings.json` in file mode). Theme also stays mirrored in localStorage for the no-flash paint; server wins on reconcile.
- All `kanaquiz-*` keys renamed to `saku-*` with **move-on-read** migration (`storage-migrate.ts`) so existing data isn't orphaned.
- One-time local→server replay on first sign-in (empty-server gate), so current theme/config isn't reset.
- Not synced (by design): `saku-sidebar-collapsed`, pending-records, history-cache, session.

**Action needed at merge:** apply `scripts/sql/add-settings-column.sql` to prod (`alter table progress add column if not exists settings jsonb;`) — I'll run it via the DB connection. App tolerates the column being absent, so it's safe to merge before/after.

**Verified:** 1857 tests, tsc/lint/build clean.
**Flags to review:** latency syncs on a 20s throttle (not per-card, by design); first device to seed a fresh account wins (same as history migration).
