# Kana quiz

A hiragana and katakana trainer. The goal isn't to *know* the 214 characters —
it's to **recognise them instantly**, and to find and repair the specific
confusions that keep costing you (シ↔ツ, ソ↔ン).

Originally a Python-stdlib server serving one HTML file; now Next.js +
TypeScript + Tailwind. The original is preserved in [`legacy/`](legacy/) and in
the first commit.

## Run it

```bash
nvm use          # Node 24, pinned in .nvmrc
pnpm install
pnpm dev         # http://localhost:3000
```

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | production build |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm lint` | eslint |

Your practice history lives in `history.json` at the repo root — the same file
and the same shape the Python app used, so it stays git-syncable with the vault.

## The screens

**Home** is a launcher, not a builder. The hero owns *how* you drill (mode,
direction, length) as an editable sentence; every card owns *what* — so a card
is one click from your first character. Three shelves in priority order:
resume · target a weakness (Weakest 20, Confusions, Last misses — computed from
your history) · decks.

**Drill** — information stays, interaction fades. The halo around the character
is the whole feedback surface: still by default, waking only in the timer's last
five seconds, sweeping accent when you're right, pulsing when you're not. Four
toggles in the gear drawer dial it from zen (all off) to instrumented (all on).

**Grid** is the Tofugu sheet; **Match pairs** is boards of eight. Both inherit
the drill's language.

**Results** leads with a diagnosis, not a score — then a board of characters
that *is* the redrill selection.

**Statistics** remembers: the accuracy trend, your weakest characters, per-deck
rings. **Kana chart** is the reference, with Tofugu links and click-to-hear.

## Things worth knowing

**Accuracy has one definition** ([`src/lib/accuracy.ts`](src/lib/accuracy.ts)).
Two denominators exist and must never be mixed — `seen` counts showings, `missed`
counts wrong *attempts*, so one showing can produce several misses. The legacy
formula `(seen - missed) / seen` mixed them and could go negative. Now:

```
strict    = firstTry / seen          "nailed it immediately"
forgiving = seen / (seen + missed)   "share of attempts correct"
```

Settings picks which one the whole app shows. Percentages always render with a
`%` so a ring can't read as a count.

**"Slow" adapts to you** ([`src/lib/slow.ts`](src/lib/slow.ts)). Not a fixed
threshold — a fixed 5s flags nothing for a fast reader and half the run for a
new one. It's `max(floor, median + 3·MAD)` over your recent latencies, per
answer style, measured to your **first keystroke** (everything after that is
typing, which is motor skill, not recognition). MAD is robust, so a few slow
cards can't raise the bar meant to catch them — and unlike a percentile, it can
return *zero*, which is what makes a clean run earnable.

**Confusions expire.** A mix-up is a weakness only if it happened *this* run and
keeps happening. Get it right `graduateRuns` times in a row (Settings, default
10) and it's cleared: its old misses stop feeding Patterns, Home's Confusions
card, and Weakest 20. Only Statistics keeps remembering. The denominator counts
only runs that actually contained those characters — a hiragana-only week can't
dilute a katakana pair that never had a chance to appear.

**A quiz outlives its tab.** State lives in `localStorage`, so closing the
browser and coming back still offers Resume. An owner stamp settles multi-tab:
newest wins.

## Themes

Four, each with a light and a dark palette: **aizome** (washi, sumi ink, indigo),
**graphite** (precision dark), **momentum** (tactile), **kiri** (atmospheric
glass, the default). `data-theme` + `data-appearance` on `<html>`; an explicit
appearance beats the system preference both ways.

Everything is styled through tokens (`--bg`, `--text-muted`, `--accent`,
`--gcard-right`, `--font-kana`, `--radius`…), which is why a theme is mostly a
token swap. **Never hardcode a hex** — it will look broken in three themes.

## Adding character sets

Data-only. Append a `CharSet` to `SETS` in
[`src/data/characters.ts`](src/data/characters.ts):

```ts
{
  id: "minna-l1",
  label: "Minna Lesson 1",
  labelJa: "みんなの日本語 L1",
  sections: [
    { id: "l1-vocab", label: "Vocabulary", chars: [
      { c: "先生", r: ["sensei"], meaning: "teacher",
        m: "the one who was born (生) before (先) you" },
    ]},
  ],
}
```

Every entry needs `c` (the Japanese) and `r` (accepted answers). Optional: `m`
(mnemonic, shown in the chart), `meaning`, and the reserved `strokes` / `audio`
for the roadmap below. [`src/lib/decks.ts`](src/lib/decks.ts) derives decks from
`SETS`, so a new set grows its own basic/extended pair for free.

## Architecture

```
src/app/          routes (Home, quiz, results, sessions, stats, chart, settings)
                  + api/{history,session,delete}
src/components/   home/ quiz/ results/ stats/ settings/ · ui.tsx (the kit)
src/lib/          accuracy · slow · confusions · decks · engine/ · theme · quiz-config
                  quiz-session (the live-quiz contract) · history (server-side fs)
src/data/         characters.ts
```

`src/lib/engine/` is pure TypeScript with no React: deck building, requeue,
distractors, stats. Question types are pluggable via `QuestionType` — the
extension point for the roadmap.

Quiz screens follow one contract, documented at the top of
[`quiz-session.tsx`](src/lib/quiz-session.tsx): builder settings are **frozen**
into the quiz at start; Settings values are read **live**; all mutable state
lives in `active.runtime` (JSON-serializable, written as it changes) so tab
switches and refreshes resume mid-question.

## Roadmap

- **v2** — write-a-word / write-text modes (word sets as data), listen mode
  (`speechSynthesis`)
- **v3** — stroke order + draw (KanjiVG, Japanese-only)
