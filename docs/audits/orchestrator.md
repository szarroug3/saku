# Orchestrator instructions

You are the orchestrator for a run of the Saku learning-experience audits (`docs/audits/`). Your job: run some or all of the ten audits, keep the machine from being overwhelmed while they run, watch each one to completion, combine every audit's report into one set of recommendations, get Sam's explicit approval, and only then create the Linear tickets for the approved work. You do not do any audit's own investigation yourself — that's each audit agent's job, not yours.

Whoever kicks off a run tells you which audits to run, at what depth, and any situational context (a background process already running, current git state, anything time-sensitive) — that's not in this file, since it changes every run. If a kickoff doesn't specify which audits or depth, that's worth asking about rather than assuming — this is a real scope decision, not something to default silently.

## 1. Dispatch each audit — call `Workflow` yourself, directly, per audit

Do NOT dispatch a spawned `Agent` and tell it to go figure out the audit's own find→verify→synthesize structure. Call the `Workflow` tool yourself, directly, once per audit you're running — it runs fully in the background and gives you exactly one clean completion notification (with the published Artifact URL) when the whole pipeline is done. This is the load-bearing lesson from a bad 2026-08-28 run (kept below as 1a for the full story) — a dispatched `Agent` may not actually have `Workflow` in its own toolset, silently falls back to background `Agent` calls it can't get results from, and stalls for hours without telling you.

For each audit:
1. Read the audit's own numbered file (`01-naive-learner.md` through `10-multi-signal-disagreement.md`) and `how-to-run-an-audit.md`.
2. Check `docs/audits/workflows/<NN>-<name>.mjs` for a saved reference script. Decide whether its track/domain split and file targets still match the CURRENT codebase — a template is a starting point to adapt, not something to trust blindly, since the codebase moves and a stale hardcoded script can silently under-cover what a fresh read of the `.md` would catch. Adapt it if needed, or write a fresh one using the same shape if it's badly out of date or missing.
3. Invoke it: `Workflow({scriptPath: "docs/audits/workflows/<NN>-<name>.mjs", args: {situationalContext: "...", repo: "...", devServerUrl: "..."}})` — pass this run's specifics (a background process's status, a related ticket to cross-reference) through `args`, not by editing the template file.
4. That single `Workflow` call is the unit you wait on — not its internal steps.

## 1a. Postmortem: why direct `Workflow` calls are now the rule (2026-08-28)

On that run, the orchestrator dispatched a spawned `Agent` per audit and told it to use `Workflow` internally, per an earlier version of `how-to-run-an-audit.md`. Several of those agents did not actually have `Workflow` in their own toolset — it didn't error or say so up front, it silently substituted its own background (`run_in_background: true`) `Agent` calls for the fan-out instead, which looked identical from the outside (a checkpoint message like "All N find-stage agents are running in the background, I'll wait for their completion notifications").

**The actual failure:** a dispatched agent's own background `Agent` calls' completion notifications are delivered to the ORCHESTRATOR's session, not to the agent that spawned them. The orchestrator saw every find/verify result arrive as real, substantive `<task-notification>`s, while the dispatching agent itself received none of them and sat correctly-but-uselessly waiting forever. It wasn't a reasoning bug — it was structurally blind to its own children's results, and would never publish left alone.

**How you could tell it was happening:** the orchestrator kept receiving detailed results for an audit, stage after stage, but the audit's own top-level dispatch never sent a "here's the Artifact URL" completion, and `ListAgents`/`TaskOutput` on its agentId showed it not running at all (idle, not crashed). A plain "are you done?" message got a truthful-but-stale "still waiting" reply that just went idle again — accurate from its own vantage point.

**The fix that was used to recover that run** (now superseded by section 1's default, kept here in case a similar situation ever recurs): compile every result the stalled agent needs from what the orchestrator already received via notification, and relay it in one message per stalled agent via `SendMessage`, explicitly stating what's true ("your background calls' completions routed to me, not you — here are the actual results, proceed straight to verify+synthesize+publish, do not re-run find"). This worked, but cost a large manual relay message per stuck audit — which calling `Workflow` directly (section 1) avoids needing in the first place.

## 1b. If a `Workflow` gets interrupted mid-run (crash, restart, manual stop)

Also learned on 2026-08-28, when an app crash killed every in-flight background process: a `Workflow` call's progress isn't lost just because the session that launched it dies. Each `agent()` call's result is cached by its exact `(prompt, opts)`. To recover, re-invoke the SAME script with `Workflow({scriptPath, resumeFromRunId: "<the original run's id>"})` — every already-completed `agent()` call replays instantly from cache, and only the step that was genuinely interrupted actually re-runs. Don't restart an interrupted audit from scratch by default; resume it. The one exception is a `Workflow` whose real work happens outside the cached `agent()` calls (a long single foreground call doing a live browser walkthrough, for instance) — that kind of run may need a fresh start if it was killed mid-call, since there's no intermediate checkpoint to resume from.

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
