export const meta = {
  name: 'audit-03-ux',
  description: 'Screenshot-driven UX/visual-consistency/accessibility pass across the /dev/* galleries and real live flows',
  phases: [
    { title: 'Find', detail: 'one agent per /dev/* gallery, plus one for real flows' },
    { title: 'Verify', detail: 'independent fresh re-examination of each candidate finding' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const DEV_URL = args?.devServerUrl ?? 'http://localhost:3092'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 03 (UX) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no commits/merges/Linear changes.

Role: a design/QA reviewer. Not simulating a learner, not fact-checking content — paying close attention to the interface itself. Screenshot-driven, comparative (does this component look/behave the same everywhere it appears?), willing to poke at edges (resize the viewport, try keyboard navigation, hit back/forward) rather than just following the golden path.

Dev server is already running at ${DEV_URL} — don't start another one, don't kill it. Use the Claude Browser MCP tools. The browser pane may be SHARED with other concurrently-running audits in this account — expect real tab contention (tabs hijacked/closed, unexpected navigation). Open your own tab, don't assume tab state persists untouched between your own calls, and cross-check anything surprising with a fresh screenshot/reload before reporting it as a confirmed app bug rather than pane contention.
${SITUATIONAL}

What to check on every surface: visual consistency (does a shared component look/behave the same everywhere?), layout bugs (overflow, mid-word text wrapping, misalignment), responsive/mobile (use resize_window's mobile/tablet presets), interaction bugs (dead clicks, missing focus states, broken keyboard nav), accessibility (missing accessible names, contrast, focus indicators in both themes), light/dark theme (a color token defined in only one theme's block is a recurring real bug class here), cross-page consistency (does the same TYPE of screen feel like the same app everywhere?).

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const DEV_PAGES = [
  'quiz-gallery', 'views', 'swatches', 'library', 'learn', 'scheduling', 'numbers', 'pitch-accent',
]

const devPagePrompt = (page) => `${GROUND_RULES}

## Your scope: /dev/${page}

This dev-only reference page is intentional and deliberately kept in the app (never suggest deleting it) — it exists specifically to give broad UI coverage in one place. Navigate to ${DEV_URL}/dev/${page} and walk it thoroughly: every variant/state it shows, in both light and dark theme, at desktop and mobile viewport widths. Compare anything that also appears elsewhere in the app (a shared component) against its other appearances if you know of one.

Your final message: findings each with title/severity guess (low/medium/high/critical)/exact evidence (quote copy, describe the visual issue precisely)/location (URL, viewport, theme)/why it matters.`

const REAL_FLOWS = `${GROUND_RULES}

## Your scope: representative real flows

Cover a handful of real, live flows end-to-end (not the static /dev galleries) to catch anything that only appears live: a real lesson from Learn, a real quiz session start-to-finish, Settings, Progress. This is the one place likely to catch interaction bugs (a button that silently fails, a state that doesn't update) that a static gallery can't show.

Your final message: findings each with title/severity guess/exact evidence/location/why it matters.`

phase('Find')
const devResults = await parallel(
  DEV_PAGES.map((page) => () => agent(devPagePrompt(page), { label: `find:dev-${page}`, phase: 'Find' }))
)
const realFlowsResult = await agent(REAL_FLOWS, { label: 'find:real-flows', phase: 'Find' })

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of UX findings from "${label}"

Do not trust the finder's description of what it saw — re-examine the SAME surface yourself with a fresh screenshot/interaction. Navigate there fresh, reproduce the exact steps described, and take your own screenshot before agreeing a finding is real. If you can't reproduce it, or it looks like it was actually shared-browser-pane contention (a tab hijacked mid-check) rather than a real app bug, say so explicitly.

Candidate findings:
"""
${claim}
"""

Your final message: per-finding verdict (CONFIRMED / REFUTED — with reason, e.g. pane contention / COULDN'T REPRODUCE), citing your own fresh screenshot/observation.`

const allFindLabeled = [...DEV_PAGES.map((p, i) => [`dev-${p}`, devResults[i]]), ['real-flows', realFlowsResult]]
const verifyResults = await parallel(
  allFindLabeled.map(([label, claim]) => () => agent(VERIFY(label, claim), { label: `verify:${label}`, phase: 'Verify' }))
)

phase('Synthesize')
const sections = allFindLabeled.map(([label, claim], i) => `--- ${label.toUpperCase()} ---\nFIND:\n"""${claim}"""\nVERIFY:\n"""${verifyResults[i]}"""`).join('\n\n')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 03 report

Combine all ${allFindLabeled.length} surfaces' find and verify results below into one prioritized report, most severe first, deduped (a component appearing broken on multiple surfaces is one finding, not several). Be explicit about coverage: which surfaces got full checks vs. were cut short by browser-pane contention, and don't imply exhaustive coverage where contention limited it. Then publish as a shareable Artifact (use the Artifact tool).

${sections}

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (top finding severity, how many findings survived verification, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
