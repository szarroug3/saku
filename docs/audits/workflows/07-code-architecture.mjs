export const meta = {
  name: 'audit-07-code-architecture',
  description: 'Senior-engineer architecture review: data-model consistency, component reuse ADOPTION, API patterns, scalability, type-safety, test coverage',
  phases: [
    { title: 'Find', detail: 'split by layer/subsystem' },
    { title: 'Verify', detail: 'enumerate every consumer of a flagged pattern, never just the first example' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 07 (code/architecture) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no commits/merges/Linear changes. Pure code-reading and static analysis, no browser needed.

Role: a senior engineer doing an architecture review. Not learner-facing at all — the only audit in this suite looking at the code itself rather than what it produces.

Hard-won lesson from a prior pass at this kind of audit (SAK-105): checking one plausible-looking call site per pattern and citing a file's own header comment as evidence of convergence was WRONG. The actual question is ADOPTION COVERAGE — what fraction of consumers actually use the new/correct pattern vs. still bypass it. "Additive, not yet consumed" is itself a real finding to report with real weight, not a reason to wave a section off as low-risk. "Fully adopted, no issue" needs the SAME rigor as "not adopted" — both are claims about the WHOLE set of consumers, not one example.
${SITUATIONAL}

The code-review and simplify skills (if available via the Skill tool) cover some of this ground — lean on them as components rather than re-deriving the same checks from scratch, if invoking a skill is available to you in this context.

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const LAYERS = [
  { key: 'data-model', label: 'data model', prompt: 'Look for parallel/duplicate representations of the same concept that should have converged onto one (e.g. two different ways of representing the same entity, evolved separately). For each one found, enumerate EVERY consumer, not just the first plausible one — report the actual adoption split (N consumers on the new pattern, M still on the old).' },
  { key: 'component-reuse', label: 'component reuse', prompt: 'For each shared component/pattern that exists, check whether it is actually adopted everywhere it applies, or whether some call sites still hand-roll their own version. Check whether anything NEW being actively built bypasses the shared pattern, creating more convergence work later — this is worse than old debt, since it\'s still accumulating. Report exact adoption counts (N of M call sites), not "mostly adopted."' },
  { key: 'api-data-fetching', label: 'API/data-fetching patterns', prompt: 'Check consistency of conventions for server actions, caching, error handling across API routes and data-fetching code. Look for one route handling errors/auth/caching differently from its siblings without a principled reason.' },
  { key: 'scalability', label: 'scalability', prompt: 'As the corpus/curriculum grows (check actual current sizes: vocab.json row count, curriculum-sequence.json length, etc.), do algorithms and data structures used in core scheduling/content-building code still hold up, or are there patterns (a full-table scan, an uncapped read-modify-write, an O(n²) operation) starting to strain at current scale? Look specifically at any full-blob read-modify-write pattern on frequently-mutated data (e.g. user progress).' },
  { key: 'type-safety-coverage', label: 'type-safety escape hatches + test coverage', prompt: 'Find any/unknown misuse and non-null-assertion clusters — distinguish principled uses (with a comment explaining why it\'s safe) from fragile-looking ones. Separately, identify core modules (especially any compare-and-set / concurrency-sensitive write path, and any large file with many unchecked casts) with weak or zero test coverage that other fixes would need to rely on being solid.' },
]

phase('Find')
const findResults = await parallel(
  LAYERS.map((l) => () => agent(`${GROUND_RULES}\n\n## Your layer: ${l.label}\n\n${l.prompt}`, { label: `find:${l.key}`, phase: 'Find' }))
)

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of the "${label}" layer's candidate findings

Per the hard-won lesson above: for EVERY claim about a pattern's adoption (whether "not adopted" or "fully adopted"), enumerate every actual consumer yourself via grep/read — never just spot-check the finder's first example and agree. If the finder claims "N of M adopted," recount M and N independently. For any specific denominator or count cited, recompute it yourself.

Candidate findings:
"""
${claim}
"""

Your final message: per-finding verdict (CONFIRMED/REFUTED/CORRECTED) with your own independently-enumerated consumer counts as evidence.`

const verifyResults = await parallel(
  LAYERS.map((l, i) => () => agent(VERIFY(l.label, findResults[i]), { label: `verify:${l.key}`, phase: 'Verify' }))
)

phase('Synthesize')
const sections = LAYERS.map((l, i) => `--- ${l.label.toUpperCase()} ---\nFIND:\n"""${findResults[i]}"""\nVERIFY:\n"""${verifyResults[i]}"""`).join('\n\n')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 07 report

Combine all ${LAYERS.length} layers' find and verify results below into one prioritized report, most severe first, deduped. State coverage explicitly (what was read in full vs. spot-checked vs. not reached) rather than implying exhaustive coverage. Then publish as a shareable Artifact (use the Artifact tool).

${sections}

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (top finding severity, how many findings survived verification, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
