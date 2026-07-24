# Saku — work tracker

Open work only. Everything shipped and verified on prod has been removed. One file per task.

**Legend:** 🟢 ready to merge · 🟠 not started · 🔍 needs a design decision · ⚪ queued

| # | Task | Status | Branch |
|---|------|--------|--------|
| 14 | [Retire file mode → logged-out + localStorage default](14-retire-file-mode.md) | 🟢 ready to merge (1849 unit + 85 e2e) — has flags to review | `retire-file-mode` |
| 15 | [Remove single definition on a multi-type lesson](15-multitype-definition.md) | 🟢 ready to merge | `lesson-sections` |
| 16 | [Show a radical's meaning in the Radical section](16-radical-meaning.md) | 🟢 ready to merge | `lesson-sections` |
| 17 | [Meaning instruction wording: "this" not "the"](17-instruction-below-halo.md) | 🟠 tiny tweak (rest shipped in #13) | — |
| 18 | [Kana allophony (ん → m/ŋ/n by what follows)](18-kana-allophony.md) | 🟠 not started | — |
| 19 | [Standing updates the moment you miss, not on End session](19-live-standing.md) | 🟠 not started | — |
| 20 | [Confusion caught when you type another word's meaning (何↔可)](20-confusion-typed-meaning.md) | 🟠 not started | — |
| 21 | [Everyday-words tiles clickable like hiragana vowels](21-everyday-words-clickable.md) | 🟠 not started | — |
| 22 | [Kanji reading in a known word (formula hint), not "on its own"](22-kanji-on-its-own-reading.md) | 🟠 specced (queued behind #24) | — |
| 23 | [Results-table presentation boxes should left-align](23-results-box-alignment.md) | 🟠 not started | — |
| 24 | [電話 meaning card shows no hint](24-denwa-hint-missing.md) | 🟠 not started | — |
| 25 | [Listening-meaning card: show the kanji as a hint](25-listening-meaning-no-writing.md) | 🟠 specced (queued behind #24) | — |
| 26 | [Discarding a session still advances the track (bug)](26-discard-advances-track.md) | 🟠 not started | — |

| 27 | [Library: teaching order, ranged groups, full word list](27-library-teaching-order.md) | 🟠 not started | — |
| 28 | [Practice: choose types + scope](28-practice-type-scope.md) | 🟠 not started | — |

## Housekeeping
- `.env.local` holds the Supabase DB connection string (my direct access) + a now-dead `STORAGE_BACKEND` (no-op after #14) — clean up / rotate whenever.
- When #14 merges: no SQL needed (settings/session columns already applied); update `.env.local.example` env docs.
