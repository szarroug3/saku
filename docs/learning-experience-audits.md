# Saku learning-experience audits

Ten companion audits, all recurring, not one-offs: read this doc fresh each time any of them runs, rather than re-deriving the design from scratch.

- **Audit 1 — naive-learner audit.** A deliberately-ignorant persona walks the app to find *gaps and ordering bugs*: content quizzed before it was taught, confusing UX, dead ends. Doesn't care whether the content itself is correct — only whether it was taught before it was tested, and whether teaching landed.
- **Audit 2 — fact-checking audit.** An expert persona reviews the app's actual content to find *correctness and pedagogy bugs*: wrong readings, wrong grammar explanations, unnatural example sentences, wrong pitch accent, or content that's technically correct but poorly explained. Doesn't simulate a learner's progression at all — reviews content directly.
- **Audit 3 — UX audit.** A design/QA persona reviews the interface itself — layout, visual consistency, interaction bugs, responsiveness, accessibility — independent of whether the content flowing through it is correct or well-ordered.
- **Audit 4 — reachability/coverage audit.** Not a walkthrough at all — an algorithmic check of whether everything in the underlying data actually has a path through the real scheduler. Catches the class of bug a sampled walkthrough structurally can't: something that's never reachable at all.
- **Audit 5 — data-integrity/ingest audit.** Checks the generated data pipeline itself (vocab.json, pitch.json, the grammar corpus, etc.) for internal consistency and staleness against its sources — separate from Audit 2, which checks whether specific taught content is correct.
- **Audit 6 — content style/voice audit.** Terminology, tone, and house-style consistency across all user-facing copy — separate from Audit 3, which is layout/visual, not wording.
- **Audit 7 — code/architecture audit.** Not learner-facing at all: data/component/API layer consistency, soundness, and scalability of the codebase itself.
- **Audit 8 — sync/multi-device audit.** Does signing in and using the app across more than one device/browser actually keep progress consistent — no silent data loss, no unresolved conflicts?
- **Audit 9 — performance audit.** Real load-time and interaction-latency measurement, especially true COLD-START conditions — with independent re-verification, so a finding isn't just one environment's (or one person's) impression.
- **Audit 10 — multi-signal disagreement resolution audit.** A smaller, focused audit with two related jobs, both surfaced by the SAK-215/216/218 pronunciation work: (1) whenever a check produces more than one independent signal about the same fact (bare reading vs. katakana vs. kanji-in-context), EVERY disagreement gets triaged and either resolved or explicitly flagged as unresolved, not just the ones fitting a clean majority pattern; (2) whenever a seed/cache script claims to cover "everything," that claim gets checked against what the live app can actually request, not trusted on faith (the SAK-216 distractor-clip gap is the direct precedent).

They're complementary on purpose, each catching a bug class the others structurally can't: a naive learner can't tell you a grammar rule is wrong (they don't know enough to doubt it); an expert reviewer walking through in order doesn't reliably surface "this was quizzed before it was taught"; a sampled walkthrough (Audits 1-3) can't surface something that's *never reachable at all* (Audit 4's whole job); content can be correct (Audit 2) while its underlying data pipeline is quietly drifting (Audit 5); copy can be individually fine while inconsistent app-wide (Audit 6); the product can be flawless while the code underneath it is fragile in ways that will bite the NEXT change (Audit 7); everything above can be perfect on ONE device and still lose data the moment a second device enters the picture (Audit 8); everything can be correct, well-ordered, well-coded, and consistent while still being slow to actually use (Audit 9); and a multi-signal check can quietly under-report by only acting on the disagreements that fit a clean pattern, silently leaving the rest uninvestigated (Audit 10, the exact gap Sam caught in the SAK-215/218 work: 885 of 893 raw disagreements were never actually resolved, just excluded from the confirmed-bug list). Run them separately.

No prior instance of any of these audits was found in Linear or session memory as of 2026-08-28 — if Sam has notes from an earlier run that predate this doc, fold them in and update this file. Sam's own read on this (2026-08-28): "we've done many many audits like this before and it's clearly not caught them before because i'm still finding bugs every day" — which is exactly why Audit 2 exists as a formal, systematic pass now rather than relying on catching things by ear/eye during ordinary use, and why the verify stage below is the DEFAULT, not an optional upgrade.

---

## Ground rules: audits investigate, they don't act

Sam (2026-08-28): "none of the audits should make any actual changes to code or production databases or anything. they should write up reports somewhere so you can then review them and create cards for anything we think needs to be fixed." This applies to all ten audits, without exception, and overrides anything in an individual audit's section below that could be read as implying otherwise.

