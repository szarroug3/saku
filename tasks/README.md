# Saku — work tracker

Status board for everything in flight. One file per task in this folder; this is the index.

**Legend:** ✅ shipped (live on main) · 🟢 ready to merge (verified on a branch) · 🔵 in progress · 🟠 confirmed, not built · 🔍 investigating · ⚪ queued (later phase)

| # | Task | Status | Branch / where | Test URL |
|---|------|--------|----------------|----------|
| 01 | [Vercel Analytics](01-analytics.md) | ✅ done (toggled on) | main | prod |
| 02 | [Sidebar sign-in banner (collapsed) + placement](02-sidebar-banner.md) | ✅ shipped | main | prod |
| 03 | [401 silent-drop data-loss fix + migration refresh](03-401-fix.md) | ✅ shipped | main | prod |
| 04 | [Quiz clarity: audio + instructions + results table (by word) + confused-for](04-quiz-clarity.md) | ✅ merged + on prod | `quiz-clarity` | localhost:3002 |
| 05 | [Sync Part 1: settings + kanaquiz→saku rename](05-sync-settings.md) | ✅ shipped (settings column applied) | main | prod |
| 06 | [Standing/claim rework (the "solid" bug)](06-standing-claim.md) | ✅ approved on prod | `standing-claim` | localhost:3006 |
| 07 | [Continue-session masking → folded into #12](07-continue-session.md) | ⚪ folded into #12 | (with #12) | — |
| 08 | [Results table by word + confused-for column → done in #04](08-fact-type-labels.md) | 🟢 ready to merge (in #04) | `quiz-clarity` | localhost:3002 |
| 09 | [Pitch intro + homophone→show-kanji + lesson pitch line](09-pitch-homophone.md) | ✅ approved on prod | `pitch-homophone` | localhost:3004 |
| 10 | [Hint redesign: reading→no hint, meaning→2+-kanji components only](10-retry-hint.md) | ✅ approved on prod | `retry-hint` | localhost:3005 |
| 11 | [Sync Part 2: in-progress session teleport](11-sync-session.md) | ✅ approved on prod | `sync-session` | localhost:3003 |
| 12 | [Sync Part 3: exact-position resume + masking (#07)](12-sync-resume.md) | ✅ approved on prod | main | prod |
| 13 | [Instruction below halo, white, drop meaning/reading labels](13-instruction-layout.md) | ✅ deploying to prod | main (local) | — |
| 14 | [Retire file mode → default logged-out + localStorage](14-retire-file-mode.md) | 🟢 ready to merge (1849 unit + 85 e2e) | `retire-file-mode` | localhost:3008 |

| 15 | [Remove single definition on multi-type lesson](15-multitype-definition.md) | 🟠 not started | — | — |
| 16 | [Radical meaning in the Radical section](16-radical-meaning.md) | 🟠 not started | — | — |
| 17 | [Instruction below halo (= #13) + 'this' wording](17-instruction-below-halo.md) | 🟢 in #13 (wording tweak pending) | main | prod (soon) |
| 18 | [Kana allophony (ん→m/ŋ/n by context)](18-kana-allophony.md) | 🟠 not started | — | — |
| 19 | [Standing updates live, not on End session](19-live-standing.md) | 🟠 not started | — | — |
| 20 | [Confusion caught on typed meaning (何↔可)](20-confusion-typed-meaning.md) | 🟠 not started | — | — |
| 21 | [Everyday-words tiles clickable](21-everyday-words-clickable.md) | 🟠 not started | — | — |
| 22 | [Kanji 'on its own' reading — design](22-kanji-on-its-own-reading.md) | 🔍 needs decision | — | — |
| 23 | [Results-table box alignment](23-results-box-alignment.md) | 🟠 not started | — | — |
| 24 | [電話 meaning card missing hint](24-denwa-hint-missing.md) | 🟠 not started | — | — |
| 25 | [Listening-meaning never shows writing — design](25-listening-meaning-no-writing.md) | 🔍 needs decision | — | — |
| 26 | [Discarding a session advances the track (bug)](26-discard-advances-track.md) | 🟠 not started | — | — |

## Housekeeping
- `.env.local` holds the Supabase DB connection string (for direct DB access) — rotate/remove whenever.
- When Sync Part 1 (#05) merges: apply `scripts/sql/add-settings-column.sql` to prod (I'll do it via the DB connection).
- Discard the stale in-progress session from **Current sessions** to unstick the Learn tab (see #07).

## Recommended order
Merge #04 → build #06 (standing/claim, most damaging) → batch #07 + #08 → #09 → sync #11/#12. #05 slots in anywhere.
