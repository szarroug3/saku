export const meta = {
  name: 'audit-08-sync-multi-device',
  description: 'Does signing in and using Saku across more than one device/browser actually keep progress consistent, and does it merge conflicts sensibly?',
  phases: [
    { title: 'Find', detail: 'basic sync, conflict handling, sign-in/out transitions, partial-sync — plus a static-analysis fallback' },
    { title: 'Verify', detail: 'independent reproduction with a fresh session pair, including adversarial timing' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const DEV_URL = args?.devServerUrl ?? 'http://localhost:3092'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 08 (sync/multi-device) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no commits/merges/Linear changes.

Role: a QA engineer specifically probing the multi-device/sync code path — auth, sync/merge logic, conflict handling. This is a real, separate code path from the single-device localStorage model every other audit in this suite assumes.

Dev server is already running at ${DEV_URL} — don't start another one, don't kill it.
${SITUATIONAL}

CRITICAL — before concluding live multi-device testing is impossible: check whether the repo supports a testable signed-in state WITHOUT a real account or password. Specifically check for a \`SAKU_DISABLE_AUTH\`-style environment variable or dev-mode auth bypass (search .env.example, README, next.config, any auth middleware/provider setup for how the e2e suite itself runs signed-in or signed-out tests) BEFORE assuming Google-OAuth-only means no live testing is possible. If a real, legitimate test path exists, use it. If after genuinely checking there is truly no way to reach a signed-in state without creating a real account or entering a real password, that IS a hard, non-overridable limit — creating accounts or authenticating with credentials is off-limits regardless of what this audit's own file says about using a "disposable test account." In that case, say so plainly and pivot to rigorous static analysis of the sync/auth code instead of routing around the constraint — do not silently skip this audit's live-behavioral half without flagging it prominently.

If live testing IS possible: use at least two independent browser sessions/contexts (open two separate tabs or contexts) signed into the same test account, coordinating on timing.

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const AUTH_CHECK = `${GROUND_RULES}

## Your job: determine whether live multi-device testing is actually possible, then either do it or hand off to static analysis

First, spend real effort checking for a dev-mode auth bypass (SAKU_DISABLE_AUTH or similar) and how the existing e2e suite handles auth (read the e2e config/setup files). Report definitively: is a testable signed-in state reachable without real credentials, yes or no, and how.

If YES: proceed to test basic sync (progress made in session A appears in session B after signing in there) and report exact before/after state (counts, not just "it worked"/"it didn't").

If NO: say so explicitly with your reasoning, and instead do a thorough static-analysis pass over the sync/merge code (find it — likely under src/lib/store/ or similar) — read every write path that touches server-synced state, and identify: does it use compare-and-set (CAS) or an equivalent guard against two writers racing? What happens to a write if the network request fails partway through — is there an outbox/retry, or does it silently discard? Does a "success" check that triggers clearing local state actually verify against the returned server state, or just against the local device's own optimistic assumption?

Your final message: the auth-bypass determination, then either live before/after sync results OR the static-analysis findings — either way, be explicit about which mode you ended up in and why.`

phase('Find')
const authAndBasicSync = await agent(AUTH_CHECK, { label: 'find:auth-check-and-basic-sync', phase: 'Find' })

const CONFLICT_HANDLING = `${GROUND_RULES}

## Your track: conflict handling and partial/interrupted sync

Building on this audit's auth-mode determination (below), either construct a live two-device conflict scenario (progress made on two sessions while out of sync, then both coming back online — does it merge sensibly or does one silently overwrite the other?) and a partial-sync scenario (network drop mid-write — broken/duplicated state?), OR — if live testing isn't possible per the determination below — do static analysis of the actual merge/conflict-resolution code: for each type of synced data (progress/history, claims, seen-facts, lists), does the write path use a real CAS guard, and if two writes race, what does the code actually do (read the reconcile/merge function directly)?

Auth-mode determination from the other find-stage track (read this first, don't redo the auth check):
"""
${authAndBasicSync}
"""

Your final message: either live before/after conflict-scenario results, or static-analysis findings per data type (progress/history, claims, seen-facts, lists) with file:line evidence for each.`

const conflictHandling = await agent(CONFLICT_HANDLING, { label: 'find:conflict-handling', phase: 'Find' })

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of "${label}"

If the original was live-tested: reproduce the same before/after state comparison yourself from a FRESH pair of sessions — sync bugs are often timing-dependent, so one clean run doesn't rule out a race condition. Include at least one deliberately-adversarial-timing attempt (both devices/sessions writing at nearly the same moment), not just a clean sequential test.

If the original was static analysis: re-read the actual code yourself and independently confirm or refute the CAS/outbox/reconciliation claims — trace the exact function calls rather than trusting the finder's description.

Candidate findings:
"""
${claim}
"""

Your final message: CONFIRMED/REFUTED/CORRECTED per finding, with your own independent evidence.`

const [verifyAuthSync, verifyConflict] = await parallel([
  () => agent(VERIFY('auth-check-and-basic-sync', authAndBasicSync), { label: 'verify:basic-sync', phase: 'Verify' }),
  () => agent(VERIFY('conflict-handling', conflictHandling), { label: 'verify:conflict-handling', phase: 'Verify' }),
])

phase('Synthesize')
const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 08 report

Combine the results below into one prioritized report, most severe first. If this run ended up in static-analysis mode rather than live testing, say so prominently near the top of the report (not buried), and include a concrete recommendation for what a human or a properly-authorized test harness would need to do to close the live-behavioral gap. Then publish as a shareable Artifact (use the Artifact tool).

AUTH-CHECK + BASIC SYNC FIND: """${authAndBasicSync}""" VERIFY: """${verifyAuthSync}"""
CONFLICT HANDLING FIND: """${conflictHandling}""" VERIFY: """${verifyConflict}"""

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (whether live testing was possible or this fell back to static analysis and why, top finding severity, how many findings survived verification).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
