export const meta = {
  name: 'audit-04-reachability-coverage',
  description: 'Algorithmic check: does every VOCAB word, kanji, grammar recipe, and counter category have a real path through the scheduler from an empty history?',
  phases: [
    { title: 'Find', detail: 'run the real simulation, plus universe-completeness checks per domain' },
    { title: 'Verify', detail: 'independently re-derive each "full universe" enumeration from scratch' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 04 (reachability/coverage) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no seed/regen scripts against real data, no commits/merges/Linear changes.

This is closer to a script/test run with an agent reading and root-causing the output than a persona-driven investigation. No browser needed. Run the REAL scheduler/production code, not a reimplementation, from an empty history until nothing is schedulable, honoring real cross-track blockedBy gates. Diff what got taught against the full universe of what OUGHT to be teachable — every item with zero path is a finding. Where something IS reachable but only after an implausible amount of setup, report the reachability COST, not just a binary yes/no.
${SITUATIONAL}

The risk here isn't a plausible-but-wrong claim, it's a stale or incomplete "full universe" list to diff against — the enumeration of "everything that OUGHT to be teachable" must itself be complete (every VOCAB row, not a subset; every recipe, not just ones with existing examples).

Where agent reasoning genuinely helps: root-causing PATTERNS across many orphaned items (one root cause can explain thousands of orphans), not just listing every unreachable item flatly.

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const SIMULATION = `${GROUND_RULES}

## Your track: run the real reachability simulation fresh

\`src/lib/content/interleaved-schedule.test.ts\` already does almost exactly this (a round-robin simulation across every UNIT_TRACK, real blockedBy gates honored) — run it directly (\`node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/interleaved-schedule.test.ts\`) rather than building from scratch. Report exact pass/fail counts, per-track units-taught/total/unreachable, gap min/max and where the max gap occurs, and total rounds to exhaustion. Then diff against \`docs/interleaved-schedule-findings.md\`'s baseline table if it exists — report any drift (content growth is not itself a regression, but state it plainly) and check whether any code comment justifying a threshold (e.g. citing a specific kanji/word as the worst case) still names the actual current worst case — trace the mechanism yourself rather than trusting the comment.`

const universePrompt = (domain, whatToCheck) => `${GROUND_RULES}

## Your track: ${domain} universe completeness

${whatToCheck}

Report the exact total count in the source of truth, the exact count reachable via the real production scheduling code, and — critically — full accounting for any gap: does every "missing" item trace to a documented, deliberate exclusion, or is there real unexplained residue? A gap that's 100% accounted for by named exclusions is a clean result; any unexplained residue is a real finding.`

phase('Find')
const [simulation, vocabUniverse, kanjiUniverse, grammarUniverse, counterUniverse] = await parallel([
  () => agent(SIMULATION, { label: 'find:simulation', phase: 'Find' }),
  () => agent(universePrompt('vocab', 'Diff the full VOCAB table (src/data/generated/vocab.json plus any hand-added SUPPLEMENT entries) against CURRICULUM_SEQUENCE\'s actual word-role glyph set (the frozen build-time output, not just the CURRICULUM_WORDS filter predicate — watch for a single-Han-character fold mechanism that can make a "missing" word ride in via its kanji item).'), { label: 'find:vocab-universe', phase: 'Find' }),
  () => agent(universePrompt('kanji', 'Diff the full jōyō kanji table against CURRICULUM_SEQUENCE\'s kanji-role glyph set AND against actually-produced scheduling units (a glyph can be present in the sequence but still fail to produce a real unit) — check both, by direct execution of the real content-building functions, not just by reading source.'), { label: 'find:kanji-universe', phase: 'Find' }),
  () => agent(universePrompt('grammar recipe', 'Diff every recipe id in the grammar recipes source table against grammarItems()\'s actual output (via its underlying fact registry, not just lesson count) — a recipe can legitimately fold into another recipe\'s primary entry (a documented pattern-grouping design) without being lost; distinguish that from real loss.'), { label: 'find:grammar-universe', phase: 'Find' }),
  () => agent(universePrompt('counter category', 'Diff every declared counter/construction category against numbersTrack()\'s actual live output via direct execution — check both directions (source→output and output→source), and separately check whether any counter form exists only as a rote/hand-authored entry without ever being promoted to a generative category (or vice versa).'), { label: 'find:counter-universe', phase: 'Find' }),
])

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent re-derivation of the "${label}" track's claim

Do not trust the finder's counts or their "full universe" enumeration — re-derive it yourself, from scratch, ideally by a genuinely different method than the one described (e.g. if they diffed against a filter predicate, diff against the frozen build output instead, or vice versa) so a shared blind spot in one method doesn't just get rubber-stamped by a second run of the same method.

Claim to verify:
"""
${claim}
"""

Your final message: your own independently-reproduced numbers and CONFIRMED/REFUTED/CORRECTED verdict, with the method you used stated explicitly.`

const [vSimulation, vVocab, vKanji, vGrammar, vCounter] = await parallel([
  () => agent(VERIFY('simulation', simulation), { label: 'verify:simulation', phase: 'Verify' }),
  () => agent(VERIFY('vocab-universe', vocabUniverse), { label: 'verify:vocab-universe', phase: 'Verify' }),
  () => agent(VERIFY('kanji-universe', kanjiUniverse), { label: 'verify:kanji-universe', phase: 'Verify' }),
  () => agent(VERIFY('grammar-universe', grammarUniverse), { label: 'verify:grammar-universe', phase: 'Verify' }),
  () => agent(VERIFY('counter-universe', counterUniverse), { label: 'verify:counter-universe', phase: 'Verify' }),
])

phase('Synthesize')
const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 04 report

Combine all 5 tracks' find and verify results below into one prioritized report, most severe first (a genuinely unreachable item is critical; a reachable-but-expensive gate is high/medium; doc/comment staleness is low). A "0 findings, fully clean, independently confirmed" result on a track is real, valuable information — report it as such, don't bury it. Then publish as a shareable Artifact (use the Artifact tool).

SIMULATION FIND: """${simulation}""" VERIFY: """${vSimulation}"""
VOCAB UNIVERSE FIND: """${vocabUniverse}""" VERIFY: """${vVocab}"""
KANJI UNIVERSE FIND: """${kanjiUniverse}""" VERIFY: """${vKanji}"""
GRAMMAR UNIVERSE FIND: """${grammarUniverse}""" VERIFY: """${vGrammar}"""
COUNTER UNIVERSE FIND: """${counterUniverse}""" VERIFY: """${vCounter}"""

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (any genuinely unreachable content found, top severity, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
