# Saku — work tracker

Status board for everything in flight. One file per task in this folder; this is the index.

**Legend:** ✅ shipped (live on main) · 🟢 ready to merge (verified on a branch) · 🔵 in progress · 🟠 confirmed, not built · 🔍 investigating · ⚪ queued (later phase)

| # | Task | Status | Branch / where | Test URL |
|---|------|--------|----------------|----------|
| 01 | [Vercel Analytics](01-analytics.md) | ✅ done (toggled on) | main | prod |
| 02 | [Sidebar sign-in banner (collapsed) + placement](02-sidebar-banner.md) | ✅ shipped | main | prod |
| 03 | [401 silent-drop data-loss fix + migration refresh](03-401-fix.md) | ✅ shipped | main | prod |
| 04 | [Quiz clarity: audio + instructions + chip/label types](04-quiz-clarity.md) | 🟢 ready to merge | `quiz-clarity` | localhost:3002 |
| 05 | [Sync Part 1: settings + kanaquiz→saku rename](05-sync-settings.md) | 🟢 ready to merge — needs SQL applied | `sync-settings` | — |
| 06 | [Standing/claim rework (the "solid" bug)](06-standing-claim.md) | 🟠 confirmed, not built | — | — |
| 07 | [Continue-session masking (claim looks dead)](07-continue-session.md) | 🟠 confirmed, not built | — | — |
| 08 | [Fact-type labels on results grid + confusions](08-fact-type-labels.md) | 🟠 confirmed, not built | — | — |
| 09 | [Pitch intro + homophone→show-kanji](09-pitch-homophone.md) | 🟠 designed, not built | — | — |
| 10 | [Answer-revealing retry hint/reveal](10-retry-hint.md) | 🔍 investigating | — | — |
| 11 | [Sync Part 2: in-progress session teleport](11-sync-session.md) | ⚪ queued | — | — |
| 12 | [Sync Part 3: exact-position resume](12-sync-resume.md) | ⚪ queued | — | — |

## Housekeeping
- `.env.local` holds the Supabase DB connection string (for direct DB access) — rotate/remove whenever.
- When Sync Part 1 (#05) merges: apply `scripts/sql/add-settings-column.sql` to prod (I'll do it via the DB connection).
- Discard the stale in-progress session from **Current sessions** to unstick the Learn tab (see #07).

## Recommended order
Merge #04 → build #06 (standing/claim, most damaging) → batch #07 + #08 → #09 → sync #11/#12. #05 slots in anywhere.
