export const meta = {
  name: 'audit-06-content-style-voice',
  description: 'Terminology, tone, and house-style (no em dashes) consistency across all user-facing copy',
  phases: [
    { title: 'Find', detail: 'split by content area (components, prose data files, route pages, live browser pass)' },
    { title: 'Verify', detail: 'independent re-check with exact quotes and git-blame timing' },
    { title: 'Synthesize', detail: 'combine, publish Artifact' },
  ],
}

const REPO = args?.repo ?? '/Users/samreenzarroug/git/personal/saku'
const DEV_URL = args?.devServerUrl ?? 'http://localhost:3092'
const SITUATIONAL = args?.situationalContext ?? ''

const GROUND_RULES = `You are running part of audit 06 (content style/voice) for the Saku Japanese-learning app. Repo: ${REPO}. Read-only investigative audit: no source edits, no writes to production Supabase, no commits/merges/Linear changes.

Check for: house style violations (this app's own standing rule is NO EM DASHES in user-facing content — check SAK-84 for prior cleanup scope, but verify independently rather than assuming it's complete, and check git blame/commit timing to distinguish pre-existing debt from something added after SAK-84's cleanup landed); terminology drift (the same concept named differently across surfaces, e.g. a UI action labeled one thing at launch and a different thing on review); tone/register inconsistency (a sudden shift in person, formality, or sentence-template rigidity within or across otherwise-consistent content); unglossed jargon (an internal/technical term surfacing in learner-facing copy without ever being taught — before flagging, check whether the term IS actually taught elsewhere, e.g. a dedicated glossary entry or intro card, before calling it unexplained).

Dev server is already running at ${DEV_URL} if you need live rendering for a track — don't start another one, don't kill it. The browser pane may be shared with concurrent audits — open your own tab, re-verify anything surprising.
${SITUATIONAL}

Report candidate findings even if unsure — false positives are fine, a later verify pass will try to refute them. Quote actual copy verbatim with file:line, not paraphrase.`

