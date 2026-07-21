# P0 · Nothing is saved until a session completes

**Status: done** — fix/persist.

## Settled

- Commit unit: **per completed round**. Per answer loses nothing extra but
  multiplies the corruption window on a write path that was non-atomic. The
  write is now atomic too, which weakens that argument — but a round is still
  the natural unit of work and the retry queue makes the difference small.
  ONE HOLE REMAINS, and it is named rather than hidden: the round-complete
  fork. A round is committed when it CLOSES, and closing happens at "Complete
  round" or "Done for now". A learner who finishes a round's drill, lands on
  the fork, and walks away from there still has nothing durable. Committing per
  LEG (at `finishQuiz`) would close it, costs nothing extra, and needs no
  subtraction — each leg's stats are its own and disjoint. Left for whoever
  picks this up next.

## What happened

The tester answered **18 questions correctly** across two rounds. Afterwards:

- **Progress** said *"Nothing yet. Drill something and it will show up here"*
- **Progress** said *"Kana 0 of 214"*
- **Practice** said *"Everything I have seen: 0"*
- **`history.json` on disk was still 33 bytes** — the empty starting state

Nothing they had done existed anywhere.

## Why this is P0 rather than a design choice

On its own, "we commit at the end of a session" is defensible. Combined with task
14, it is fatal: a session that cannot complete takes everything in it with it.
The two findings multiply.

It also quietly contradicts what the app tells you. The rest screen says
*"Reloading or closing the page will not lose your progress"* — true of the
in-flight session snapshot in localStorage, but a learner reads it as "my answers
are safe", and they are not in any durable sense.

## Related, from the test-suite audit

The write path is fragile even when it does fire:

- `history.ts:29-46` swallows a parse failure and returns empty history, and every
  mutator is a read-modify-write on top of that, saved with a bare non-atomic
  `writeFileSync`. One truncated write and the next save replaces a recoverable
  file with a shell.
- Completed sessions are posted fire-and-forget with `.catch(() => {})` while local
  state advances regardless. Offline, or a tab closed mid-flight, and the finished
  session vanishes silently.

## Fix

1. **Persist per round, not per session.** A completed round is a real unit of
   work and the natural commit point. It also makes task 14 survivable rather than
   catastrophic.
2. **Make the write atomic** (temp file plus rename) and refuse to write when the
   load failed.
3. **Surface a failed save.** Fire-and-forget on the one call that makes a
   learner's work durable is the wrong trade. It does not need a dialog, but it
   cannot be silent.
4. Consider showing something on Progress mid-session, so "Nothing yet" after
   eighteen correct answers cannot happen.

## Done when

- Answers survive a session that is never completed.
- A corrupt or unreadable history file is never overwritten.
- A failed save is visible to the learner.
