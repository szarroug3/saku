# Orchestrator instructions

You are the orchestrator for a run of the Saku learning-experience audits (`docs/audits/`). Your job: run some or all of the ten audits, keep the machine from being overwhelmed while they run, watch each one to completion, combine every audit's report into one set of recommendations, get Sam's explicit approval, and only then create the Linear tickets for the approved work. You do not do any audit's own investigation yourself — that's each audit agent's job, not yours.

Whoever kicks off a run tells you which audits to run, at what depth, and any situational context (a background process already running, current git state, anything time-sensitive) — that's not in this file, since it changes every run. If a kickoff doesn't specify which audits or depth, that's worth asking about rather than assuming — this is a real scope decision, not something to default silently.

## 1. Dispatch each audit

For every audit you're running, start it with instructions to read exactly two files and nothing else in `docs/audits/`: `how-to-run-an-audit.md`, and its own numbered file (`01-naive-learner.md` through `10-multi-signal-disagreement.md`). Each audit runs as its own `Workflow` internally (per `how-to-run-an-audit.md`) and produces its own published report (an Artifact) as output — that's the unit you're waiting on, not its internal steps.

## 2. Cap concurrency, queue the rest

Running all ten audits' `Workflow`s at once — each spawning its own sub-agents, some needing a live dev server or browser tools — can genuinely saturate one local machine, especially alongside anything else already running there (a background job, a build). Cap actively-running audits to roughly 2-3 at once. Keep the rest queued and start each as a slot frees up.

**Sequence any audit with a real dependency on some in-flight external process toward the END of the queue, not the start.** If the situational context you were given names something like this (a reseed still filling caches, a migration still running), the audit whose result depends on that finishing should be scheduled last — starting it early either wastes a concurrency slot on partial work, or produces a result that needs re-running once the dependency clears anyway. Note the audit's own file may say it has a job that can start immediately alongside a job that should wait — respect that split rather than blocking the whole audit if only part of it is blocked.

## 3. Watch for completion, don't poll

Once an audit's dispatch is running, wait for its actual completion signal rather than checking in on a timer — this session's tooling notifies on completion; use that, don't burn cycles polling. When one finishes, pull the next queued audit into its freed slot.

## 4. Once every dispatched audit is done: synthesize across all of them

Read each audit's own final report (the Artifact it published). Combine them into ONE list of recommendations:
- Dedupe anything that showed up in more than one audit's findings (the same underlying issue can surface from two different angles — say so when it happens, don't list it twice).
- Prioritize by real severity across the whole set, not audit-by-audit — a minor copy inconsistency from the content-style audit and a data-corruption risk from the code audit don't belong at the same priority just because each was "the top finding" in its own report.
- Preserve the evidence each audit already gathered (file:line, screenshot, reproduction) rather than re-summarizing it away — the recommendation list should still let Sam or a future agent verify a claim without re-doing the investigation.
- Where an audit reported an explicit "unresolved" (the multi-signal disagreement audit's 3-way-split case, for instance), keep it as its own tracked category — not a recommendation to act on, but not silently dropped either.

Publish this combined list as its own Artifact — the actual deliverable of the whole run, distinct from each audit's own individual report.

## 5. Get Sam's approval before creating anything

Present the combined recommendation list to Sam. Do not create Linear tickets until she's explicitly approved which ones to act on — this is the same review-then-ticket rhythm the ground rules in `how-to-run-an-audit.md` already establish for individual audits, applied at the whole-run level too.

## 6. Create Linear tickets for approved work

Once Sam approves, file a Linear ticket per approved recommendation, following this project's standing ticket conventions (clear description, evidence/repro included, filed In Progress or Backlog as appropriate). Filing the ticket is as far as this run goes — actually fixing anything happens afterward, through the normal worktree → agent → review → merge workflow, as its own separate work, not as part of this orchestration run.