const TRACKS = [
  { key: 'ui-learn-quiz-practice', label: 'UI components: learn/quiz/practice', prompt: 'Read every .tsx file under src/components/learn, src/components/quiz, src/components/practice, src/components/session, src/components/current, src/components/lesson. Grep for em-dash (distinguish real rendered strings from comments), unexplained jargon, tone shifts, and terminology conflicts between mode/activity names (Round, Session, Lesson, Quiz, Drill, Practice, Review).' },
  { key: 'grammar-prose', label: 'grammar/lesson-structure prose', prompt: 'Read src/data/grammar/authored.ts, grammar-concepts.ts, recipes.ts, clusters.ts, lessons.ts, form-intros.ts, terms.ts, how-it-works.ts, track-intros.ts, phase-intros.ts. Check for internal type/implementation names leaking into learner-facing feel/summary fields, tone shifts within otherwise-consistent files, quote-style consistency, and confirm which of these files' rendered strings actually contain em dashes vs. only their comments.' },
  { key: 'vocab-structured-labels', label: 'vocab/structured-label data', prompt: 'Read src/data/marks.ts, number-construction.ts, dakuten-rows.ts, yoon-rows.ts, counters.ts, counter-categories.ts, and similar structured-label files. Check for em dashes in learner-facing rule-card text, unglossed jargon introduced ad hoc (a coined internal term used repeatedly without ever being taught, breaking the codebase\'s own established "teach the real word first" pattern if one exists), and register consistency across similarly-structured entries in the same file/interface.' },
  { key: 'etymology-mnemonic-prose', label: 'etymology/mnemonic prose', prompt: 'Read src/data/kanji-etymology-prose.ts and its batch/manual files, radical-tips.ts, why.ts, mnemonics.ts. Check the house-style enforcement (a banned-jargon-terms regex test may already exist — find and run it) for real violations, check em-dash compliance the same way, check for tone drift between early and late batch files (sample far apart), and note whether SAK-84\'s actual merged commit touched this directory at all (check git log) before assuming it\'s in scope for that cleanup.' },
  { key: 'route-pages', label: 'app route pages copy', prompt: 'Read every page.tsx/layout.tsx under src/app (excluding dev/*, note those separately as internal-only since they 404 in production). Check metadata titles for consistency, check intro copy for unexplained jargon (does the page assume a term it exists to define?), check em-dash compliance in rendered JSX text and string props (not just comments).' },
  { key: 'ui-other-components', label: 'UI components: library/grammar/settings/results/other', prompt: 'Read every .tsx file under src/components/library, src/components/grammar, src/components/lists, src/components/stats, src/components/results, src/components/settings, src/components/home, src/components/auth, src/components/ui. Check terminology consistency for the primary "start a round" action across contexts (does the same underlying mode/config value get a different learner-facing name depending on where it\'s shown?), em-dash compliance with git-blame timing against SAK-84, and unglossed jargon in aria-labels/tooltips (check whether the term is actually taught elsewhere before flagging).' },
  { key: 'live-browser-pass', label: 'live browser rendered-text pass', prompt: `Using the Claude Browser MCP against ${DEV_URL}, walk a real Learn round, the Practice config screen and a session if you can start one, the Progress page, a Library entry, and at least two empty states (no search results, no sessions yet). Note anything that reads oddly live that wouldn't show up in a static code read (a template fragment rendering standalone, an inconsistent empty-state tone, a terminology mismatch between the button that starts an activity and the label shown reviewing it later). If shared-tab contention with other concurrent audits blocks a surface, say so explicitly as a coverage gap rather than skipping silently.` },
]

phase('Find')
const findResults = await parallel(
  TRACKS.map((t) => () => agent(`${GROUND_RULES}\n\n## Your track: ${t.label}\n\n${t.prompt}`, { label: `find:${t.key}`, phase: 'Find' }))
)

phase('Verify')
const VERIFY = (label, claim) => `${GROUND_RULES}

## Your job: independent verification of the "${label}" track's candidate findings

Re-open every cited file:line yourself and confirm the quote is exact. For any em-dash finding, run \`git blame\` on the line to get its actual commit and date, and compare against SAK-84's actual merged commit (find it via git log) to determine genuinely whether it predates, postdates, or was missed by that cleanup — don't just accept the finder's "recent" or "old" framing. For any jargon finding, actively search for whether the term IS taught elsewhere (a glossary entry, an intro card, a dedicated lesson) before agreeing it's unexplained — this is a common false-positive pattern in this kind of audit.

Candidate findings:
"""
${claim}
"""

Your final message: per-finding verdict (CONFIRMED/REFUTED/CORRECTED) with exact quotes, line numbers, and git-blame evidence where relevant.`

const verifyResults = await parallel(
  TRACKS.map((t, i) => () => agent(VERIFY(t.label, findResults[i]), { label: `verify:${t.key}`, phase: 'Verify' }))
)

phase('Synthesize')
const sections = TRACKS.map((t, i) => `--- ${t.label.toUpperCase()} ---\nFIND:\n"""${findResults[i]}"""\nVERIFY:\n"""${verifyResults[i]}"""`).join('\n\n')

const SYNTH = `${GROUND_RULES}

## Your job: synthesize and publish the final audit 06 report

Combine all ${TRACKS.length} tracks' find and verify results below into one prioritized report, most severe first, deduped — the same underlying issue (e.g. a specific jargon leak, or a terminology inconsistency) often surfaces from more than one track's different angle; merge those into one finding rather than listing twice. List refuted candidates explicitly as "considered, not included" with the reason, rather than silently dropping them. Then publish as a shareable Artifact (use the Artifact tool).

${sections}

Your final message back must include: the Artifact URL, and a 2-3 sentence summary (top finding severity, how many findings survived verification, coverage full/partial and why).`

const finalReport = await agent(SYNTH, { label: 'synthesize-and-publish', phase: 'Synthesize' })
return finalReport
