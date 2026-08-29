export const meta = {
  name: 'audit-01-naive-learner',
  description: 'Walk Learn/Practice/Library as a real beginner would, using a strict taught-ledger to prevent the LLM from answering from its own Japanese knowledge',
  phases: [
    { title: 'Find', detail: 'one agent per independent track, plus a combined gate+gated-tracks agent' },
    { title: 'Verify', detail: 'independent reproduction of a sample of findings' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

// Pass situational context per run via: Workflow(scriptPath, { situationalContext: "...", repo: "...", devServerUrl: "..." })
const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const DEV_URL = args?.devServerUrl ?? 'http://localhost:3092'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 01 (naive-learner) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no seed/regen scripts against real data, no commits/merges/Linear changes.

Dev server is already running at ${DEV_URL} — don't start another one, don't kill it. Use the Claude Browser MCP tools for the whole walkthrough. The browser pane may be shared with other concurrently-running audits — open your own tab, don't assume tab state persists untouched between your own calls, re-verify anything surprising (a page showing content you didn't navigate to) before reporting it as a real bug.
${SITUATIONAL}

## The one rule that makes this audit work — THE LEDGER
You already know Japanese. Answering quiz questions from that background knowledge measures nothing. You may ONLY answer from a running "taught-ledger" — a literal structured log of exactly what the app has explicitly shown you SO FAR in this run, nothing else. Maintain it as a markdown table (\`| # | fact | form/reading | lesson/screen taught on | notes |\`), written incrementally — append a row the moment the app shows a new fact, BEFORE you ever see a quiz question about it.

Before answering ANY quiz question, comprehension check, or "do you already know this" prompt:
1. Check whether the fact is already a ledger row.
2. If YES — answer as a diligent-but-fallible beginner: mostly correct, with occasional REALISTIC mistakes (a plausible romaji mix-up, a confused look-alike kana, a not-quite-right conjugation) — not perfect recall, not random noise.
3. If NO — this is itself a finding. Log it as "untaught-prerequisite hit": what was tested, where, confirmed absent from the ledger. Answer as a genuine beginner facing the unknown (a plausible guess) — NEVER pull the real answer from your own knowledge of Japanese.

Rate each Learn lesson 1-4: (1) clear on first read, (2) clear after re-reading, (3) had to guess/infer the point, (4) still unclear after the lesson ended. Report the distribution, not just an average.

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them. Do not under-report to seem clean.`

const trackPrompt = (trackName, depthNote) => `${GROUND_RULES}

## Your scope: the "${trackName}" track, independently

First, re-derive the CURRENT track list and taxonomy from the app's own code (\`src/lib/content/interleaved-schedule.test.ts\` and \`UNIT_TRACKS\`) rather than trusting any name/scope written here — it changes as the curriculum grows. Confirm "${trackName}" still exists and matches this description; if it's been renamed/restructured, adapt and note the discrepancy.

Start from a genuinely fresh browser tab — Saku's progress lives entirely in browser localStorage, so a brand-new tab with no prior history IS a clean-slate learner. No seeding/reset script needed.

Walk this track's Learn lessons, Practice/Quiz, and Library reference pages as a real learner would — not just the forced curriculum path.

${depthNote}

Your final message: the ledger (file path if you save one, or the table itself — first 5 rows, last 5 rows, and every row tied to a finding), every untaught-prerequisite hit with evidence, a retention estimate (ledger-only accuracy, numerator/denominator), the clarity-rubric distribution with quoted copy for every 3/4, UX friction findings (title/severity guess/exact evidence/location/why it matters), any incidental bug hit along the way, and the depth actually walked.`

const GATE_PROMPT = `${GROUND_RULES}

## Your scope: the vocab gate, then keigo and transitivity

Re-derive current gating from the real code (\`interleaved-schedule.test.ts\`'s \`blockedBy\` walk) rather than assuming keigo/transitivity still gate on vocab — it's changed before. If the gating structure has changed, adapt this brief to whatever gates whatever now, and note the change.

Start from ONE fresh browser tab for this whole session (not one per track) — the point is that progress carries across the gate and what it unlocks.

Walk the gating track's Learn lessons for real — do NOT use any "I already know X" shortcut for it, since the whole point of this session is measuring the genuine cost of clearing the gate as an actual beginner would experience it. Periodically check the Learn overview to see when the gated track(s) become available. Use a safety cap (e.g. 80 lessons of the gating track) — if you hit it without the gate clearing, STOP and report that as a finding in its own right (a real reachability problem), noting which gated track(s), if any, unlocked and how close it seemed.

Record the exact lesson count at which each gated track individually became unlocked (they may unlock at different points). Once unlocked, continue in the SAME session and walk each gated track for a reasonable sample (e.g. up to 15 lessons, or fewer if the track is short — note if you fully swept it).

Your final message: the gate-clearing cost (the headline number) for each gated track, then per-leg (gate, and each gated track): ledger excerpt, retention estimate, untaught-prerequisite hits, clarity distribution with quoted copy for 3/4s, UX friction findings, incidental bugs, depth walked.`

phase('Find')
const [kanaVocab, numbersGrammarSentence, gateResult] = await parallel([
  () => agent(
    trackPrompt('kana + vocab', 'Depth: smoke-check the first 15-20 lessons of EACH track independently (state exactly how many you walked and why) — walking a track fully can be extremely long (numbers alone had 1,800+ lessons in one measured run), so breadth across tracks matters more here than exhausting one.'),
    { label: 'find:kana-vocab', phase: 'Find' }
  ),
  () => agent(
    trackPrompt('numbers + grammar + sentence', 'Depth: smoke-check the first 10-15 lessons of EACH of these three tracks independently (state exactly how many and why) — prioritize getting through all three at reduced depth over exhaustively deep-diving just one, since "0 findings" on an unchecked track is a false negative, not a clean result.'),
    { label: 'find:numbers-grammar-sentence', phase: 'Find' }
  ),
  () => agent(GATE_PROMPT, { label: 'find:gate-keigo-transitivity', phase: 'Find' }),
])

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of a naive-learner audit finding set

Do not just re-read and agree with the claims below. Pick a meaningful sample of the reported UX friction findings and untaught-prerequisite hits (at least 3-5) and independently REPRODUCE them yourself: fresh tab, navigate to the same screen, confirm the same copy/behavior with your own screenshot or ledger check. If you can't reproduce something, or the ledger claim doesn't hold up under a fresh look, report that explicitly as a refutation rather than letting it pass through.

Findings to verify:
"""
${claim}
"""

Your final message: for each sampled item, CONFIRMED or REFUTED with your own fresh evidence, and an overall read on whether the find-stage agent's ledger discipline held up.`

const [verifyA, verifyB, verifyC] = await parallel([
  () => agent(VERIFY('kana-vocab', kanaVocab), { label: 'verify:kana-vocab', phase: 'Verify' }),
  () => agent(VERIFY('numbers-grammar-sentence', numbersGrammarSentence), { label: 'verify:numbers-grammar-sentence', phase: 'Verify' }),
  () => agent(VERIFY('gate-keigo-transitivity', gateResult), { label: 'verify:gate-keigo-transitivity', phase: 'Verify' }),
])

phase('Synthesize')
const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 01 report

Combine all three find-stage reports and their verify-stage results below into one prioritized report, most severe first, deduped. Include: per-track ledger excerpts and retention estimates, all untaught-prerequisite hits, clarity-rubric distributions per track with quoted copy for 3/4s, the gate-clearing cost numbers, UX friction findings (incorporating verify's confirmations/refutations), incidental bugs, and depth actually walked per track (state explicitly — this is real information, not a caveat to bury).

Then publish this as a shareable Artifact (use the Artifact tool).

KANA+VOCAB FIND: """${kanaVocab}"""
KANA+VOCAB VERIFY: """${verifyA}"""
NUMBERS+GRAMMAR+SENTENCE FIND: """${numbersGrammarSentence}"""
NUMBERS+GRAMMAR+SENTENCE VERIFY: """${verifyB}"""
GATE+KEIGO+TRANSITIVITY FIND: """${gateResult}"""
GATE+KEIGO+TRANSITIVITY VERIFY: """${verifyC}"""

Your final message back must include: the Artifact URL of your published report, and a 2-3 sentence summary (severity of top finding, roughly how many findings survived verification, whether coverage was full or partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
