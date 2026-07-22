# P1 · Test-suite gaps

**Status: done** — merged `cb50d74`. 2 data-loss bugs fixed, vacuous tests killed, +61 coverage tests (all mutation-verified), CI added.

Sam: "fix all of these as you see fit." Approved, no further sign-off needed.

## The structural situation

1035 tests pass and **not one renders a component**. `test-hooks.mjs:70-76`
resolves only `.ts`, and Node's type stripping does not transform JSX, so all
**100 files** in `src/components` and `src/app` are unreachable. The pure library
layer is well covered; the wiring that decides which pure function is called, with
what, and whose result is shown, is invisible. Every bug found this round lives in
exactly that seam.

**Do not acquire a DOM renderer to fix this.** Most of the value trapped in `.tsx`
is extractable into pure functions the existing harness already runs, and
Playwright (task: `feat/e2e-tests`, awaiting review) covers the rest more
honestly. Pull the composition seam into `lib` instead.

## Order of work

1. **`revealFor` extraction and its invariant test.** See task 01. Highest value
   per unit of effort in the repo: it converts the single worst untestable line
   into a testable one and kills a whole bug class.
2. **`checkTyped` property test that always passes `ctx`.** See task 02. Also
   fixes the reason the suite has been testing a branch the app never takes.
3. **`next build` in CI.** About two minutes, and it is the only possible gate on
   the boot class. A route conflict shipped with tsc clean and 1035 green.
4. **`history.ts` failure paths, then make the write atomic.** Detail below.
5. **The unasserted arbiters:** `claims.effectiveState`, `aggregate.foldSessions`,
   `session.mergeStats` (its `firstTryCorrect` first, see task 03),
   `accuracy.ts`.
6. **API routes.** `Request`/`Response` are global in Node 24 and each route is a
   few lines. `/api/delete` with an empty body is a two-line test.

## Data-loss risks, all currently untested

- **Corrupt `history.json` is silently replaced with an empty one.**
  `history.ts:29-46` swallows a parse failure and returns empty history; every
  mutator is a read-modify-write on top of that, written back with a bare
  non-atomic `writeFileSync`. One truncated write and the next save replaces a
  recoverable file with a shell. Every session, claim and unlocked reading gone,
  with no error. **Fix: a failed load must refuse to write, and the write must be
  temp-file plus rename.**
- **An empty POST to `/api/delete` permanently shrinks the aggregate.**
  `route.ts:31-33`: an empty body leaves `body.reset` falsy, so
  `deleteSessions(null, false)` deletes nothing but still rebuilds `hist.facts`
  from surviving sessions. With the 200-session cap, that silently discards every
  contribution from evicted sessions.
- **`deleteSessions` keys on `ts`**, stamped with `Date.now()`. Two sessions in
  the same millisecond delete together.
- **Finished sessions are fire-and-forget**, posted with `.catch(() => {})` while
  local state advances regardless. Offline or a closed tab and the session
  vanishes silently.

## Tests that exist but assert almost nothing

- **All five "component tests" are source-text greps** that `readFileSync` a
  `.tsx` and regex it. They assert the spelling of the source, not behaviour.
  `drill-hint.test.ts:57` asserts `/return/.test(body)`, which matches any
  function with any return anywhere.
- **`lesson-item-view.test.ts:71`** extracts a gate with a regex that falls back to
  `""`, so its key assertion **passes vacuously on an empty string** and would
  silently stop testing if the gate were respelled `&&` instead of `?:`.
- **`history.test.ts`** asserts only `resetAll`. It never touches the corruption
  path, the incremental fold, the 200-cap, `deleteSessions`, or `dropClaims`.
- **`list-ops.test.ts` tests the wrong copy.** `lists.ts:78-84` has its own inline
  dedupe rather than delegating to `withEntriesAdded`, contradicting
  `list-ops.ts`'s header. The tested copy is not the one the API route runs.
- **Any `checkTyped` test with no `ctx`** exercises a branch the drill never takes.

Either make these assert behaviour or delete them. A test that cannot fail is
worse than no test, because it reads as coverage.

## Zero-coverage modules, all harness-compatible today

`accuracy.ts`, `aggregate.ts`, `claims.ts`, `decks.ts`, `import.ts`, `facts.ts`,
`fact-id.ts`, `kanji-parts.ts`, `radical-order.ts`, `words.ts`, `slow.ts`,
`lesson-position.ts`.

## Genuinely well covered, leave alone

`romaji.ts` and the kana/kanji/vocab grading paths; `buildMcOptions` co-correct
filtering (swept 1200 facts, zero prompt-as-option, zero duplicate labels, so that
earlier fix is holding); `confusedWith`; the whole `conjugate/` and `grammar/`
rule layer; `list-ops`.

## What the merged e2e suite does NOT cover

Recorded so the 57 passing tests are not mistaken for full coverage:

- **Grid and Match-pairs modes.** Only Drill is covered. Grid auto-finishes 500ms
  after the last card and its inputs carry no label; pairs has no stable per-cell
  handle. Both would need selectors the app does not currently offer.
- **Kanji-meaning multiple choice.** Distractors come only from confusable pairs
  plus cross-script katakana, so most kanji yield one option or fewer and
  legitimately fall back to a typed card.
- **Multi-tab ownership.** `kanaquiz-session` is owned by the newest tab, so a
  two-context test is inherently racy.
- **Rounds 2 and 3 of a session** — which is exactly where task 14's brick lives.
  The lesson spec stops after round 1. **Extending it is part of task 14.**
