# Saku

Saku is a free web app for learning Japanese from the ground up. It starts where
most beginners actually start, not knowing the writing system exists, and walks
forward one prerequisite at a time: read the kana, then the pieces kanji are
built from, then kanji, then words, then the grammar that holds a sentence
together.

The name is a play on 咲く ("to bloom") and sakura. Its mascot is a red panda
holding a sakura blossom (`public/brand/saku-mark.png`,
`public/brand/saku-wordmark.png`). The project began life as `kana-quiz`, which
is still the package name in `package.json`.

The app is opinionated about order. A track doesn't open until the one before it
is solid, so a learner never reaches a word before they can read it, or a kanji
before they know its radicals. The progression is:

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
- **Multiple themes**, each with a light and dark palette: aizome, graphite,
  momentum, and kiri. Everything is styled through CSS tokens, so a theme is
  mostly a token swap, with no hardcoded colors.

## Tech stack

- **Next.js 16** (App Router) with **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** JS + SSR clients, for hosted per-user storage and Google auth
- **Node's built-in test runner** for unit tests, **Playwright** for end-to-end

## Running locally

Requires **Node 24** (pinned in `.nvmrc`, and in `engines.node` in
`package.json`) and **pnpm** (the version is pinned in the `packageManager`
field).

```bash
nvm use          # Node 24
pnpm install
```

Copy `.env.example` to `.env.local` and leave the Supabase values blank to run
against the local file store with no auth. See [Environment](#environment) below.

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

### Scripts

| Script | What it does |
|---|---|
| `pnpm build` | production build (`next build`) |
| `pnpm start` | serve the build (`next start`) |
| `pnpm dev` | `next dev` (broken here, see above) |
| `pnpm lint` | eslint (repo root) |
| `pnpm lint:fix` | eslint with `--fix` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm test` | unit tests (see [Testing](#testing)) |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm mnemonic-images` | rebuild mnemonic images (`scripts/build-mnemonic-images.mjs`) |
| `pnpm audit-corpus` | audit the corpus (`scripts/audit-corpus.ts`) |
| `pnpm audit-corpus:check` | corpus audit in check mode (non-zero exit on drift) |

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

### CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request. It uses the Node version from `.nvmrc` and runs four gates in order:
type-check (`pnpm run type-check`), lint (`pnpm exec eslint src`, scoped to `src`
rather than the repo root so it skips a false positive in the e2e helpers), unit
tests (`pnpm test`), and the production build (`pnpm run build`). The build is the
only gate that catches boot-class failures like a route conflict, which are not
type, lint, or unit-test errors.

## Data and persistence

Which backend holds a learner's progress is chosen by an explicit switch,
`STORAGE_BACKEND` (`src/lib/store/mode.ts`). It has two values.

### `file` (default) — local development

With `STORAGE_BACKEND` unset (or anything other than `supabase`), everything a
learner has done lives in two JSON files at the repo root:

- `history.json` — practice history and progress (`src/lib/history.ts`)
- `lists.json` — saved lists (`src/lib/lists.ts`)

Both are gitignored local learner data. This is the **file** backend: no auth, a
single implicit "local" user, and no database to stand up.

### `supabase` — hosted, per-user

With `STORAGE_BACKEND=supabase`, the same two JSON blobs live in one row per
signed-in user in a `progress` table, with Row-Level Security so a user can touch
only their own row. The schema is in `supabase/schema.sql` (run it once in the
Supabase SQL editor); the store implementation is in
`src/lib/store/supabase-store.ts`, over the client/server helpers in
`src/lib/supabase/`.

Keeping this a separate switch from "are the Supabase keys present" is
deliberate: the keys can be set locally to test auth while the store still points
at the files, so turning on the hosted backend is one explicit decision rather
than a side effect of having configured auth.

### Signed-out learners in Supabase mode

The app is fully browsable signed out. In Supabase mode a signed-out learner has
no server row, so their progress is written to this browser's `localStorage`
instead (`src/lib/store/local-progress.ts`), driven by a fetch wrapper that
falls back to the local store on a 401 and otherwise passes reads and writes
through to the server (`src/lib/progress-fetch.ts`). When the learner signs in,
that local copy is replayed up into their account, once, and then cleared
(`src/lib/store/migrate-local.ts`). The uploads are idempotent, so the merge is
safe to retry. This local copy is a disposable browser-side convenience, not a
durable record; the account is the durable copy.

## Authentication

Sign-in is **Google OAuth via Supabase** and its only job is to save progress
across devices. The whole app is usable signed out (see above); auth just moves a
learner's progress from this browser into an account they can reach anywhere.

- The button is `src/components/auth/google-sign-in.tsx`
  (`supabase.auth.signInWithOAuth`), shared by the landing page and the bare
  `/login` card (`src/app/login/page.tsx`).
- Google redirects back to `/auth/callback` (`src/app/auth/callback/route.ts`),
  which exchanges the code for a session and sets the cookies.
- Middleware and the SSR/browser clients live in `src/lib/supabase/`
  (`middleware.ts`, `server.ts`, `client.ts`); the sign-out and signed-out-notice
  components are under `src/components/auth/`.

There is no email or password path, so no SMTP, rate limits, or account
creation forms to run.

## Environment

Copy `.env.example` to `.env.local` (gitignored). Leave the Supabase values blank
for local development to stay on the file store with no auth.

| Variable | Purpose |
|---|---|
| `STORAGE_BACKEND` | `file` (default) or `supabase`. Selects the store. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Required for the `supabase` backend and for auth. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Safe to expose to the browser (RLS protects the data). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server-only. Not needed for normal use; only for a future admin/maintenance script that must bypass RLS. Never expose it to the browser. |

The `NEXT_PUBLIC_*` values are baked in at build time, so a change to them needs a
rebuild, not just a restart.

## Deployment

Saku is deployed on **Vercel** (free Hobby tier) with progress in **Supabase**
(free tier). To deploy your own:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. In Supabase, enable the Google provider under Authentication and set the
   redirect URL to `<your-domain>/auth/callback`.
3. In Vercel, set `STORAGE_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Vercel runs `next build`.

## Project structure

```
src/app/          routes: Home, Practice, Library, Lists, Progress, Settings,
                  Resources, login, auth/callback, quiz/results/sessions, api/*
src/components/   screen components by area: home/ practice/ quiz/ library/
                  lesson/ results/ stats/ settings/ auth/ · the ui/ kit
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

`src/lib/engine/` is pure TypeScript with no React: deck building, requeue,
distractors, scoring, and the pluggable `QuestionType` that each drill type
implements.

## License

Two licenses, split at one directory:

- **Code** — MIT. Everything except `src/data/generated/`. See [`LICENSE`](LICENSE).
- **Generated dictionary data** — CC BY-SA 4.0. `src/data/generated/`, adapted
  from EDRDG's dictionaries. See `src/data/generated/LICENSE` for the full
  attribution and the Tatoeba carve-out.

[`NOTICE`](NOTICE) states the boundary: the code reads the data, it isn't derived
from it, so the two ship as a collection and ShareAlike doesn't reach the code.
The same acknowledgement is in the app at `/about/data`.
</content>
</invoke>
