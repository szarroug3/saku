export const meta = {
  name: 'audit-02-fact-checking',
  description: 'Cross-check taught content against authoritative sources (JMdict, Kanjium) for correctness and pedagogical clarity',
  phases: [
    { title: 'Find', detail: 'one agent per content-type track' },
    { title: 'Verify', detail: 'independent cross-check against the authoritative source directly' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const DEV_URL = args?.devServerUrl ?? 'http://localhost:3092'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 02 (fact-checking) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no seed/regen scripts against real data, no commits/merges/Linear changes.

Role: bring your full, real Japanese knowledge to this — the point is to catch errors a naive learner has no way to notice, the way an expert reviewer would. No taught-ledger, no simulated ignorance (that's audit 01's job, not this one's). Cross-reference against real authoritative sources the app itself claims to follow (JMdict for readings/meanings/pos via jisho.org or similar, Kanjium for pitch accent) — verify the app's INGESTED data actually matches them, not just that the app is internally self-consistent.

Dev server is already running at ${DEV_URL} if you need live browser access for pedagogical-clarity/internal-consistency checks — don't start another one, don't kill it.
${SITUATIONAL}

Guard against a known false-positive trap: a naive "this looks wrong" signal can be a legitimate exception (こんにちは, correctly pronounced こんにちわ, is real standard Japanese, not a bug). Any "content is wrong" finding needs an independent, mechanical cross-check against the authoritative source before it's trusted, not just one confident claim.

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them.`

const READINGS = `${GROUND_RULES}

## Your track: readings

Does every taught reading match the authoritative source (JMdict)? Sample broadly across the curriculum (front-loaded early words plus a random sample from deeper in), cross-checking each word's taught reading against a live JMdict lookup. Also check kanji on'yomi/kun'yomi readings against KANJIDIC2. Look for systematic patterns, not just isolated typos — an ingest bug (e.g. a script keying off the wrong field) can silently affect many words at once with one root cause. Report exact word/kanji, taught value, authoritative source value, and severity.`

const PITCH = `${GROUND_RULES}

## Your track: pitch accent

Does the app's pitch data match Kanjium — not just "is it internally consistent with itself"? An ingest bug means the pitch data itself is wrong, which no amount of app-logic correctness would catch. Fetch live Kanjium source data (raw accents.txt from the mifunetoshiro/kanjium GitHub repo) and cross-check a broad sample of taught words' pitch values against it, prioritizing high-exposure early-curriculum words. If you find mismatches, look for a systematic root cause (e.g. an ingest script keying off the wrong reading field for words where multiple readings/senses exist) rather than reporting each as an isolated fact.`

const MEANINGS = `${GROUND_RULES}

## Your track: meanings/glosses

Accurate, not misleading, appropriately scoped for a beginner (not a rare/archaic sense presented as primary). Cross-check a broad sample (~100+) of taught words and kanji against JMdict/KANJIDIC2 — does the app's shown gloss match the authoritative primary sense, in the right position/ranking? Watch for homograph traps (a kana string with multiple distinct JMdict entries) — confirm the app is teaching the common/primary sense, not a rare one, before flagging a mismatch as a bug.`

const GRAMMAR_EXPL = `${GROUND_RULES}

## Your track: grammar explanations

Is the rule as stated actually correct Japanese grammar — not just internally consistent with how the app applies it elsewhere? Read the grammar recipe/rule data and lesson prose directly (src/data/grammar/**) and check every stated rule, exception, and conjugation pattern against your own real grammatical knowledge. Flag anything that's factually wrong as a statement of Japanese, or that overstates/understates a real distinction (e.g. an absolute claim about a usage pattern that actually has real exceptions in casual speech).`

const EXAMPLES = `${GROUND_RULES}

## Your track: example sentences

Natural, idiomatic Japanese — not awkward constructions a native speaker wouldn't actually say. Sample broadly across the app's example-sentence sources (word examples, grammar-pattern examples, particle-drill examples). For each sampled sentence, judge naturalness/register AND cross-check that the sentence's highlighted word/pattern actually appears with the correct reading in context (a tokenizer mis-extraction can silently attach the wrong word to a sentence, or a compound-word reading can differ from the word's reading in isolation — check furigana against the actual reading rules, e.g. rendaku, for words appearing inside compounds).`

const PEDAGOGY = `${GROUND_RULES}

## Your track: pedagogical clarity + internal consistency

Even when factually correct, is the explanation well-sequenced and free of unexplained jargon? Does the same fact get taught/explained the same way everywhere it appears (Library page, lesson card, quiz prompt, worked example)? Use the live app at ${DEV_URL} to walk a sample of words/kanji/grammar points across multiple surfaces (Library page, lesson card, quiz) and compare. Also check the underlying quiz/fact-grading model against what the Library page teaches — e.g. does a word with multiple distinct senses get graded as one merged fact when the Library correctly teaches them as separate meanings?`

phase('Find')
const [readings, pitch, meanings, grammarExpl, examples, pedagogy] = await parallel([
  () => agent(READINGS, { label: 'find:readings', phase: 'Find' }),
  () => agent(PITCH, { label: 'find:pitch-accent', phase: 'Find' }),
  () => agent(MEANINGS, { label: 'find:meanings-glosses', phase: 'Find' }),
  () => agent(GRAMMAR_EXPL, { label: 'find:grammar-explanations', phase: 'Find' }),
  () => agent(EXAMPLES, { label: 'find:example-sentences', phase: 'Find' }),
  () => agent(PEDAGOGY, { label: 'find:pedagogical-clarity', phase: 'Find' }),
])

phase('Verify')
const VERIFY = (trackName, claim) => `${GROUND_RULES}

## Your job: independent verification of the "${trackName}" track's candidate findings

Cross-check each candidate finding against the authoritative source DIRECTLY and independently — refetch the JMdict/Kanjium data yourself, don't trust the finder's quoted values. Guard against the こんにちは-style false-positive trap: confirm a flagged "error" isn't actually a legitimate standard exception before agreeing it's a bug. For anything you can't confirm or that turns out to be a false positive, say so plainly.

Candidate findings:
"""
${claim}
"""

Your final message: per-finding verdict (CONFIRMED / REFUTED / DOWNGRADED, with your own independent source check as evidence).`

const [vReadings, vPitch, vMeanings, vGrammarExpl, vExamples, vPedagogy] = await parallel([
  () => agent(VERIFY('readings', readings), { label: 'verify:readings', phase: 'Verify' }),
  () => agent(VERIFY('pitch-accent', pitch), { label: 'verify:pitch-accent', phase: 'Verify' }),
  () => agent(VERIFY('meanings-glosses', meanings), { label: 'verify:meanings-glosses', phase: 'Verify' }),
  () => agent(VERIFY('grammar-explanations', grammarExpl), { label: 'verify:grammar-explanations', phase: 'Verify' }),
  () => agent(VERIFY('example-sentences', examples), { label: 'verify:example-sentences', phase: 'Verify' }),
  () => agent(VERIFY('pedagogical-clarity', pedagogy), { label: 'verify:pedagogical-clarity', phase: 'Verify' }),
])

phase('Synthesize')
const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 02 report

Combine all six tracks' find and verify results below into one prioritized report, most severe first, deduped. A confirmed content bug (the app actively teaches something false) is more urgent than a clarity complaint. Include what was actually checked (sample sizes, coverage), not just what was found. Then publish as a shareable Artifact (use the Artifact tool).

READINGS FIND: """${readings}""" VERIFY: """${vReadings}"""
PITCH FIND: """${pitch}""" VERIFY: """${vPitch}"""
MEANINGS FIND: """${meanings}""" VERIFY: """${vMeanings}"""
GRAMMAR EXPLANATIONS FIND: """${grammarExpl}""" VERIFY: """${vGrammarExpl}"""
EXAMPLE SENTENCES FIND: """${examples}""" VERIFY: """${vExamples}"""
PEDAGOGICAL CLARITY FIND: """${pedagogy}""" VERIFY: """${vPedagogy}"""

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (top finding severity, how many findings survived verification, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