- **No source edits.** An audit agent reads code and data; it never opens an Edit/Write on a real source file. Not even a "small" fix, not even something that looks obviously safe mid-investigation — flag it in the report instead.
- **No mutating scripts against real infrastructure.** No writes to production Supabase (database or Storage), no running a seed/regeneration script against real data, no deletes, no `--execute`-style flags on anything real. Where a check genuinely needs to exercise a script (Audit 5's "regenerate and diff" check, for instance), run it against a LOCAL/scratch output and diff against the committed file — never overwrite the committed file, never point it at production.
- **No commits, no merges, no Linear changes.** An audit doesn't touch git history or ticket state. Findings go into the report; converting a finding into an actual Linear ticket, and fixing it through the normal worktree → agent → review → merge workflow this session already uses for everything else, happens AFTERWARD, as a separate, deliberate step — reviewed by Sam or by Claude reading the report, not automatically by the audit itself.
- **Where an audit genuinely needs to produce real state to observe something** (Audit 8 specifically — testing sync requires actually creating some progress to see whether it syncs), use a disposable/test account, never Sam's own real account or real production user data, and treat whatever gets created as throwaway.
- **The deliverable is always a report**, not a diff. Publish it (an Artifact is the established pattern throughout this doc), and treat "what should we actually go fix" as a separate decision made AFTER reading it — the same review-then-ticket rhythm already used all session for everything found through direct investigation (SAK-210, SAK-215, SAK-216, SAK-217, SAK-218 were all filed and fixed this way, one at a time, reviewed before merging — audits should feed that same pipeline, not bypass it).

---

## Audit 1: naive-learner audit

Simulate a real beginner with **zero prior Japanese knowledge** working through Saku, and report how much they'd actually learn, where the app teaches things out of order, where it's confusing, and what's missing.

### Why this is hard, and the one rule that makes it work

An LLM agent auditing this app already knows Japanese — it can't literally forget kana, vocabulary, or grammar. If the audit agent just answers every quiz question correctly from its own knowledge, the audit measures nothing: of course a fluent reader can complete a beginner course. The entire audit's validity rests on one discipline, enforced explicitly in every audit agent's brief:

**The agent may only draw on a running "taught-ledger" — a log of exactly what the app itself has explicitly presented as content so far, in this run — never its own background knowledge of Japanese.** Before answering anything (a quiz question, a "do you already know this" prompt, a lesson comprehension check), the agent checks its own ledger first:
- If the fact being tested is in the ledger, answer it as a diligent-but-fallible beginner would — mostly right, with occasional *realistic* mistakes (a plausible romaji mix-up, a confused look-alike kana, a not-quite-right conjugation) rather than either perfect recall or generic random wrongness. Decided 2026-08-28: simulating realistic mistakes, not just "right or don't-know," gives a truer retention signal and can itself surface UX gaps (e.g. does the app's error feedback actually help with the mistake a real beginner would make?).
- If it is **not** in the ledger, this is itself a finding — the app is testing something it hasn't taught yet. Log it as a gap and answer as a genuine beginner would when faced with the unknown (a plausible guess, never the real answer pulled from the model's own knowledge).

**The ledger is a literal structured log** (a table or JSON the agent maintains and reports back verbatim — fact, form, when/where it was taught), not a self-report summarized from memory at the end. Decided 2026-08-28: this lets the synthesis pass machine-check "was this quizzed thing actually in the ledger at that point" instead of trusting the agent's own retrospective claim.

Everything else in this playbook exists to make that one rule practical to follow and to structure what comes out of it.

### Scope: tracks to cover

Use the app's own track taxonomy as the coverage checklist, not an ad hoc list — this guarantees nothing is skipped by oversight. As of this writing (see `src/lib/content/interleaved-schedule.test.ts` and `UNIT_TRACKS`) the tracks are:

- kana (hiragana/katakana)
- vocab (words)
- numbers (counting/counters)
- grammar
- sentence
- keigo
- transitivity (verb pairs)

Re-derive this list from the actual code at audit time rather than trusting this snapshot — the track list can change as the curriculum grows (it has before: see `docs/interleaved-schedule-findings.md`, where two tracks turned out to be almost entirely unreachable and needed root-cause fixes before this kind of walkthrough would even be meaningful).

Also worth a pass, even though they're not scheduler "tracks": the **Library** (reference pages a real learner would browse, not just the guided curriculum) and **radicals/kanji-component** teaching, which the app treats as its own layer under vocab/kanji.

### Cross-track dependencies — some tracks can't be audited in isolation

**Not every track is reachable on its own.** `keigo` and `transitivity` gate their content behind `blockedBy: [wordEntry(theirPlainVerb)]` — they don't unlock until enough of the `vocab` track has been learned (see `docs/interleaved-schedule-findings.md`: at time of writing keigo needed most of its 9 units' plain verbs known, transitivity needed real progress across 69 pairs). A shallow, isolated "first 15 lessons of keigo" agent would never see ANY real keigo content — it would sit permanently blocked, and that's not a finding, it's a broken test setup.

Before assigning agents, re-derive current gating from the real code (`interleaved-schedule.test.ts`'s own `blockedBy` walk is the authoritative source — don't hand-guess which tracks are gated, that's exactly the kind of assumption that's gone stale before). Then:
- **Independent tracks** (reachable from an empty history with no cross-track gate) can each get their own isolated parallel agent, as below.
- **Gated tracks** must be assigned to an agent that ALSO walks the gating track far enough, in the same continuous session, to actually unlock them — never audited starting from a fresh state that can structurally never reach them. If several gated tracks share one gate (today: both keigo and transitivity gate on vocab), one agent can reasonably cover the gate track plus all the tracks it unlocks in one longer session, rather than several agents that never get anywhere.
- For a gated track, "depth" (below) means: walk the gate however far it takes to unlock, THEN apply the smoke-check/full-sweep depth to the track itself. Report the gate-clearing cost too (how much of the gating track had to be walked) — that number is itself a finding about how *reachable* the gated track really is for a real learner.

### Execution shape

Each track-agent's run, in order:
1. **Learn** — walk the guided curriculum for that track (and its gate, if any — see above), lesson by lesson, logging every taught fact into the ledger as it's presented (the glyph/word/pattern, its reading, its meaning, any example given).
2. **Practice/Quiz** — drill on what's been taught so far, answering strictly from the ledger per the rule above, tracking accuracy.
3. **Library** — spend some time browsing that track's reference pages as a real learner would (not just the forced curriculum path), noting anything unclear, jargon-heavy, or missing context a beginner would need.

Each independent-track agent starts from a genuinely fresh browser session — Saku's progress lives entirely in browser `localStorage` (confirmed in-app: "Your progress is saved in this browser only"), so a brand-new tab with no prior history *is* a clean-slate learner. No seeding or reset script needed; just don't reuse a tab that has any prior activity. A gate-plus-gated-track agent uses ONE fresh tab for its whole session (gate + everything it unlocks), not a fresh tab per track, since the whole point is that progress carries across them.

### Depth: a tunable knob, not a fixed number

