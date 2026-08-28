# Audit 01: naive-learner audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: the guided curriculum (Learn), practice/quiz drilling, and Library reference pages, walked as a real beginner would experience them.

**Role**: a deliberately-ignorant persona. An LLM agent auditing this app already knows Japanese — it can't literally forget kana, vocabulary, or grammar. If it just answers every quiz question correctly from its own knowledge, the audit measures nothing: of course a fluent reader can complete a beginner course.

## The one rule that makes this audit work

**The agent may only draw on a running "taught-ledger" — a log of exactly what the app itself has explicitly presented as content so far, in this run — never its own background knowledge of Japanese.** Before answering anything (a quiz question, a "do you already know this" prompt, a lesson comprehension check), check the ledger first:
- If the fact being tested is in the ledger, answer it as a diligent-but-fallible beginner would — mostly right, with occasional *realistic* mistakes (a plausible romaji mix-up, a confused look-alike kana, a not-quite-right conjugation) rather than either perfect recall or generic random wrongness. Simulating realistic mistakes, not just "right or don't-know," gives a truer retention signal and can itself surface UX gaps (does the app's error feedback actually help with the mistake a real beginner would make?).
- If it is **not** in the ledger, this is itself a finding — the app is testing something it hasn't taught yet. Log it as a gap and answer as a genuine beginner would when faced with the unknown (a plausible guess, never the real answer pulled from the model's own knowledge).

**The ledger is a literal structured log** (a table or JSON maintained and reported back verbatim — fact, form, when/where it was taught), not a self-report summarized from memory at the end — this lets the synthesis pass machine-check "was this quizzed thing actually in the ledger at that point" instead of trusting a retrospective claim.

## Scope and unit of work

One agent per TRACK — re-derive the current track list from the app's own taxonomy at audit time (see `src/lib/content/interleaved-schedule.test.ts` and `UNIT_TRACKS`) rather than trusting any list written here, since it changes as the curriculum grows. As of this writing: kana, vocab, numbers, grammar, sentence, keigo, transitivity. Also worth a pass, even though they're not scheduler "tracks": the Library (reference pages a real learner would browse) and radicals/kanji-component teaching.

**Not every track is reachable in isolation.** `keigo` and `transitivity` gate their content behind `blockedBy: [wordEntry(theirPlainVerb)]` — they don't unlock until enough of the `vocab` track has been learned. Re-derive current gating from the real code (`interleaved-schedule.test.ts`'s own `blockedBy` walk) rather than assuming — it's changed before. A gated track's agent must ALSO walk its gating track far enough, in the same continuous session, to actually unlock it; a shallow, isolated agent auditing a gated track alone would sit permanently blocked, which is a broken test setup, not a finding. If several gated tracks share one gate (today, both keigo and transitivity gate on vocab), one agent can reasonably cover the gate plus everything it unlocks in one longer session. Report the gate-clearing cost (how much of the gating track had to be walked) as its own finding — that number says something real about how reachable the gated track is for an actual learner.

Each independent-track agent starts from a genuinely fresh browser session — Saku's progress lives entirely in browser `localStorage` ("Your progress is saved in this browser only"), so a brand-new tab with no prior history *is* a clean-slate learner; no seeding or reset script needed. A gate-plus-gated-track agent uses ONE fresh tab for its whole session, not one per track, since the point is that progress carries across them.

Needs live browser tools and a running dev server — this audit is a real interactive walkthrough, not code/data reading.

## What each agent does, and logs

1. **Learn** — walk the guided curriculum for the track (and its gate, if any), lesson by lesson, logging every taught fact into the ledger as it's presented.
2. **Practice/Quiz** — drill on what's been taught so far, answering strictly from the ledger, tracking accuracy.
3. **Library** — browse the track's reference pages as a real learner would, not just the forced curriculum path, noting anything unclear or jargon-heavy.

Log: the ledger itself; every untaught-prerequisite hit (quizzed/assumed before taught — a repeat bug class, see `docs/interleaved-schedule-findings.md`); a retention estimate (accuracy answering strictly from the ledger); UX friction, quoting the actual copy, not paraphrasing; gate-clearing cost for gated tracks; any bug hit incidentally while doing a real walkthrough (this style of audit has found real, otherwise-invisible bugs before — a quiz-count mismatch and a text-wrapping regression both surfaced from live-usage-shaped reports, not code review).

**Clarity rubric**, so ratings are comparable across tracks and across runs over time: rate each lesson 1-4 — (1) clear on first read, (2) clear after re-reading, (3) had to guess/infer the point, (4) still unclear after the lesson ended. Report the distribution per track, not just an average — mostly-1s-with-a-few-4s is a different problem than evenly spread.

## Depth

Walking a track's *entire* curriculum can be very long (numbers alone had 1,814 lessons in one measured run). Smoke check: first N lessons per independent track (e.g. 15-20) — for a gated track, still walk the gate as far as it actually takes to unlock (not optional), then apply the sample depth to the unlocked track. Full sweep: the whole track, since gaps can appear anywhere (the keigo/transitivity reachability bugs were deep in the curriculum, not near the start). State the chosen depth explicitly per agent so results compare cleanly across tracks.
