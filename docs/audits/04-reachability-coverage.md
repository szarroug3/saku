# Audit 04: reachability/coverage audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: not a walkthrough — an algorithmic check of whether every item in the underlying data (every VOCAB word, every kanji, every grammar recipe, every counter category) actually has a path through the real scheduler, from an empty history.

**Role**: none needed — this is closer to a script/test run with an agent reading and root-causing the output than a persona-driven investigation.

## Why this matters — a walkthrough structurally can't catch it

A sampled walkthrough of the curriculum can only report on what it actually encounters — it has no way to notice something that's never reachable at all, which is structurally invisible to a walkthrough of any depth. This bug class already happened here: `docs/interleaved-schedule-findings.md` found 75% of curriculum vocabulary was silently unreachable (a single-Han-character assumption buried in `teach-unit.ts`), and two entire tracks (keigo, transitivity) were almost completely stuck behind `blockedBy` gates that could never clear — none of it showed up in ordinary use, only from simulating the scheduler against the full universe of content and diffing.

## What to check

For every track, run the real scheduler (`nextTrackLesson`/`unit-scheduler.ts`, the same production code, not a reimplementation) from an empty history until nothing is schedulable anywhere, honoring real cross-track `blockedBy` gates. Diff what got taught against the full universe of what OUGHT to be teachable. Every item with zero path is a finding. Where something IS reachable but only after an implausible amount of setup (a keigo set needing 60+ vocab lessons first), report the reachability *cost*, not just a binary yes/no.

## Execution note

The cheapest of the ten audits in this folder to actually run — mostly a script, not agent judgment. `src/lib/content/interleaved-schedule.test.ts` already does almost exactly this (a round-robin simulation across every `UNIT_TRACK`, real `blockedBy` gates honored) — extend or run it directly rather than building from scratch. No browser needed. Where agent reasoning genuinely helps: root-causing PATTERNS across many orphaned items (the single-Han-character bug explained 6,906 orphans with one root cause, not 6,906 separate findings), not just listing every unreachable item flatly.

## Verify technique

The risk here isn't a plausible-but-wrong claim, it's a stale or incomplete "full universe" list to diff against — confirm the enumeration of "everything that OUGHT to be teachable" is itself complete (every VOCAB row, not a subset; every recipe, not just the ones with existing examples) before trusting a coverage percentage.
