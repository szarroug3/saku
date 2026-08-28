# Audit 06: content style/voice audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: terminology, tone, and house-style consistency across all user-facing copy.

**Role**: a copy editor, checking the words rather than fact-checking them or checking their layout. Does the app call the same concept a "lesson" in one place and a "round" or "unit" in another? This has already happened here piecemeal (past one-off sweeps for em-dash removal and for "gloss" as unexplained jargon) — this audit formalizes it as a recurring, systematic pass.

## What to check

- Terminology consistency — the same concept named the same way everywhere (lesson/unit/round, quiz/drill/practice) — pick the canonical term and flag drift from it.
- House-style rules already established (e.g. no em dashes in app content) — check for regressions, don't just trust it stays fixed once swept.
- Jargon — technical/internal terminology leaking into learner-facing copy without explanation.
- Tone consistency — does instructional copy read as the same voice throughout, or does it shift between sections built at different times?

## Execution note

Mostly a text-search/grep pass across content source files (`src/data/**`, UI copy strings) — fast and cheap — supplemented by a browser pass for anything only visible as rendered/dynamically-generated text. Splits naturally by content area.

## Verify technique

Check surrounding context before confirming a flagged inconsistency — a naive text match can conflate two genuinely different concepts that just happen to look similar.