Walking a track's *entire* curriculum can be very long (numbers alone had 1,814 lessons in one measured run — see `docs/interleaved-schedule-findings.md`). Pick a depth appropriate to why the audit is running:
- **Smoke check** (quick, cheap): first N lessons per independent track (e.g. 15-20), enough to catch onboarding-quality issues and obvious ordering bugs. For a gated track, still walk the gate as far as it actually takes to unlock (that's not optional), then apply the same N-lesson sample to the now-unlocked track.
- **Full sweep** (thorough, before a release or after a big curriculum change): the whole track, or as much as time/budget allows, since gaps can appear anywhere (the keigo/transitivity reachability bugs were deep in the curriculum, not near the start).

State the chosen depth explicitly in each agent's brief — don't leave it implicit, or agents will pick inconsistent depths and the findings won't compare cleanly across tracks.

### What each track-agent logs

- **Taught-ledger**: the structured log itself (see above), everything actually presented in order, with a clarity rating per lesson (see rubric below).
- **Untaught-prerequisite hits**: every time something was quizzed/assumed before it was taught — this is a *repeat* bug class (see `docs/interleaved-schedule-findings.md`'s reachability bugs), so a track scoring zero here is itself worth confirming isn't a false negative from too-shallow a depth.
- **Retention estimate**: rough accuracy answering strictly from the ledger, with realistic mistakes — this operationalizes "how much would a real learner actually retain."
- **UX friction**: confusing terminology, unclear instructions, dead ends, anything a genuine beginner would stumble on. Quote the actual copy, don't paraphrase.
- **Gate-clearing cost** (gated tracks only): how much of the gating track had to be walked before this track produced any real content.
- **Bugs encountered in the wild**: crashes, wrong content, broken interactions hit incidentally while doing a real walkthrough — this style of audit has found real, otherwise-invisible bugs before (this session alone: a quiz-count mismatch and a text-wrapping regression both surfaced from live-usage-shaped reports, not code review).

**Clarity rubric** (decided 2026-08-28, so ratings are comparable across tracks and across runs over time): rate each lesson 1-4 — (1) clear on first read, (2) clear after re-reading, (3) had to guess/infer the point, (4) still unclear after the lesson ended. Track the distribution per track, not just a average — a track that's mostly 1s with a few 4s is a different problem than one that's evenly spread.

### Synthesis

After every track-agent finishes, one synthesis pass:
- Cross-track comparison — which tracks teach cleanly, which don't, including gate-clearing cost for gated tracks.
- Every untaught-prerequisite hit, deduped and prioritized (these are the closest thing to hard bugs this audit finds).
- Clarity-rubric distributions per track, and how they compare to the last time this ran (if there was one).
- A prioritized punch list, most-severe first, not just a wall of observations.
- Publish as a shareable report (an Artifact is a good fit — this is a deliverable with an audience, not a private scratch note) so findings are easy to review and hand off into Linear tickets for whichever ones get actioned.

---

## Audit 2: fact-checking audit

Verify that what the app teaches is actually **correct**, and that the way it's taught is **clear and easy to digest** — independent of whether it was taught in the right order (that's Audit 1's job).

### Persona: the opposite of Audit 1

This audit uses the agent's **full real Japanese knowledge**, deliberately — the point is to catch errors a naive learner has no way to notice (they don't know enough to doubt the app), the way an expert reviewer would. No taught-ledger, no simulated ignorance. Cross-reference against real authoritative sources where the app itself claims to (JMdict for readings/meanings/pos, Kanjium for pitch accent — the app already treats these as ground truth for its own data, so this audit should verify the app's *ingested* data actually matches them, not just that the app is internally self-consistent).

This is the general, systematic version of what the SAK-215/216/218 pronunciation bug hunt did by hand this session (2026-08-28) — that work is a concrete proof of this audit's value: a real, common word (八, "eight") was mispronounced in production and nobody had systematically checked.

### What to check, per track

- **Readings**: does every taught reading match the authoritative source (JMdict/Kanjium)? (Direct precedent: the SAK-215/218 sweeps, which together confirmed 34 distinct readings — 36 words, several sharing a reading — where synthesis diverged from the intended pronunciation; see Audit 10 for the 885 more that were flagged but never resolved either way.)
- **Pitch accent**: does the app's pitch data match Kanjium, not just "is it internally consistent"? An ingest bug could mean pitch.json itself is wrong, which no amount of app-logic correctness would catch.
- **Meanings/glosses**: accurate, not misleading, appropriately scoped for a beginner (not a rare/archaic sense presented as primary).
- **Grammar explanations**: is the rule as stated actually correct Japanese grammar — not just internally consistent with how the app applies it elsewhere?
- **Example sentences**: natural, idiomatic Japanese, not awkward or unnatural constructions a native speaker wouldn't actually say.
- **Pedagogical clarity**: even when factually correct, is the explanation well-sequenced, appropriately scaffolded for a beginner, free of unexplained jargon? This overlaps with Audit 1's clarity rubric but is judged by an expert who can tell whether an explanation is *actually* correct-but-confusing vs. correct-and-clear, which a naive-persona agent can't reliably distinguish.
- **Internal consistency**: does the same fact get taught/explained the same way everywhere it appears (Library page, lesson card, quiz prompt, worked example)?

### Execution shape

Unlike Audit 1, this one does **not** need to simulate sequential unlocking — an expert reviewer doesn't need to "earn" access to content the way a learner does. Each track can be reviewed directly (Library pages, generated curriculum data, worked examples) in any order, independently and in parallel, with no gating concerns. This makes it structurally simpler and more parallelizable than Audit 1.

### Output

Same shape as Audit 1: a synthesis report, prioritized by severity, published as a shareable Artifact. A confirmed content bug (wrong reading, wrong pitch, wrong grammar rule) is more urgent than a clarity complaint — the app is actively teaching something false, not just teaching it awkwardly. Route confirmed bugs into Linear tickets the same way SAK-215/216/217/218 were.

---

## Audit 3: UX audit

Verify the interface itself is clean, consistent, polished, accessible, and free of interaction bugs — independent of whether the content it's presenting is correct (Audit 2) or well-ordered (Audit 1).

### Persona: design/QA reviewer

Not simulating a learner and not fact-checking content — paying close attention to the interface itself. Screenshot-driven, comparative (does this component look/behave the same everywhere it appears?), and willing to poke at edges (resize the viewport, try keyboard navigation, hit back/forward) rather than just following the golden path.

### The shortcut: `/dev/*` pages give near-total coverage without walking the curriculum

The app already has dev-only reference pages built for exactly this (see [[dev-pages-are-kept]] — they're intentional, never delete them): `/dev/quiz-gallery` shows one example of every quiz question type in one place; `/dev/views`, `/dev/swatches`, `/dev/library`, `/dev/learn`, `/dev/scheduling`, `/dev/numbers`, `/dev/pitch-accent` cover the rest. Start a UX audit here, not by walking the full curriculum looking for every screen type to naturally show up — it's the same coverage in a fraction of the time. Supplement with a handful of real pages (a real lesson, a real quiz session end-to-end, Settings, Progress) to catch anything that only appears in a live flow, not a static gallery.

### What to check

- **Visual consistency**: does every instance of a shared component (option grids, footers/docks, cards, headers) actually look and behave the same everywhere it appears, or has one surface drifted from the established pattern? (Direct precedent: several past tickets — box-chrome audits, top-bar background audits — exist because this drifts in practice, not hypothetically.)
- **Layout bugs**: overflow, text wrapping mid-word, misaligned elements, inconsistent spacing. (Direct precedent: SAK-207, a real tile-sizing bug found this session.)
- **Responsive/mobile**: use `resize_window`'s mobile/tablet presets — is anything cramped, overlapping, or unusable at small viewports?
- **Interaction bugs**: dead clicks, missing focus states, broken keyboard navigation, janky/missing transitions.
- **Accessibility**: missing accessible names on controls, color contrast, focus indicators legible in both themes.
- **Light/dark theme**: check both — a color token defined in only one theme's block is a real, recurring class of bug in this codebase (see the artifact-design conventions this session already leans on for the same reason).
- **Cross-page consistency**: does the same TYPE of screen (a lesson card, a quiz card, a settings row) feel like the same app everywhere, or do different corners feel like they were built at different times with different conventions?

### Execution shape

Like Audit 2, no sequential-unlock concern — the `/dev/*` pages plus a handful of representative real flows can be reviewed directly, in parallel, by however many agents make sense split by surface area (e.g. one agent per `/dev/*` page plus one covering real end-to-end flows). Genuinely benefits from live browser tools and screenshots more than either other audit — this is the one where "look at it" is the actual method, not a fallback.

### Output

Same shape as the others: synthesis report, prioritized by severity, published as an Artifact, confirmed findings routed to Linear tickets.

---

## Audit 4: reachability/coverage audit

Not a walkthrough — an algorithmic check of whether every item in the underlying data (every VOCAB word, every kanji, every grammar recipe, every counter category) actually has a path through the real scheduler, from an empty history.

### Why this is its own audit, not part of Audit 1

Audit 1 walks a sample of the curriculum and can only report on what it actually encounters. It has no way to notice something that's never reachable at all — that's not a "didn't get to it" gap, it's structurally invisible to a walkthrough of any depth. This exact bug class already happened here: `docs/interleaved-schedule-findings.md` found 75% of curriculum vocabulary was silently unreachable (multi-character words never became teaching units — a single-Han-character assumption buried in `teach-unit.ts`), and two entire tracks (keigo, transitivity) were almost completely stuck behind `blockedBy` gates that could never clear. None of that showed up in ordinary use; it showed up from simulating the scheduler against the FULL universe of content and diffing.

### What to check

For every track, run the real scheduler (`nextTrackLesson`/`unit-scheduler.ts`, the same production code — not a reimplementation) from an empty history until nothing is schedulable anywhere, honoring real cross-track `blockedBy` gates exactly as the app enforces them. Diff what got taught against the full universe of what OUGHT to be teachable for that track. Every item with zero path is a finding. Where something IS reachable but only after an implausible amount of setup (a keigo set that needs 60+ vocab lessons first), report the reachability *cost*, not just a binary yes/no — a technically-reachable-but-absurdly-gated item is still a real problem.

### Execution shape

The cheapest of all ten audits to actually run: this can mostly be a script/test, not agent judgment — `src/lib/content/interleaved-schedule.test.ts` already does almost exactly this (a round-robin simulation across every `UNIT_TRACK`, real `blockedBy` gates honored) and is the right place to extend or run directly, not a from-scratch build. No browser needed at all. Where agent reasoning genuinely helps is the synthesis pass: root-causing PATTERNS across many orphaned items (the single-Han-character bug explained 6,906 orphans with one root cause, not 6,906 separate findings) rather than just listing every unreachable item flatly.

### Verify

Independent re-run against the same production scheduler code, not a re-derivation of scheduling logic — the risk here isn't a plausible-but-wrong claim (as in Audits 1/2), it's a stale or incomplete "full universe" list to diff against. Verify by confirming the enumeration of "everything that OUGHT to be teachable" is itself complete (every VOCAB row, not a subset; every recipe, not just the ones with existing examples) before trusting a coverage percentage.

---

## Audit 5: data-integrity/ingest audit

Checks the generated data pipeline itself — `vocab.json`, `pitch.json`, the grammar corpus, and the other `src/data/generated/*` outputs — for internal consistency and staleness against their sources.

### Why this is its own audit, not part of Audit 2

Audit 2 spot-checks whether specific taught CONTENT is correct (a reading, a pitch value, a grammar rule). This audit checks whether the PIPELINE producing that content is sound — a bug here doesn't show up as "this one word is wrong," it shows up as a whole category being subtly off, or a generated file silently drifting out of sync with the source data it claims to represent (build script changed, generated JSON never regenerated; a re-ingest changes upstream data, nothing downstream notices).

### What to check

- Duplicate entries that should have collapsed into one.
- Orphaned references — a fact ID, a pattern ID, a cross-reference that doesn't resolve to real content anywhere.
- Staleness — does regenerating a data file from its source (where a `build:*` script exists — see `package.json`) produce byte-identical output to what's committed? A mismatch means the committed file is stale.
- Schema violations — missing required fields, a field present for some rows of a type and absent for others with no principled reason.
- Cross-file consistency — does a fact referenced in one generated file (e.g. a pitch entry) actually correspond to a real entry in another (e.g. `vocab.json`)?

### Execution shape

Mostly code/data reading and scripting, no browser needed. Splits naturally by data domain (vocab, kanji, pitch, grammar corpus, counters) — one agent per domain, in parallel.

### Verify

An independent check should actually attempt to regenerate the data from source where a build script exists, and diff against committed output — not just eyeball the committed file and declare it plausible.

---

## Audit 6: content style/voice audit

Terminology, tone, and house-style consistency across all user-facing copy.

### Why this is its own audit, not part of Audit 3

Audit 3 checks the interface's visual/interaction quality. This checks the WORDS, independent of how they're laid out — does the app call the same concept a "lesson" in one place and a "round" or "unit" in another? Does it slip into jargon it elsewhere takes care to avoid? This has already happened here piecemeal (past one-off sweeps for em-dash removal and for "gloss" as unexplained jargon) — this audit formalizes that as a recurring, systematic pass instead of a sweep whenever someone happens to notice.

### What to check

- Terminology consistency — the same concept named the same way everywhere (lesson/unit/round, quiz/drill/practice, etc. — pick the canonical term and flag drift from it).
- House-style rules already established (e.g. no em dashes in app content — see the standing rule for this) — check for regressions, don't just trust it stays fixed once swept.
- Jargon — technical/internal terminology leaking into learner-facing copy without explanation.
- Tone consistency — does instructional copy read as the same voice throughout, or does it shift between sections built at different times?

### Execution shape

Mostly a text-search/grep pass across content source files (`src/data/**`, UI copy strings) — fast and cheap — supplemented by a browser pass for anything only visible as rendered/dynamically-generated text. Splits naturally by content area.

### Verify

Independent confirmation that a flagged inconsistency isn't actually two DIFFERENT concepts that happen to look similar (a false positive a naive text-search is prone to) — check the surrounding context, not just the string match.

---

## Audit 7: code/architecture audit

Not learner-facing: verifies the codebase's data layer, component layer, and API layer are internally consistent, sound, and scalable.

### Why this is its own audit

None of the other nine look at the code itself — they look at what the code produces (content, behavior, UI). This one is about whether the engineering underneath is sound enough to keep changing safely and to hold up as the curriculum keeps growing (it already has grown a lot — see Audit 4's numbers).

### The hard-won lesson this audit already has, from real experience

A prior pass at exactly this kind of audit (SAK-105, data-model/component-reuse drift) first concluded most things were "fine" or "excusable work-in-progress," based on checking one plausible-looking call site per pattern and citing a file's own header comment as evidence of convergence. That was wrong: the actual question is ADOPTION COVERAGE — what fraction of consumers actually use the new pattern vs. still bypass it — and "additive, not yet consumed" is itself a finding to report with real weight, not a reason to wave a section off as low-risk. This audit's verify stage must check EVERY consumer/call site of a flagged pattern, never just the first one that looks right.

### What to check

- Data-model consistency — parallel/duplicate representations of the same concept that should have converged onto one.
- Component reuse — is a shared component/pattern actually adopted everywhere it applies, or do some call sites still hand-roll their own version (and is anything NEW being built that bypasses it, creating more work to converge later)?
- API/data-fetching pattern consistency — consistent conventions for server actions, caching, error handling across the app.
- Scalability — as the corpus/curriculum grows, do algorithms and data structures still hold up, or are there patterns that were fine at an old data size and are starting to strain?
- Type-safety escape hatches — `any`/`unknown` misuse, non-null assertions clustering in ways that suggest fragile code, not principled ones.
- Test coverage gaps in core modules the other six audits' fixes would need to rely on being solid.

### Execution shape

Pure code-reading and static analysis — the opposite end of the spectrum from Audit 3, no browser needed at all. Can lean on this session's existing `code-review` and `simplify` skills as components rather than building entirely from scratch. Splits naturally by layer (data, component, API) or by subsystem.

### Verify

Per the hard-won lesson above: an independent agent must enumerate and check EVERY consumer of a flagged pattern, not just confirm the finder's first example looks right. A finding of "fully adopted, no issue" needs the same rigor as a finding of "not adopted" — both are claims about the WHOLE set of consumers, not one.

---

## Audit 8: sync/multi-device audit

Does signing in and using Saku across more than one device or browser actually keep progress consistent?

### Why this is its own audit

By default, progress lives entirely in one browser's `localStorage` — every other audit in this doc assumes that single-device model. But the app also offers sign-in specifically to "keep it across your devices," which means a real, separate code path (auth, sync/merge logic, conflict handling) that none of the other nine audits touch at all. Sync bugs are a classic, painful, easy-to-miss category precisely because they only show up under multi-device use, which is exactly the condition a single-session audit (or a single-session developer) never naturally exercises.

### What to check

- **Basic sync**: progress made signed-in on device/browser A actually appears on device/browser B after signing in there.
- **Conflict handling**: progress made on TWO devices while briefly offline or out of sync, then both coming back online — does it merge sensibly, or does one device's progress silently overwrite the other's?
- **Sign-in/sign-out transitions**: does switching from signed-out (local-only) to signed-in correctly adopt or merge the local progress that already existed, rather than discarding it?
- **Partial/interrupted sync**: a sync that fails partway through (network drop mid-write) — does it leave data in a broken or duplicated state?
- **What silent data loss would even look like**: since progress rarely gets externally audited (nobody manually recounts their own learned-word count), a real loss could go unnoticed for a long time — this audit should specifically try to construct a scenario where loss would be OBSERVABLE (recording exact counts/state before and after each step) rather than just "try it and see if it feels right."

### Execution shape

Needs at least two independent browser sessions/contexts running the same account in parallel — genuinely a multi-agent-friendly shape, since simulating "device A" and "device B" concurrently is naturally two agents (or one agent driving two browser tabs/contexts) coordinating on timing. Needs real sign-in, so check what auth setup this requires in a test/dev environment before running (see `SAKU_DISABLE_AUTH` and how the e2e suite itself handles auth — it runs signed-out by design, so this audit needs its own approach, not the e2e suite's existing pattern).

### Verify

An independent agent reproduces the same before/after state comparison from a fresh pair of sessions — sync bugs are often timing-dependent, so one successful run doesn't rule out a race condition; verification here should include at least one deliberately-adversarial-timing attempt (both devices writing at nearly the same moment), not just a clean sequential test.

---

## Audit 9: performance audit

Real load-time and interaction-latency measurement — Sam (2026-08-28): "the page still starts slow on cold start and stuff so i want it to audit that and independently verify it's not just me."

### Why this one, despite existing automated coverage

`e2e/page-load-performance.spec.ts` already measures load times across real pages with pass/fail budgets, and there's a `scripts/route_sizes.mjs` script that already computes per-route JS bundle size from the build's client-reference manifests. Neither currently targets true COLD-START conditions specifically (the e2e suite doesn't test cold-vs-warm as a variable at all), which is exactly the condition Sam is describing and exactly the kind of thing that's easy to miss when a developer's own iterative testing naturally runs against an already-warm cache. This audit's first job is figuring out WHY the existing coverage isn't catching what she's feeling — not assuming from scratch that nothing exists.

### Distinguish CLIENT cold start from SERVER cold start — they have different causes and different fixes

- **Client-side**: JS bundle size and hydration cost on a genuinely fresh page load — no cached chunks, no warmed-up runtime. `route_sizes.mjs` is a real head start here; there's already a known, named instance of this exact problem (`/learn` shipping ~8.6MB it never renders — see the perf-learn-bundle refactor plan, not yet done).
- **Server-side**: a cold serverless function boot (if the app's hosting spins functions down after idle), a cold database connection, a cold external-service call (VOICEVOX proxy, Supabase). This is invisible to a bundle-size check and needs actual request-timing measurement, ideally after a real idle period, not back-to-back requests that keep everything warm.

### What to check

- Reproduce genuinely cold conditions per measurement — a fresh incognito/private session with a cleared cache for client cold start; for server cold start, space measurements apart in time (or explicitly trigger after however long this app's hosting takes to spin down, if that's knowable) rather than hammering requests that keep the server warm as a side effect of testing it.
- Measure client and server cold start SEPARATELY and report them separately — don't collapse them into one "the page felt slow" number, since they point at different fixes.
- Check whether `page-load-performance.spec.ts`'s existing budgets are actually calibrated to catch this, or are lenient enough that a real regression could pass — and whether it's testing warm-cache conditions by construction (worth reading closely, not assuming).

### Independent verification — the specific thing Sam asked for

"Independently verify it's not just me" means: don't trust a single measurement from a single environment as proof either way. Concretely — measure from more than one condition (different network-throttle profile, at least one genuinely separate run rather than repeated runs in the same warmed-up session) and have a SECOND, independent pass reproduce the same slow numbers before concluding it's a real, general problem rather than something specific to one particular run, machine, or moment. If the second pass DOESN'T reproduce it, that's itself the finding — report the discrepancy rather than picking whichever result matches the initial impression.

### Execution shape

Mix of live browser measurement (real cold-condition timing) and reading existing tooling (`page-load-performance.spec.ts`, `route_sizes.mjs`, the build output) — split naturally into a client-cold-start agent and a server-cold-start agent, given how different the causes and measurement techniques are.

---

## Audit 10: multi-signal disagreement resolution audit

Two related jobs, both surfaced by the same pronunciation-sweep work: (1) whenever a check produces more than one independent signal about the same underlying fact, EVERY disagreement between those signals gets triaged to a real conclusion, not just the ones that happen to fit a clean pattern; and (2) whenever a seed/cache-generation script claims to cover "everything," that claim gets checked against what the live app can actually request, not trusted because it was correct once.

### Why this is its own audit — the exact gap Sam caught

The SAK-215/218 pronunciation sweeps compared three signals per word reading: the bare hiragana reading (what the app actually sends), the bare katakana reading (a reading that bypasses lexical ambiguity), and the kanji-spelling-in-context reading (disambiguated by a real sentence). A word was only confirmed as a bug when a strict rule held: bare disagrees, AND katakana exactly matches context. That rule is precise and avoids false positives — but out of 893 raw three-way disagreements the broader sweep actually found, only 8 satisfied it. The other **885 were never investigated at all** — bucketed as "noise" (ambiguous alternate kanji readings, long-vowel merge quirks) by pattern-matching what they looked like, not by actually resolving each one. Sam's own framing: "we can't ignore the 885. that is 885 potentially incorrect things." She's right — "didn't fit the clean rule" is not the same as "verified fine," and treating it that way is a real, demonstrated way for bugs to hide in plain sight, which is exactly the pattern behind "i'm still finding bugs every day."

### The report structure Sam specified

Bucket every disagreement into three sections, and handle each differently:

1. **Full agreement** (all signals match): no action needed. Report the count, for coverage tracking — but don't skip reporting it entirely, since "how much was even checked" is itself information.
2. **2-vs-1 split**: the majority is *likely* correct, but "likely" is not "verified" — a 2-1 split could still be two-wrong-one-right if the two that agree happen to share a DIFFERENT quirk the third one avoids (this is a real, structural possibility the original SAK-215/218 rule never checked for, since it only ever treated katakana+context-agree as the trusted pair — it never considered a split where, say, bare+katakana agree and context is the outlier). Actively verify the majority rather than trusting the vote count by default — the same "try to refute it" discipline every other audit's verify stage already uses.
3. **All three disagree**: the hard case, and the one that most needs real investigation rather than a shrug. The agent must actively attempt to determine which signal (if any) is correct — additional context templates, checking whether the word has multiple legitimate readings, whatever the specific domain's version of "gather one more piece of evidence" is. If genuine effort still can't resolve it, the explicit, reportable outcome is **"unresolved — don't know which is correct,"** not silent exclusion. An honest "I don't know" for a specific, named word is a real, actionable finding — it tells Sam exactly which handful of words need her own judgment or a genuinely independent source, instead of vanishing into an unexamined pile of hundreds.

### Where this applies beyond pronunciation

The pronunciation sweep is the concrete case that surfaced this, but the pattern generalizes to any audit that produces more than one independent signal about the same fact and needs a principled way to reconcile them — worth remembering as a REUSABLE VERIFY-STAGE PATTERN, not just a one-off fix to Audit 2's method. Apply it wherever a "verify" step above already involves comparing multiple checks against each other, not just a single check against a single source.

### Also check: does the seed script actually cover everything it should

A second, related job for this audit, surfaced by the same investigation: verify that a seed/cache-generation script's own enumeration of "everything that needs pre-generating" is actually complete — not trusted because it once was.

**Direct precedent (SAK-216):** `pitchItems()` (the pitch-seed's enumeration function) only ever generated each word's CORRECT downstep. The live pitch quiz's "wrong"-mode DISTRACTOR clip is a real, structurally different request shape — a different downstep, for the same reading — that the seed's enumeration simply never accounted for. This wasn't a disagreement between signals; nobody's checks conflicted. It was a coverage gap: a real thing the live app could ask for that the seed never knew to generate, so it silently fell back to live synthesis every time, invisible until Sam asked directly whether it was actually seeded.

**What to check:**
- For every live code path that can trigger on-demand audio generation (every caller of `synthesizeWordWav`/`synthesizeSentenceWav`, the `/api/pitch-tts` and `/api/tts` routes — grep for all of them, not just the ones already known about), enumerate the FULL parameter space each one can actually request: every distinct `(reading, downstep, voice)` triple the pitch quiz can ask for, every distinct sentence/word combination the general TTS path can ask for.
- Cross-check that space against what the seed script's enumeration function(s) actually produce (`pitchItems()` for pitch; find and check the equivalent enumerator for the general voice/sentence set too — this session's fix only ever looked at pitch, the same completeness question applies to the rest of `seed-voice-audio.mjs`'s other sets and hasn't been checked).
- Anything the live app can request that the seed's enumeration doesn't cover is a coverage gap, full stop — the exact class of bug SAK-216 fixed, potentially recurring in a new form somewhere else in the same script.
- This needs re-checking whenever the live request-generating code changes, not just once — a future quiz-mode change that requests a new content shape (a third pitch variant, a new question type that plays audio) would silently reintroduce this exact gap if nobody re-runs this check. Treat it as a standing regression guard, not a one-time sweep.

**Verify:** an independent agent re-derives "everything the live app can request" from the actual call sites, from scratch, rather than trusting the first agent's enumeration — the same risk Audit 4's verify stage already names for its own "full universe" list applies here: a coverage claim is only as good as how complete the enumeration it's checked against actually is.

### Execution shape and cost

This is more expensive PER-ITEM than the original sweep — resolving 885 individual disagreements needs real per-item investigation, not one mechanical rule applied in bulk, which is a genuinely bigger effort than confirming 34 clean-cut bugs was. Scale to what's affordable the same way Audit 1's depth knob works: a full run resolves every disagreement; a lighter pass could sample the 2-vs-1 and all-3-disagree buckets rather than exhaustively working through all of them, as long as the report is honest about what fraction was actually resolved versus sampled versus left pending.

### Output

A report with the three sections above, not a flat bug list — the shape of the disagreement (clean majority vs. genuine 3-way split) is itself information worth preserving, not collapsing into a single pass/fail per word. Confirmed bugs get fixed the same way SAK-215/218 already do (the per-reading exception map). "Unresolved" words become their own tracked list — worth a periodic look, and a natural candidate for the kind of "report it" mechanism Audit 3 already touches on (a real, listenable spot-check by a human, since this is exactly the class of thing text-level analysis alone couldn't close out).

---

## Running these audits

**The verify pipeline is the default for all ten, not an optional upgrade for later.** Sam's own framing (2026-08-28): many prior audits of this kind haven't actually caught what she keeps finding by hand, which is a real track record, not a hypothetical risk — a single agent's self-reported findings, taken at face value, are exactly what's been under-catching things. Every audit here should run as a genuine find → verify → synthesize pipeline (the `Workflow` tool's pattern), not a flat set of parallel `Agent` calls whose findings go straight to the report. Audit 10 exists specifically because Audit 2's own pronunciation-checking work skipped this discipline the first two times — a reminder that the pipeline shape matters as much as running it at all.

**Find**: fan out — per track (Audit 1), per content-type or track (Audit 2: readings/pitch/grammar/examples), per surface area (Audit 3: per `/dev/*` page plus real flows), per track against the full data universe (Audit 4), per data domain (Audit 5: vocab/kanji/pitch/grammar/counters), per content area (Audit 6), per code layer or subsystem (Audit 7), per sync scenario (Audit 8: basic sync, conflict, sign-in transition, interrupted sync), per cold-start type (Audit 9: client bundle/hydration vs. server boot), per disagreement AND per live request-generating code path (Audit 10 — every disagreement, not a sampled subset unless cost forces a stated reduction; every caller of the synthesis/audio functions, cross-checked against the seed's own enumeration). Tuned for recall; false positives here are expected and fine.

**Verify**: every candidate finding goes to one or more agents *independent* of whoever found it, whose job is to try to refute it, not confirm it — not just re-assert the finder's own framing. What "verify" means is audit-specific:
- Audit 1: replay whether the flagged fact was really absent from the ledger at that point (a structured, machine-checkable ledger — see above — makes this a real check, not another self-report).
- Audit 2: cross-check the specific claim against the authoritative source directly (JMdict/Kanjium), and specifically check for the failure mode already caught once this session — a naive "this looks wrong" signal that's actually a legitimate exception (see the こんにちは near-miss in SAK-215: a blanket "hiragana disagrees with katakana" signal would have flagged a *correct* pronunciation as a bug; only a second, adversarial check — kanji-in-context — told them apart). Any new "content is wrong" finding needs the same kind of independent, mechanical cross-check before it's trusted, not just one agent's confident claim.
- Audit 3: an independent agent re-examines the same surface (fresh screenshot/interaction) rather than trusting the finder's description of what it saw.
- Audit 4: confirm the "full universe" list being diffed against is itself complete, not a stale/partial enumeration — a coverage percentage is only as good as what it's measured against.
- Audit 5: actually regenerate the data from source where possible and diff, rather than trust a manual inspection claim.
- Audit 6: check surrounding context before confirming a flagged inconsistency — a naive text match can conflate two genuinely different concepts that just look similar.
- Audit 7: enumerate and check EVERY consumer of a flagged pattern (the SAK-105 lesson) — never confirm "adopted everywhere" or "not adopted" off one plausible-looking example.
- Audit 8: reproduce with a fresh pair of sessions, including at least one deliberately-adversarial-timing attempt — sync bugs are often timing-dependent, so one clean run doesn't rule one out.
- Audit 9: reproduce the same cold-start numbers from a genuinely separate run/environment before trusting them — this IS the verify stage Sam explicitly asked for ("independently verify it's not just me"); if the second pass doesn't reproduce it, report that discrepancy as the finding, don't just keep the first result.
- Audit 10: for a 2-vs-1 split, actively try to refute the majority rather than trusting the vote count (see Audit 10's own section for why a majority isn't automatically proof). For a 3-way split, verification IS the resolution attempt itself — gather one more piece of evidence, and if that still doesn't resolve it, "unresolved" is the correct, honest verified output, not a failure to verify. For a seed-coverage claim, an independent agent re-derives the "everything the live app can request" enumeration from scratch rather than trusting the finder's list — a coverage claim is only as good as the completeness of what it was checked against.

Drop anything that doesn't survive verification FROM THE REPORT (majority vote across a small number of independent verifiers is a reasonable default) — this is about which candidate findings make it into the write-up, never an instruction to change or delete anything real; see the ground rules above. The one exception is Audit 10's 3-way-disagreement case, where "unresolved" is a valid, reportable outcome in its own right, not something to leave out. Only survivors (confirmed bugs, confirmed clean, and explicit unresolved) reach synthesis and appear in the report.

**Synthesize**: combine verified findings into the prioritized report, deduped, most severe first, published as a shareable Artifact.

This genuinely needs the `Workflow` tool's orchestration (structured pipeline/parallel stages across many agents), not a flat set of `Agent` calls — and Sam has now explicitly asked for this pattern in this conversation (2026-08-28), which is the opt-in `Workflow` requires. When any of these audits actually runs, invoke it as a `Workflow`, not as a batch of independent `Agent` dispatches.

**Protect the orchestrating session's own context — this is not just a style preference, it's why Workflow exists here.** The actual investigation (walking lessons, reading generated data files, browsing `/dev/*` pages, running comparison scripts, whatever a given audit's `find`/`verify` stage needs) belongs INSIDE `agent()` calls, never done directly in the orchestrating session's own turn. A ten-audit sweep, especially one running for hours alongside a live reseed, will blow through even a large context budget fast if the orchestrator reads large files, browses many pages, or churns through raw tool output itself instead of delegating that work and only pulling back small, structured results (via a `schema`) to synthesize from. The orchestrating session's job is to launch stages, read back short structured summaries, and write the final report — not to do the legwork. If a session catches itself about to Read a huge file, browse a dozen pages, or grep broadly as part of an audit's own investigation rather than to plan the next `agent()` call, that work should be inside an agent, not in the main loop.

As of 2026-08-28: on Sonnet 5, usage cost is low enough that dispatched agents can freely use live browser tools (Claude Browser MCP) and start dev servers for live verification — Audit 1, Audit 3, Audit 8, and Audit 9 *require* this, since they're testing the real interactive/timing experience, not code. Audits 2, 4, 5, 6, 7, and 10 are mostly or entirely code/data-reading (Audit 10 talks to the TTS engine directly over HTTP, not through a browser) and don't need it, but browser access is available if it helps. Re-check this cost assumption if circumstances change again.

**Cap real concurrency across audits, not just within one.** The Workflow tool's own fan-out (many `agent()` calls inside one audit's find/verify stages) is separate from how many DIFFERENT audits run at once. Starting all ten audits' Workflows simultaneously — each spawning its own sub-agents, some needing a live dev server or browser tools — can genuinely saturate one local machine, especially alongside anything else already running there. Cap actively-running audits to roughly 2-3 at once and queue the rest, rather than firing all ten immediately. Sequence any audit with a real dependency on some in-flight external process (a background job, a build, anything that needs to finish before that audit's result would be trustworthy) toward the END of the queue, not the start — starting it early either wastes a concurrency slot on partial work or produces a result that needs re-running once the dependency clears anyway.

Which specific audits to run, at what depth, and in what order is a per-run decision — not something this doc defaults on. That belongs in whatever prompt kicks off a given run.
