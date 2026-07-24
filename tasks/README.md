# Saku — work tracker

Open work only. Everything shipped and verified on prod has been removed (except #20, which shipped but is being reworked). One file per task.

**Legend:** 🟢 ready to merge/test · 🔵 in progress (agent) · 🟠 not started · specced = decided, awaiting dispatch

| # | Task | Status | Branch | Test URL |
|---|------|--------|--------|----------|
| 19 | [Standing updates the moment you miss](19-live-standing.md) | 🟢 ready to merge | `live-standing` | http://localhost:3017 |
| 20 | [Confusion caught on typed answer (何↔可)](20-confusion-typed-meaning.md) | 🔵 in progress (reworking — shipped but not surfacing) | `confusion-typed` | http://localhost:3019 |
| 22 | [Kanji reading in a known word (formula hint)](22-kanji-on-its-own-reading.md) | 🟠 specced — unblocked (#24 deployed) | — | — |
| 25 | [Listening-meaning card: show the kanji as a hint](25-listening-meaning-no-writing.md) | 🟠 specced — unblocked (#24 deployed) | — | — |
| 27 | [Library: teaching order, ranged groups, full list, clickable group headers (#21)](27-library-teaching-order.md) | 🟢 ready to merge | `library-order` | http://localhost:3015 |
| 28 | [Practice: choose types + scope](28-practice-type-scope.md) | 🟢 ready to merge | `practice-types` | http://localhost:3016 |

A 🔵 in-progress row's server is only up once its agent reports — until then the URL 404s / is down.

## Deployed to prod this round
17 (instruction wording), 18 (kana allophony), 23 (results box alignment), 24 (電話 hint), 26 (discard rollback). #20 (confusion) also shipped but is being reworked — see the row above.

## Housekeeping
- `.env.local` holds the Supabase DB connection string + a now-dead `STORAGE_BACKEND` (no-op after #14) — clean up / rotate whenever.
- `.env.local.example` env docs still reference the retired file mode — update.
