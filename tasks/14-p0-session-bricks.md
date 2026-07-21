# P0 · The session bricks and cannot be recovered from inside the app

**Status: done** — merged `abc454c` — merged `abc454c` — merged `abc454c`

**The most severe finding of the whole round.** A beginner could not finish
lesson 1. Everything else is cosmetic next to this.

## What happened

Round 2 went wrong, round 3 never started. On a **clean browser tab, clean
console, no errors**, at `/session`:

- あ on screen, input focused and containing `a`, Enter pressed twice
- HUD reads **"0 answered"**. Nothing happens.
- **End quiz** does nothing. **Look again** does nothing. **Discard** does nothing.
- Home → "Continue session" and `/current` → "Continue" both land back in the
  same frozen drill.
- **"Clear knowledge base"** — the app's own nuclear option, described as *"The app
  starts over from its first lesson, as if you had just installed it"* — does
  nothing visible and leaves the session intact.

It survived a hard reload, a full dev-server restart, and clearing
`localStorage`. There was **no way, from inside the app, to finish lesson 1 or
start lesson 2.**

Console during the failure window: **`Maximum update depth exceeded`** — a React
infinite render loop.

## What we know about the mechanism

- The session snapshots to **localStorage** (`quiz-session.tsx:238-243`,
  deliberately localStorage rather than sessionStorage so Continue survives
  closing the browser).
- `drill-screen.tsx` has **7 `useEffect`s**, which is the surface an infinite
  loop would live in.
- That the tester cleared localStorage and it persisted is the confusing part.
  Either the clear was on a different origin, or React state rewrote the snapshot
  immediately. Worth establishing first, because it decides whether an escape
  hatch is even possible.

## Why it is unsurvivable rather than annoying

See task 15: nothing is written to `history.json` until a session **completes**.
So a session that can never complete destroys everything done in it. The tester
answered 18 questions correctly and ended with an empty history file.

## Fix, in order

1. **Reproduce it.** Drive a real session through round 2 into round 3. The
   Playwright harness in `feat/e2e-tests` is the right tool: it already seeds
   history and config deterministically.
2. **Find the render loop.** `Maximum update depth exceeded` names a component and
   a stack in dev; capture it. Suspect the effects in `drill-screen.tsx` that
   write to session state.
3. **Make the escape hatches actually work regardless.** Discard, End quiz and
   Clear knowledge base must be able to tear down a session even when the drill is
   mid-loop. They are the last line of defence and all three failed.
4. **Add an E2E test that plays a full multi-round session to completion.** The
   existing lesson spec stops at round 1, which is why this was invisible.

## Done when

- A full three-round session completes reliably.
- Discard and Clear knowledge base work from any state, including a broken one.
- An E2E test covers rounds 2 and 3, not just the first.

---

## Resolved 2026-07-20, merged `abc454c`

**The cause was not a component-internal render loop.** It was a loop *between
browser tabs*.

`saveNow` published on every state change. A second tab adopting that snapshot
replaced `active` with a freshly parsed object describing the same quiz;
`drill-screen.tsx` keyed its mount effect on object identity, so it re-ran
teardown and setup on every adoption; `onMount` ends in `syncProgress()`, which is
a *new* state change arriving after the adoption guard was consumed, so it
published straight back. The guard suppressed the update that adopted, but not the
updates adoption caused.

Measured: **13,984 snapshot writes in 3 seconds** with two tabs open and nothing
touched. Zero with no drill mounted.

**The freeze was a separate, fatal state.** `/quiz` redirects to `/session` when
there is no leg; `/session` redirects to `/quiz` when the phase is drilling. Both
guards are individually correct and mutually fatal in that one state: 1,401
navigations in 4 seconds, nothing painted, **every control unclickable**. That is
why End quiz, Look again, Discard and Clear knowledge base all died at once. They
were never broken; they were unreachable.

### The fix
- `saveNow` no longer publishes a payload identical to what is stored. Comparing
  the payload needs to know nothing about causation, unlike guarding the adopting
  update.
- New `ActiveQuiz.legId`; the drill keys its lifecycle on that rather than object
  identity. Removes the pump independently of the loop fix.
- A removed key is adopted as a clear, so a surviving tab cannot resurrect a
  discarded session.
- `recoverLostLeg()` repairs the lying state rather than relaxing either route
  guard. `roundStats` already held the answers.
- Clear knowledge base calls `clearAllRuns()`, removing the snapshot outright
  rather than waiting for a save effect, since a learner reaching for it may have
  an app that is not re-rendering.

### Verification
7 new e2e tests. **4 fail on pre-fix code and pass after**, confirmed
independently by checking out `d972902` and running them there: the storm, the
deadlock, Clear knowledge base, and cross-tab clearing.

3 pass pre-fix, which corrected two errors in the original task write-up:
- **Rounds 2 and 3 are not special.** The three-round path passes on unmodified
  code. The tester's round-2 framing was a coincidence of when they opened a
  second tab.
- **Discard was never broken in isolation.** It failed for the tester because
  another tab wrote the session back and because the deadlock made the click
  unreachable. Only Clear knowledge base had its own defect: it wiped server
  history and left every run in localStorage.

Totals after merge: tsc clean, 1035 unit, 64 e2e.

### Note for task 15
`recoverLostLeg` gives a defined commit point for a lost round. Per-round
persistence should write through the history API so it does not interact with
`saveNow`'s idempotence check.
