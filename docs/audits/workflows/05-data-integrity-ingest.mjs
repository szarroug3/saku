export const meta = {
  name: 'audit-05-data-integrity-ingest',
  description: 'Check the generated data pipeline (src/data/generated/*) for internal consistency and staleness against its sources',
  phases: [
    { title: 'Find', detail: 'one agent per data domain' },
    { title: 'Verify', detail: 'independently regenerate from source and diff, never just eyeball' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 05 (data-integrity/ingest) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no commits/merges/Linear changes. No writes to production Supabase, no seed/regen scripts run against real data — where a check genuinely needs to exercise a build/ingest script (regenerating data from source to diff), copy the committed file aside first, run the regen, diff, then restore via \`git checkout --\` so the working tree stays clean. Never overwrite the committed file, never point any script at production.

Role: a data-pipeline reviewer. Not checking whether specific taught content is correct (a different audit's job) — checking whether the PIPELINE producing that content is sound. Check for: duplicate entries that should have collapsed into one; orphaned references (a fact ID, pattern ID, or cross-reference that doesn't resolve to real content anywhere); staleness (does regenerating a file from source, where a build:* script exists in package.json, produce byte-identical output to committed?); schema violations (missing required fields, inconsistent field presence across rows of the same type); cross-file consistency (does a fact referenced in one generated file correspond to a real entry in another?).
${SITUATIONAL}

Mostly code/data reading and scripting, no browser needed. Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const DOMAINS = [
  { key: 'vocab-lexical', label: 'vocab/lexical', scope: 'vocab.json, word-definitions.json, word-senses.json, word-examples.json, readings.json, meaning-registry.json(+.candidates.json), en-synonyms.json, cejc-reading-frequency.json' },
  { key: 'pitch-accent', label: 'pitch-accent pipeline', scope: 'pitch.json, pitch-pairs.json and their ingest scripts (pitch.mjs, pitch-pairs.mjs)' },
  { key: 'grammar-assembly-corpus', label: 'grammar/assembly corpus', scope: 'grammar-corpus.json, grammar-corpus-meta.json, grammar-corpus-dropped.json, assembly-corpus.json, assembly-corpus-meta.json, and their ingest/audit scripts' },
  { key: 'kanji-radicals', label: 'kanji/radicals/ordering', scope: 'kanji.json, kanji-components.json, kanji-etymology.json(+-manual.json), kanji-phonetic-gloss.json, kanji-radicals.json, radicals.json, radical-enrichment.json, confusable-derived.json, order.json, strokes/*' },
  { key: 'counters', label: 'counters', scope: 'counters.ts, counter-categories.ts and how they cross-reference vocab.json/kanji.json' },
  { key: 'curriculum-indexes', label: 'curriculum/learn indexes', scope: 'curriculum-sequence.json, word-rank.json, learn-index.json, library-index.json, scheduling-preview.json, reading-proof-facts.json' },
]

const domainPrompt = (label, scope) => `${GROUND_RULES}

## Your domain: ${label}

Files in scope: ${scope}

Where a \`build:*\` script exists for these files (check package.json), actually regenerate into a scratch location and diff against committed (copy the committed file aside, run the regen, diff, restore via git checkout --). A byte-identical diff is a clean, valuable result — report it as such. A mismatch means the committed file is stale — report the specific drift.

Check for duplicates, orphaned references, schema violations, and cross-file consistency against the other generated files and against the source-of-truth code that consumes this domain's data. Where a "looks wrong" signal turns out to be a documented, intentional design choice (check code comments and existing tests before flagging), don't report it as a finding — but do report it as a "checked, verified clean/intentional" item so a future pass doesn't waste time re-discovering it.`

phase('Find')
const findResults = await parallel(
  DOMAINS.map((d) => () => agent(domainPrompt(d.label, d.scope), { label: `find:${d.key}`, phase: 'Find' }))
)

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of the "${label}" domain's candidate findings

Never just eyeball the committed file and declare it plausible. For any staleness claim, actually attempt the regen yourself (copy aside, regen, diff, restore) rather than trusting the finder's diff output. For any duplicate/orphan/schema claim, re-derive the count yourself with your own script against the actual current files.

Candidate findings:
"""
${claim}
"""

Your final message: per-finding verdict (CONFIRMED/REFUTED/CORRECTED) with your own independently-reproduced evidence.`

const verifyResults = await parallel(
  DOMAINS.map((d, i) => () => agent(VERIFY(d.label, findResults[i]), { label: `verify:${d.key}`, phase: 'Verify' }))
)

phase('Synthesize')
const sections = DOMAINS.map((d, i) => `--- ${d.label.toUpperCase()} ---\nFIND:\n"""${findResults[i]}"""\nVERIFY:\n"""${verifyResults[i]}"""`).join('\n\n')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 05 report

Combine all ${DOMAINS.length} domains' find and verify results below into one prioritized report, most severe first, deduped. Check for any finding that might be the SAME underlying root cause surfacing from two different domains (e.g. a data-completeness gap in one file showing up as both a "missing entry" in one domain and an "orphaned reference" in another) and merge those rather than double-counting. Then publish as a shareable Artifact (use the Artifact tool).

${sections}

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (top finding severity, how many findings survived verification, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
