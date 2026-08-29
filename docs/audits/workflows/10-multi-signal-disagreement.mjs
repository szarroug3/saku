export const meta = {
  name: 'audit-10-multi-signal-disagreement',
  description: 'Resolve every pronunciation multi-signal disagreement (not just the clean-cut ones) and verify seed-script coverage completeness',
  phases: [
    { title: 'Discover', detail: 'locate the SAK-215/216/218 sweep data, bucket the 893 disagreements' },
    { title: 'Find', detail: 'resolve 2-vs-1 and all-3-disagree buckets; job 2 coverage enumeration' },
    { title: 'Verify', detail: 'independent refutation attempts and re-derivation' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = '/Users/samreenzarroug/git/personal/saku'

const GROUND_RULES = `You are running part of audit 10 (multi-signal disagreement resolution) for the Saku Japanese-learning app. Repo: ${REPO}. This is a read-only investigative audit: no source edits, no writes to production Supabase, no seed/regen scripts against real data, no commits/merges/Linear changes.

Dev server is already running at http://localhost:3092 if you need live browser access — don't start another one, don't kill it. A pitch-audio reseed that was running earlier has now FULLY FINISHED (94,734/94,734 clips processed, 0 failed) — its result is now a stable, trustworthy answer, not a mid-generation snapshot. If you make audio_query/synthesis calls, target the local VOICEVOX engine at http://localhost:50021, never a remote Cloud Run VOICEVOX host.

Background: this audit exists because the SAK-215/216/218 pronunciation work compared three signals per word reading — bare hiragana (what the app actually sends), bare katakana (bypasses lexical ambiguity), and kanji-spelling-in-context (disambiguated by a real sentence). A word was only confirmed as a bug when bare disagreed AND katakana exactly matched context — precise, but out of 893 raw three-way disagreements found, only 8 satisfied it. The other 885 were bucketed as "noise" by pattern, never actually investigated. Sam: "we can't ignore the 885. that is 885 potentially incorrect things." "Didn't fit the clean rule" is not the same as "verified fine."

Report candidate findings/resolutions even where you're unsure — a later independent pass will try to refute them, so being wrong here is fine as long as you say your confidence level.`

phase('Discover')
const DISCOVER = `${GROUND_RULES}

## Your job: locate the original data and do the cheap bucketing

Find the actual SAK-215/216/218 pronunciation sweep — the script/output that produced the "893 raw three-way disagreements, only 8 confirmed" result. Search the repo (scripts/, docs/, any audit/report artifacts, git log/blame around SAK-215/216/218) for the actual per-word three-signal data (bare hiragana reading, bare katakana reading, kanji-context reading, per word). If the raw per-item data isn't saved anywhere and only the summary counts exist, you may need to RE-RUN the comparison logic yourself (read-only — do not overwrite any committed file) to regenerate the full per-word breakdown into a scratch file.

Once you have the full per-word three-signal dataset, bucket every one of the 893 (or however many you actually find — report the exact count and reconcile it against "893" if it differs) into exactly three buckets:
1. **Full agreement** (all three signals match) — just count these, no further action needed.
2. **2-vs-1 split** (two signals agree, one differs) — list every item: word, the three signal values, which one is the outlier.
3. **All three disagree** — list every item: word, all three signal values.

Save bucket 2 and bucket 3's full item lists to scratch files (under /private/tmp/claude-501/-Users-samreenzarroug/ecb98169-e50d-4254-bc58-ced50ea8ad47/scratchpad/audit10/) so later stages can read them, and also include the full lists directly in your final message (not just file paths) since later agents in this pipeline won't have file access to your scratch directory reliably — paste the actual bucketed lists.

Your final message: exact counts for all three buckets (full-agreement / 2-vs-1 / all-3-disagree), the complete bucket-2 and bucket-3 item lists (word + all three signal values + which is the outlier for bucket 2), and where you found/how you reconstructed the original data.`

const discovered = await agent(DISCOVER, { label: 'discover:locate-and-bucket', phase: 'Discover' })

phase('Find')
const TWO_V_ONE = `${GROUND_RULES}

## Your job: resolve the 2-vs-1 split bucket

Below is the full 2-vs-1 bucket from the discovery pass. For EACH item, the majority is *likely* correct but "likely" is not "verified" — actively try to REFUTE the majority rather than just trusting the vote count. A 2-1 split could still be two-wrong-one-right if the two that agree happen to share a DIFFERENT quirk the third one avoids (the original SAK-215/218 rule never checked for this, since it only ever treated katakana+context-agree as the trusted pair — it never considered a split where, say, bare+katakana agree and context is the outlier).

For each item, gather at least one additional piece of independent evidence beyond re-reading the same three signals (e.g. cross-check against a dictionary source, check whether the word has multiple legitimate readings depending on sense, check the actual sentence context more carefully, check Kanjium/JMdict directly) before accepting or overturning the majority.

Given the size of this bucket, if it's large, prioritize actually resolving as many as you can with real per-item investigation over rushing through all of them superficially — sample if you must, but state exactly what fraction you resolved with real investigation vs. skipped, and why. Do not silently apply the same "just count the votes" shortcut this audit exists to fix.

For each item resolved, report: word, the three signal values, which was the outlier, your verdict (majority confirmed / majority overturned / genuinely unresolved), and your evidence.

Bucket 2-vs-1 data from discovery pass:
"""
${discovered}
"""

Your final message: per-item resolutions as described above, plus a summary count (how many confirmed majority, how many overturned, how many unresolved, how many not reached and why).`

const ALL_THREE = `${GROUND_RULES}

## Your job: resolve the all-three-disagree bucket — the hard case

For EACH item where all three signals disagree, actively attempt to determine which signal (if any) is correct: check whether the word has multiple legitimate readings, gather additional context (a different real sentence, a dictionary lookup, Kanjium data), whatever "one more piece of evidence" means for this specific word.

If genuine effort still can't resolve an item, the explicit, reportable outcome is "unresolved — don't know which is correct" — this is a real, valid, actionable finding in its own right (it tells Sam exactly which words need her own judgment), NOT a failure to verify and NOT something to silently drop.

Given the size of this bucket, if it's large, prioritize real per-item investigation over superficial coverage of all of them — sample if you must, but state exactly what fraction you resolved vs. sampled vs. left pending, honestly.

For each item, report: word, all three signal values, your verdict (which signal is correct, with evidence — or explicitly "unresolved"), and your confidence.

All-three-disagree bucket data from discovery pass:
"""
${discovered}
"""

Your final message: per-item resolutions as described above, plus a summary count (how many resolved to signal X, how many explicitly unresolved, how many not reached and why).`

const JOB2_FIND = `${GROUND_RULES}

## Your job: Job 2 — verify the seed script's coverage claim from scratch

Direct precedent (SAK-216): pitchItems() (the pitch-seed's enumeration function) only ever generated each word's CORRECT downstep — the live pitch quiz's "wrong"-mode DISTRACTOR clip is a real, structurally different request shape the seed's enumeration never accounted for. Not a disagreement between signals — a coverage gap: a real thing the live app could ask for that the seed never knew to generate.

Your job: for every live code path that can trigger on-demand audio generation, enumerate the FULL parameter space each one can actually request, from the actual call sites (not from memory or from trusting a prior pass):
- Every caller of \`synthesizeWordWav\`/\`synthesizeSentenceWav\` (grep the whole repo for these).
- The \`/api/pitch-tts\` and \`/api/tts\` route handlers — what parameters/shapes can a real client request send them.

Then cross-check that full parameter space against what the seed script's enumeration function(s) actually produce: \`pitchItems()\` for pitch (find it), AND find and check the equivalent enumerator for the general voice/sentence sets too (this has NOT been checked outside pitch before — this is new ground for the app, not a re-check).

The pitch-audio reseed has now fully finished (94,734/94,734, 0 failed) — you can treat its output as complete and query it directly (e.g. check storage/DB state, or the seed script's own completion report) as ground truth for what's actually been generated, not just what the enumeration function claims it would generate.

Anything the live app can request that the seed's enumeration doesn't cover is a coverage gap, full stop — report it as such.

Your final message: the full enumerated live-request parameter space (with file:line for each call site), the seed enumeration's actual coverage for pitch AND for general voice/sentence sets, and a specific list of any gaps found (what the live app can request that the seed doesn't generate).`

const [twoVOneResult, allThreeResult, job2Result] = await parallel([
  () => agent(TWO_V_ONE, { label: 'find:job1-2v1-bucket', phase: 'Find' }),
  () => agent(ALL_THREE, { label: 'find:job1-all3-bucket', phase: 'Find' }),
  () => agent(JOB2_FIND, { label: 'find:job2-seed-coverage', phase: 'Find' }),
])

phase('Verify')
const VERIFY_JOB1 = `${GROUND_RULES}

## Your job: independent verification of job 1's disagreement resolutions

Below are two sets of per-item resolutions (the 2-vs-1 bucket and the all-3-disagree bucket). Pick a meaningful sample from EACH set (at least 10-15 items per set, or all of them if the sets are small) and independently try to REFUTE each resolution — don't just re-read and agree. Re-derive the reading/evidence yourself from an authoritative source (JMdict, Kanjium, a fresh sentence-context check) rather than trusting the finder's stated evidence. Pay special attention to any item marked "unresolved" — confirm genuine effort was made before accepting that verdict, and to any "majority confirmed" verdict in the 2-vs-1 bucket — specifically check for the "two share a different quirk" failure mode this audit exists to catch.

2-VS-1 BUCKET RESOLUTIONS:
"""
${twoVOneResult}
"""

ALL-3-DISAGREE BUCKET RESOLUTIONS:
"""
${allThreeResult}
"""

Your final message: for your sampled items, state CONFIRMED or REFUTED (with your own independent evidence) for each, and an overall assessment of whether the two find-stage agents' methodology held up under scrutiny.`

const VERIFY_JOB2 = `${GROUND_RULES}

## Your job: independent re-derivation of job 2's coverage claim

Do NOT trust the enumeration below — re-derive "everything the live app can request" from scratch yourself, independently: grep for synthesizeWordWav/synthesizeSentenceWav callers and read the /api/pitch-tts and /api/tts routes yourself, from the actual current source. Then independently check the seed's enumeration functions (pitchItems() and the general voice/sentence equivalent). Compare your own independently-derived gap list against the claim below — confirm, correct, or add to it.

Claim to verify:
"""
${job2Result}
"""

Your final message: your own independently-derived live-request parameter space and seed-coverage comparison, explicit agreement/disagreement with the claim above, and any gaps you found that it missed (or false gaps it claimed that don't actually exist).`

const [verifyJob1, verifyJob2] = await parallel([
  () => agent(VERIFY_JOB1, { label: 'verify:job1-disagreements', phase: 'Verify' }),
  () => agent(VERIFY_JOB2, { label: 'verify:job2-coverage', phase: 'Verify' }),
])

phase('Synthesize')
log('Both jobs found and independently verified — synthesizing final report')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 10 report

Combine everything below into one report with this exact structure (per the audit's own required report structure):

**Job 1 — disagreement resolution:**
1. Full agreement count (from the discovery pass) — report it, no action needed.
2. 2-vs-1 split: per-item verdicts (majority confirmed / overturned), incorporating the verify pass's confirmations/refutations. Report the overall count breakdown.
3. All-three-disagree: per-item verdicts INCLUDING explicit "unresolved — don't know which is correct" as its own valid, reported category — never silently dropped. Report the overall count breakdown.
Be explicit and honest about what fraction of the 885 previously-unexamined items was actually resolved with real investigation vs. sampled vs. left pending — do not imply exhaustive coverage if it wasn't achieved.

**Job 2 — seed coverage completeness:**
Report the full live-request parameter space, the seed's actual coverage, and any gaps found as their own concrete findings (full stop, per the audit's framing) — incorporate the independent verify pass's corrections/additions.

Prioritize the final punch list by severity across BOTH jobs together, most severe first. A "genuinely resolved this is fine" item is real information, not nothing to report. An "unresolved" item is a real, actionable finding, not a failure.

Then publish this as a shareable Artifact (use the Artifact tool).

DISCOVERY (bucketing):
"""
${discovered}
"""

JOB 1 — 2-VS-1 FIND:
"""
${twoVOneResult}
"""

JOB 1 — ALL-3-DISAGREE FIND:
"""
${allThreeResult}
"""

JOB 1 — VERIFY:
"""
${verifyJob1}
"""

JOB 2 — FIND:
"""
${job2Result}
"""

JOB 2 — VERIFY:
"""
${verifyJob2}
"""

Your final message back must include: the Artifact URL of your published report, and a 2-3 sentence summary (how many of the 885 were actually resolved vs sampled vs pending, how many landed as genuine "unresolved," and whether job 2 found any real seed-coverage gaps).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
