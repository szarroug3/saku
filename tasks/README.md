# Saku — work tracker

Open work only. Everything shipped and verified on prod has been removed. One file per task.

**Legend:** 🟢 ready to merge/test · 🔵 in progress (agent) · 🟠 not started · specced = decided, awaiting dispatch

| # | Task | Status | Branch | Test URL |
|---|------|--------|--------|----------|
| 19 | [Standing updates the moment you miss](19-live-standing.md) | 🟢 ready to merge | `live-standing` | http://localhost:3017 |
| 22 | [Kanji reading in a known word (formula hint)](22-kanji-on-its-own-reading.md) | 🟠 specced — unblocked (#24 deployed) | — | — |
| 25 | [Listening-meaning card: show the kanji as a hint](25-listening-meaning-no-writing.md) | 🟠 specced — unblocked (#24 deployed) | — | — |
| 27 | [Library: teaching order, ranged groups, full list, clickable group headers (#21)](27-library-teaching-order.md) | 🟢 ready to merge — kanji now grouped by 50 (matches words/radicals) | `library-order` | http://localhost:3015 |
| 28 | [Practice: choose types + scope](28-practice-type-scope.md) | 🔵 in progress — 2 bugs (prune zero-count type on scope switch; "Pick what I want" broken) | `practice-types` | http://localhost:3016 |

A 🔵 in-progress row's server is only up once its agent reports — until then the URL 404s / is down.

## Deployed to prod
17 (instruction wording), 18 (kana allophony), 20 (confusion 何↔可, entry-complete search), 23 (results box alignment), 24 (電話 hint), 26 (discard rollback).

## Housekeeping
- `.env.local` holds the Supabase DB connection string + a now-dead `STORAGE_BACKEND` (no-op after #14) — clean up / rotate whenever.
- `.env.local.example` env docs still reference the retired file mode — update.
