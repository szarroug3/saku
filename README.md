# Saku

Saku is a free web app for learning Japanese from the ground up. It starts where
most beginners actually start — not knowing the writing system exists — and walks
forward one prerequisite at a time: read the kana, then the pieces kanji are built
from, then kanji, then words, then the grammar that holds a sentence together.

It's named for its mascot, a red panda holding a sakura blossom
(`public/brand/saku-mark.png`, `public/brand/saku-wordmark.png`).

The app is opinionated about order. A track doesn't open until the one before it
is solid, so you never meet a word before you can read it or a kanji before you
know its radicals. The progression is:

**hiragana → katakana → radicals → kanji → vocabulary → grammar → counters → keigo**

(defined in `TRACK_ORDER`, `src/data/track-intros.ts`). Pitch accent rides along
the vocabulary: verified downstep marks are drawn on words throughout the app and
in the Library, sourced from the Kanjium database (`src/data/pitch.ts`).

## Features

- **A curriculum feed, not a builder.** Home (`/`) is the low-decision screen:
  the next lesson in each track, each card shown only when it actually has
  something to teach.
- **Hand-authored mnemonics with drawings.** Every kana has a story and an
  illustration keyed to it (`src/data/mnemonics.ts`, images under
  `public/mnemonics/`).
- **A Library reference** (`/library`). One searchable place for kana families,
  radicals, kanji and their readings, words and what they're built from, grammar
  patterns, keigo sets, counters, and pitch marks. It replaced the old kana chart
  and folded grammar in as a section rather than a separate tab.
- **Several drill types**, each its own screen under `src/components/quiz/`:
  - multiple choice and typed answers (`drill-screen.tsx`)
  - a full-sheet grid (`grid-screen.tsx`)
  - match-the-pairs boards (`pairs-screen.tsx`)
  - listening drills (`sentence-listen-screen.tsx`)
  - sentence building / assembly (`assembly-screen.tsx`)
  - guided substitution (`substitution-screen.tsx`)
- **Practice** (`/practice`) is the open builder for a one-off drill: pick a pool
  and how it should ask, then start. It's separate from the lesson flow, which
  runs a teach → drill → rest → repeat session.
- **A spaced-progress model.** The app tracks what you've seen, what you miss, and
  which characters you confuse for each other, and uses that to pick what's worth
  drilling next. Confusions expire once you get them right enough times in a row.
- **Lists** (`/lists`) for hand-picked collections, and **Progress** (`/stats`)
  for accuracy trends and per-track standing.
- **Multiple themes**, each with a light and dark palette. Everything is styled
  through CSS tokens, so a theme is mostly a token swap — no hardcoded colors.

## Tech stack

- **Next.js 16** (App Router) with **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** JS + SSR clients, for the hosted-storage migration described below
- **Node's built-in test runner** for unit tests, **Playwright** for end-to-end

## Running locally

Requires **Node 24** (pinned in `.nvmrc`) and **pnpm**.

```bash
nvm use          # Node 24
pnpm install
```

### Heads up: `next dev` doesn't work here

On the author's machine `next dev` is broken. Turbopack spawns a PostCSS worker
that picks up an old system Node without the `node:` builtins, and the dev server
crashes. **The working loop is a production build followed by a start**, on port
3000:

```bash
pnpm build
pnpm start        # http://localhost:3000
```

Rebuild after changes and restart. `pnpm dev` (`next dev`) is left in
`package.json` but should not be relied on until the toolchain issue is resolved.

Other scripts:

| Script | What it does |
|---|---|
| `pnpm build` | production build (`next build`) |
| `pnpm start` | serve the build (`next start`) |
| `pnpm lint` | eslint |
| `pnpm type-check` | `tsc --noEmit` |

## Testing

Unit tests use Node's test runner. The `--import` hook wires up the TypeScript
and module setup the tests expect, so run them through the script rather than
`node --test` directly:

```bash
pnpm test         # node --import ./src/lib/conjugate/test-hooks.mjs --test "src/**/*.test.ts"
```

There are unit tests throughout `src/lib/` and `src/data/` (`*.test.ts`).

End-to-end tests run against a real build with Playwright. The config builds and
starts the app itself (on port 3249, so it won't collide with a manual server on
3000):

```bash
pnpm test:e2e     # playwright test
```

## Data and persistence

By default, everything a learner has done lives in two JSON files at the repo
root:

- `history.json` — practice history and progress (`src/lib/history.ts`)
- `lists.json` — saved lists (`src/lib/lists.ts`)

Both are gitignored local learner data. This is the **file** backend: no auth, a
single implicit local user, and no database to stand up.

### Hosting (in progress)

A migration to hosted, per-user storage on **Supabase + Vercel** is underway. The
schema lives in `supabase/schema.sql` (a `progress` table, one row per user,
gated by Row-Level Security), the client/server helpers are in
`src/lib/supabase/`, and `.env.example` documents the environment variables.

The backend is chosen by an explicit switch, `STORAGE_BACKEND=supabase`
(`src/lib/store/mode.ts`) — deliberately separate from whether the Supabase keys
are present, so you can wire up and test auth locally while still reading and
writing the local files. Leave it unset for local development and the app keeps
using `history.json` / `lists.json`. **Auth is not fully wired up yet**; this
whole path is in progress, not done.

## Project structure

```
src/app/          routes: Home, Practice, Library, Lists, Progress, Settings,
                  Resources, quiz/results/sessions, and api/*
src/components/   screen components by area: home/ practice/ quiz/ library/
                  lesson/ results/ stats/ settings/ · the ui/ kit
src/lib/          the engine and logic: engine/ (pure TS: decks, distractors,
                  question types, scoring), accuracy · slow · confusions ·
                  lesson/track flow, history/lists persistence, supabase/ · store/
src/data/         the curriculum and corpus: characters, mnemonics, radicals,
                  kanji, vocab, grammar/, keigo, counters, pitch, resources
                  (generated/ holds ingested dictionary data)
public/           brand/ mascot art, mnemonics/ drawings, and static assets
supabase/         schema.sql for the hosted backend
e2e/              Playwright tests
```

`src/lib/engine/` is pure TypeScript with no React — deck building, requeue,
distractors, scoring, and the pluggable `QuestionType` that each drill type
implements.

## Licence

Two licences, split at one directory:

- **Code** — MIT. Everything except `src/data/generated/`. See [`LICENSE`](LICENSE).
- **Generated dictionary data** — CC BY-SA 4.0. `src/data/generated/`, adapted
  from EDRDG's dictionaries. See `src/data/generated/LICENSE` for the full
  attribution and the Tatoeba carve-out.

[`NOTICE`](NOTICE) states the boundary: the code reads the data, it isn't derived
from it, so the two ship as a collection and ShareAlike doesn't reach the code.
The same acknowledgement is in the app at `/about/data`.
