export const meta = {
  name: 'audit-09-performance',
  description: 'Performance audit: client vs server cold-start timing, with independent second-pass verification',
  phases: [
    { title: 'Find', detail: 'client cold-start + server cold-start, measured separately' },
    { title: 'Verify', detail: 'independent second pass tries to reproduce each claim' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = '/Users/samreenzarroug/git/personal/saku'

const GROUND_RULES = `You are running part of audit 09 (performance) for the Saku Japanese-learning app. Repo: ${REPO}. This is a read-only investigative audit: no source edits, no writes to production Supabase, no seed/regen scripts against real data, no commits/merges/Linear changes.

Dev server is already running at http://localhost:3092 (started via the 'saku-branch' launch.json config) — do not start another one, do not kill it. Use the Claude Browser MCP tools for live measurement.

A pitch-audio reseed that was running earlier has now FINISHED (94,734/94,734 clips, 0 failed) — no audio-contention concerns remain, the local VOICEVOX docker container may or may not still be up, don't worry about it either way for this audit.

The browser pane may be shared with other concurrent audits in this account — open your own tab, don't assume tab state persists untouched between your own calls, re-verify anything surprising with a fresh screenshot/reload before reporting it as a real number.

Report exact numbers (bytes, milliseconds) with your methodology stated plainly, not vibes or impressions. Report candidate findings even where you're unsure — a later independent verify pass will try to refute them, so false positives here are fine.`

const CLIENT_FIND = `${GROUND_RULES}

## Your scope: CLIENT-side cold start

Read \`e2e/page-load-performance.spec.ts\` and \`scripts/route_sizes.mjs\` first to understand what coverage already exists before measuring anything yourself — this audit's first job is figuring out WHY existing coverage isn't catching what Sam feels on cold start, not assuming nothing exists.

Then measure genuine client-side cold-start conditions against http://localhost:3092: JS bundle size and hydration cost on a truly fresh page load — no cached chunks, no warmed-up runtime. Use a fresh tab per measurement and clear cache/storage between measurements (not back-to-back warm reloads in the same tab).

Measure at least: \`/\`, \`/learn\`, \`/library\`, and any other route \`route_sizes.mjs\` flags as unusually large. For each route report: JS bundle size (from route_sizes.mjs output and/or network request sizes), time-to-interactive / hydration-complete timing (via the Performance API or a network waterfall), and whether route_sizes.mjs already flags this route.

Specifically check the known issue: \`/learn\` allegedly ships ~8.6MB of JS it never renders (per the perf/learn-bundle refactor plan, which per project notes is planned but not yet done) — confirm with real numbers whether this is still true today, and how large the gap actually is.

Check \`page-load-performance.spec.ts\`'s actual budget thresholds directly: are they calibrated to catch a real cold-start regression, or lenient/warm-cache-by-construction enough that one could pass anyway? State this explicitly with the actual threshold numbers from the file.

Your final message: a compact structured report — per-route bundle size and TTI/hydration numbers with methodology, the /learn bundle-size finding with real numbers, and your read on whether the existing e2e budgets would actually catch a cold-start regression, with evidence.`

const SERVER_FIND = `${GROUND_RULES}

## Your scope: SERVER-side cold start

This is about server-side cold boot cost — a cold serverless function, a cold DB connection, a cold external-service call — invisible to a bundle-size check, needs actual request-timing measurement.

Check \`src/app/api/\` for available API routes. Measure real request timing via the Claude Browser MCP's \`read_network_requests\` (or a direct \`fetch\` via \`javascript_tool\`) against at least 3-4 different API routes on http://localhost:3092. Space your measurements apart in TIME — wait real seconds (e.g. 30-60s) between a "cold" first request and a repeated "warm" request to the same endpoint, rather than hammering back-to-back requests that keep everything warm as a side effect of testing.

Compare cold vs warm timing for each route you measure, with exact millisecond numbers.

Important framing for your report: this is a local \`next dev\` server, not a real serverless deployment. Be explicit about what "cold start" can and can't mean in this environment versus what Sam is actually feeling in production — state plainly whether local dev cold-start timing is even a meaningful proxy for the production complaint, or whether this audit's server-side half is structurally limited by only having a dev environment to test against.

Your final message: a compact structured report — per-route cold vs warm timing with exact numbers and methodology, and your honest assessment of how much this local measurement can and can't tell us about the production complaint.`

phase('Find')
const [clientFind, serverFind] = await parallel([
  () => agent(CLIENT_FIND, { label: 'find:client-cold-start', phase: 'Find' }),
  () => agent(SERVER_FIND, { label: 'find:server-cold-start', phase: 'Find' }),
])

phase('Verify')
const CLIENT_VERIFY = `${GROUND_RULES}

## Your job: independent second-pass verification of a CLIENT cold-start claim

"Independently verify it's not just me" is this audit's own core mechanic: don't trust a single measurement from a single environment as proof either way. Do NOT just read the claim below and agree with it — reproduce it yourself, from scratch, with your own fresh measurement (a new tab, cleared cache, your own methodology). If your numbers materially disagree with the claim below, that discrepancy IS the finding — report it plainly and directly, don't just report whichever number sounds worse or matches the original impression.

Claim to verify:
"""
${clientFind}
"""

Your final message: your own independently-measured numbers, explicit agreement or disagreement with each part of the claim above, and if there's a discrepancy, state it as its own finding rather than silently picking a side.`

const SERVER_VERIFY = `${GROUND_RULES}

## Your job: independent second-pass verification of a SERVER cold-start claim

Same technique as the client-side verify pass: reproduce the measurement yourself, from scratch, with your own timing methodology and your own real time-gaps between cold and warm requests. If your numbers materially disagree with the claim below, report that discrepancy directly as the finding, rather than picking whichever result matches the original impression.

Claim to verify:
"""
${serverFind}
"""

Your final message: your own independently-measured numbers, explicit agreement or disagreement with each part of the claim above, and if there's a discrepancy, state it as its own finding.`

const [clientVerify, serverVerify] = await parallel([
  () => agent(CLIENT_VERIFY, { label: 'verify:client-cold-start', phase: 'Verify' }),
  () => agent(SERVER_VERIFY, { label: 'verify:server-cold-start', phase: 'Verify' }),
])

phase('Synthesize')
log('Both dimensions measured and independently verified — synthesizing final report')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 09 report

Combine the find and verify results below into one prioritized report, most severe first. Report client and server cold-start SEPARATELY throughout — they point at different fixes, do not collapse them into one "the page felt slow" number, per this audit's own explicit instruction.

Critical instruction from the audit's own verify technique: if the verify pass materially disagreed with the find pass for either dimension (different numbers, failed to reproduce), report that discrepancy EXPLICITLY as the actual finding for that dimension — "if the second pass doesn't reproduce it, THAT is the finding, report the discrepancy, don't just keep whichever result matches the initial impression." Do not smooth over or silently resolve a disagreement between find and verify in your own synthesis.

Include what was actually checked (a "checked and clean" result is real information too), a prioritized punch list, and be explicit about the server-side measurement's real limitation (local dev vs production).

Then publish this as a shareable Artifact (use the Artifact tool) — this is the actual deliverable, not a private note.

CLIENT FIND:
"""
${clientFind}
"""

CLIENT VERIFY (independent second pass):
"""
${clientVerify}
"""

SERVER FIND:
"""
${serverFind}
"""

SERVER VERIFY (independent second pass):
"""
${serverVerify}
"""

Your final message back must include: the Artifact URL of your published report, and a 2-3 sentence summary (severity of top finding, and whether client/server numbers were confirmed or contradicted by the verify pass).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
