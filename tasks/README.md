# Saku — work tracker

Open work only. Everything shipped and verified on prod has been removed. One file per task.

**Legend:** 🟢 ready to merge · 🔵 in progress (agent) · 🟠 not started · specced = decided, awaiting dispatch

| # | Task | Status | Branch | Test URL |
|---|------|--------|--------|----------|
| 17 | [Meaning instruction wording: "this" not "the"](17-instruction-below-halo.md) | 🟢 done (local main) — ready to deploy | main | http://localhost:3000 |
| 18 | [Kana allophony (ん → m/ŋ/n by what follows)](18-kana-allophony.md) | 🔵 in progress | `kana-allophony` | http://localhost:3014 |
| 19 | [Standing updates the moment you miss](19-live-standing.md) | 🟢 ready to merge | `live-standing` | http://localhost:3017 |
| 20 | [Confusion caught on typed meaning (何↔可)](20-confusion-typed-meaning.md) | 🟢 ready to merge | `hint-confuse` | http://localhost:3013 |
| 21 | [Everyday-words tiles clickable — already are? needs Sam's clarification](21-everyday-words-clickable.md) | 🔍 needs input (no repro) | — | — |
| 22 | [Kanji reading in a known word (formula hint)](22-kanji-on-its-own-reading.md) | 🟠 specced (queued behind #24) | — | — |
| 23 | [Results-table box alignment](23-results-box-alignment.md) | 🟢 ready to merge | `ui-small` | http://localhost:3012 |
| 24 | [電話 meaning card missing hint](24-denwa-hint-missing.md) | 🟢 ready to merge | `hint-confuse` | http://localhost:3013 |
| 25 | [Listening-meaning card: show the kanji as a hint](25-listening-meaning-no-writing.md) | 🟠 specced (queued behind #24) | — | — |
| 26 | [Discarding a session advances the track (bug)](26-discard-advances-track.md) | 🔵 in progress | `discard-no-advance` | http://localhost:3011 |
| 27 | [Library: teaching order, ranged groups, full word list](27-library-teaching-order.md) | 🟠 not started | — | — |
| 28 | [Practice: choose types + scope](28-practice-type-scope.md) | 🟠 not started | — | — |

A 🔵 in-progress row's server is only up once its agent reports — until then the URL 404s.

## Housekeeping
- `.env.local` holds the Supabase DB connection string + a now-dead `STORAGE_BACKEND` (no-op after #14) — clean up / rotate whenever.
- When #14 merges: no SQL needed (columns already applied); update `.env.local.example` env docs.
