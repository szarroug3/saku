# How to run an audit

This is the brief for an individual audit agent — dispatched by an orchestrator (see `orchestrator.md`) to run exactly ONE of the ten audits in this folder. Read this file plus your own audit's numbered file — nothing else in this folder. Never resolve a gap in your own audit's instructions by reading another audit's file; if something seems missing, it's either covered here (mechanics) or genuinely not specified (ask, don't assume) — it is never "the same as some other audit," since that audit's file may not be available to you.

Deciding WHICH audits run, how many run at once, watching them to completion, and combining every audit's report into one final set of recommendations is the orchestrator's job, not yours — you only need to run your own audit well and publish your own report.

---

## Ground rules: audits investigate, they don't act

Sam (2026-08-28): "none of the audits should make any actual changes to code or production databases or anything. they should write up reports somewhere so you can then review them and create cards for anything we think needs to be fixed." This applies without exception, and overrides anything in your own audit's file that could be read as implying otherwise.

- **No source edits.** Read code and data; never open an Edit/Write on a real source file. Not even a "small" fix, not even something that looks obviously safe mid-investigation — flag it in the report instead.
- **No mutating scripts against real infrastructure.** No writes to production Supabase (database or Storage), no running a seed/regeneration script against real data, no deletes, no `--execute`-style flags on anything real. Where a check genuinely needs to exercise a script (regenerating data from source to diff, for instance), run it against a LOCAL/scratch output and diff against the committed file — never overwrite the committed file, never point it at production.
- **No commits, no merges, no Linear changes.** Don't touch git history or ticket state. Findings go into the report; converting a finding into an actual Linear ticket, and fixing it through the normal worktree → agent → review → merge workflow, happens AFTERWARD, as a separate, deliberate step — reviewed by Sam or by Claude reading the report, not automatically by the audit itself.
- **Where an audit genuinely needs to produce real state to observe something** (the sync/multi-device audit, for instance — testing sync requires actually creating some progress to see whether it syncs), use a disposable/test account, never Sam's own real account or real production user data, and treat whatever gets created as throwaway.
- **The deliverable is always a report**, not a diff. Publish it as an Artifact, and treat "what should we actually go fix" as a separate decision made AFTER reading it — the same review-then-ticket rhythm real findings from direct investigation (SAK-210, SAK-215, SAK-216, SAK-217, SAK-218) were fixed through: one at a time, reviewed before merging. Audits feed that same pipeline, they don't bypass it.

---

## Dispatch shape, within your own audit

Use the `Workflow` tool — Sam has explicitly opted into this pattern (2026-08-28); invoke as a `Workflow`, not a batch of independent `Agent` calls. Your own audit's file states its natural unit of work (a track, a data domain, a surface area, a code layer, whatever fits its subject) — dispatch one `agent()` per unit, fanned out via `pipeline()`/`parallel()`.

**Protect your own context.** The actual investigation — walking lessons, reading generated data files, browsing pages, running comparison scripts, whatever your audit's own work requires — belongs INSIDE `agent()` calls, never done directly in your own turn. A long-running audit will blow through even a large context budget fast if you read large files, browse many pages, or churn through raw tool output yourself instead of delegating that work and only pulling back small, structured results (via a `schema`) to synthesize from. Your job is to launch stages, read back short structured summaries, and write your own final report — not to do the legwork.

---

## Find → verify → synthesize

Every audit runs this same three-stage shape. Sam's own framing (2026-08-28) for why this is mandatory, not optional: many prior audits of this kind haven't actually caught what she keeps finding by hand — a single agent's self-reported findings, taken at face value, are exactly what's been under-catching things. The multi-signal disagreement audit (10) exists specifically because the SAK-215/218 pronunciation work skipped this discipline the first two times it ran.

**Find**: each unit-of-work agent investigates its own scope and reports CANDIDATE findings. Tuned for recall — false positives are expected and fine here, that's what verify is for.

**Verify**: every candidate finding goes to one or more agents *independent* of whoever found it, whose job is to try to REFUTE it, not confirm it — never just re-assert the finder's own framing. What counts as a real check is domain-specific — your own audit's file states its technique when it has one worth calling out (e.g. cross-checking a claim against an authoritative external source, reproducing a UI observation from a fresh screenshot, re-deriving a coverage enumeration from scratch rather than trusting the finder's list). Kill anything that doesn't survive verification from the report — majority vote across a small number of independent verifiers is a reasonable default. This is about which candidate findings make it into the write-up; it is never an instruction to change or delete anything real (see ground rules). Some audits' findings can legitimately land on "unresolved" rather than a clean confirm/reject (the multi-signal disagreement audit's 3-way-split case is the concrete example) — that's a valid, reportable outcome in its own right, not a failure to verify, and should never be silently dropped the way a genuinely unconfirmed finding is.

**Synthesize**: combine verified findings (confirmed, confirmed-clean, and any explicit "unresolved") into one prioritized report, deduped, most severe first.

---

## What a report should contain

- Every candidate finding that survived verification, with: what's wrong, the evidence (a file:line, a screenshot, a before/after comparison, a reproduction — never just an assertion), and a severity.
- What was actually checked, not just what was found — a coverage count, a "0 findings" section is real information, not nothing to report. This matters most for audits where a clean result could be a false negative from too-shallow a check, not genuine cleanliness — say explicitly which it is.
- A prioritized punch list, most-severe first, not just a wall of observations.
- Publish it as a shareable Artifact — a deliverable with an audience, not a private scratch note — so it's easy to review and hand off into Linear tickets for whichever findings get actioned.

---

## Live app access

If your audit's file says it needs the real interactive/timing experience, you'll need live browser tools and a running dev server. As of 2026-08-28, on Sonnet 5, usage cost is low enough that dispatched agents can freely use live browser tools (Claude Browser MCP) and start dev servers for this — re-check that assumption if cost circumstances change again. If your audit's file doesn't mention needing this, it's primarily code/data-reading and doesn't need it, though it's available if it helps.
