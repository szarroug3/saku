// DEV gallery of every quiz question TYPE the app can generate, one example per
// type, grouped by subject. Not shipped UI. Route: /dev/quiz-gallery
//
// Every card renders through the SAME components the real drill does —
// `DrillHalo` for the glyph/sentence stage, the exact MC option-grid and
// typed-input markup from drill-screen.tsx, and the real `ParticleTapCard` for
// the tap-drill — so a card here looks like the quiz, not a description of it.
// The one liberty taken: every card "reveals" its answer immediately (the
// success-coloured option, or the answer pre-filled in a read-only input),
// since this is a reference sheet, not something a learner should ever see
// mid-quiz.
//
// Grammar is ONE section, not four — production, fixed meaning, selection and
// the particle tap-drill are all "grammar meaning/production" as far as the
// app is concerned, just different showings of the same `grammarQuestions`
// registration (see src/lib/engine/question.ts), so they read as one subject
// here too.
//
// `questionsFor(fact).prompt()/.distractors()/.optionLabel()` and `revealFor()`
// build every card except two, which don't fit that per-fact shape:
//   - sentence RECOGNITION (hear a sentence, pick its meaning) — hand-built;
//     the real generator needs a learner's history to pick a readable
//     sentence, which a dev gallery has none of.
//   - the grammar SELECTION board is built off `selection()`
//     (src/lib/grammar/questions.ts) directly and threaded through
//     `PromptContext.grammarSelection`, exactly as a real showing rolls it.

import { McOptionGrid, type McOptionGridItem } from "@/components/quiz/mc-option-grid";
import { TypedAnswerBox } from "@/components/quiz/typed-answer-box";
import { kanaFact } from "@/data/characters";
import { meaningFactId, readingFactId, READINGS } from "@/data/kanji";
import { radicalMeaningFactId } from "@/data/radicals";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { GRAMMAR_FACTS, grammarProduction, patternMeaningFactId } from "@/data/grammar";
import { recipe } from "@/data/grammar/recipes";
import { examplesFor } from "@/data/grammar/corpus";
import { selection } from "@/lib/grammar/questions";
import { sideFactId } from "@/data/transitivity-facts";
import { VERB_PAIRS } from "@/data/transitivity";
import { KEIGO_SETS, keigoWordFactId } from "@/data/keigo";
import { CONSTRUCTION_CATEGORIES } from "@/data/counter-categories";
import { makeItem, type NumberQuizItem } from "@/lib/engine/number-quiz";
import { particleDrillFor, particleMarkerFor } from "@/lib/engine/particle-drill";
import { ParticleMarkerSentence } from "@/components/quiz/particle-marker-card";
import {
  questionsFor,
  revealFor,
  type PromptContext,
  type QuestionType,
} from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import { buildPitchShowing, rollPitchQuestion } from "@/lib/pitch-quiz";
import { DEFAULT_VOICE_ID } from "@/lib/voice";
import type { Direction, FactId } from "@/types";
import { Halo } from "./halo-preview";
import { ParticleTapPreview } from "./particle-tap-preview";
import { PitchPreview } from "./pitch-preview";

// ── sample facts, reusing the same real content the /dev/views gallery does ──

const KANA_A = kanaFact("あ");

const KANJI_SEI_MEANING = meaningFactId("生");
const KANJI_SEI_READING_ROW = READINGS.find((r) => r.k === "生" && r.anchor === "先生");
const KANJI_SEI_READING = KANJI_SEI_READING_ROW
  ? readingFactId(KANJI_SEI_READING_ROW.k, KANJI_SEI_READING_ROW.anchor, KANJI_SEI_READING_ROW.base)
  : null;
const KANJI_HITO_MEANING = meaningFactId("人");

const RADICAL_KI_MEANING = radicalMeaningFactId("禾");

const WORD_SENSEI_MEANING = wordMeaningFactId("先生");
const WORD_SENSEI_READING = wordReadingFactId("先生");

// The recipe table splits a verb-hosting pattern's production fact PER
// CONJUGATION CLASS (classProductionFactId), not one generic id per recipe —
// so the real fact has to be looked up off the shipped table, never
// hand-assembled from the recipe id alone.
const GRAMMAR_TAI_PRODUCTION =
  GRAMMAR_FACTS.find((f) => grammarProduction(f.id)?.recipe.id === "tai")?.id ?? null;
const GRAMMAR_WA_MEANING = recipe("wa") ? patternMeaningFactId("wa") : null;
const GRAMMAR_TE_KARA_EXAMPLE = examplesFor("te-kara")[0] ?? null;
const GRAMMAR_TE_KARA_SELECTION = GRAMMAR_TE_KARA_EXAMPLE
  ? selection(GRAMMAR_TE_KARA_EXAMPLE, "te-kara")
  : null;
const GRAMMAR_TE_KARA_FACT = GRAMMAR_TE_KARA_SELECTION ? patternMeaningFactId("te-kara") : null;
// A real showing's ctx — not a re-derivation. `selection()` already picked and
// safety-checked this board; the drill (and this page) just carries it.
const GRAMMAR_TE_KARA_CTX: PromptContext | null =
  GRAMMAR_TE_KARA_SELECTION && GRAMMAR_TE_KARA_FACT
    ? {
        grammarSelection: {
          frame: GRAMMAR_TE_KARA_SELECTION.frame,
          host: GRAMMAR_TE_KARA_SELECTION.host,
          en: GRAMMAR_TE_KARA_SELECTION.en,
          sourceId: GRAMMAR_TE_KARA_SELECTION.sourceId,
          choices: GRAMMAR_TE_KARA_SELECTION.choices.map((c) => patternMeaningFactId(c.id)),
        },
      }
    : null;

// The particle tap-drill (Package 4) — a real showing off が's own meaning fact.
const PARTICLE_TAP_GA = patternMeaningFactId("ga");
const PARTICLE_TAP_QUESTION = particleDrillFor(PARTICLE_TAP_GA, () => 0);

// The marker-choice sibling — same が meaning fact, the other direction: the
// word is highlighted and the learner picks which particle marks it.
const PARTICLE_MARKER_QUESTION = particleMarkerFor(PARTICLE_TAP_GA, () => 0);

const OPEN_CLOSE_PAIR = VERB_PAIRS.find((p) => p.happens.word === "開く") ?? VERB_PAIRS[0];
const TRANSITIVITY_HAPPENS = sideFactId(OPEN_CLOSE_PAIR, "happens");
const TRANSITIVITY_DOIT = sideFactId(OPEN_CLOSE_PAIR, "doIt");

const KEIGO_EAT_SET = KEIGO_SETS.find((s) => s.id === "eat") ?? null;
const KEIGO_EAT_HONORIFIC = KEIGO_EAT_SET
  ? (KEIGO_EAT_SET.words.find((w) => w.register === "honorific") ?? null)
  : null;
const KEIGO_EAT_FACT =
  KEIGO_EAT_SET && KEIGO_EAT_HONORIFIC ? keigoWordFactId(KEIGO_EAT_SET, KEIGO_EAT_HONORIFIC) : null;

// The real drillable fact for a counter category — a `word` fact `isConstructionFact`
// recognizes, NOT the counter's own vocab-meaning fact (a different id: see
// src/data/counter-categories.ts). Getting this wrong renders every direction as
// the same plain "meaning" card, which is exactly the bug this page shipped with.
const NUMBER_CATEGORY = CONSTRUCTION_CATEGORIES.find((c) => c.id === "hon") ?? null;
const NUMBER_FACT = NUMBER_CATEGORY?.fact ?? null;
const NUMBER_READ: NumberQuizItem | null = makeItem(3, "hon", "read");
const NUMBER_WRITE: NumberQuizItem | null = makeItem(3, "hon", "write");
const NUMBER_HEAR: NumberQuizItem | null = makeItem(3, "hon", "hear");

// A hand-built sentence-recognition item. The real generator (readableRecognition
// in src/lib/grammar/readable.ts) rolls one from a learner's known vocabulary; a
// dev gallery has no history to roll against, so this is a fixed stand-in of the
// exact shape src/lib/listen-sentence.ts's RecognitionItem carries.
// SAK-128's two mechanics, each forced deterministically (rng always 0) so the
// gallery always shows the same clip order/partner rather than reshuffling on
// every load — a reference sheet, not a live roll.
// "pair": 箸 (chopsticks, downstep 1) really does share はし with 橋 (bridge,
// downstep 2) in the curriculum's own homophone-pair table (SAK-128's ingest).
const PITCH_PAIR_QUESTION = rollPitchQuestion("箸", () => 0);
const PITCH_PAIR_SHOWING = PITCH_PAIR_QUESTION
  ? buildPitchShowing(PITCH_PAIR_QUESTION, DEFAULT_VOICE_ID, () => 0)
  : null;
// "wrong": お金 (money) carries verified pitch but has no homophone partner in
// the curriculum, so it resolves to the correct-vs-synthetically-mispitched
// fallback rather than the pair mechanic above.
const PITCH_WRONG_QUESTION = rollPitchQuestion("お金", () => 0);
const PITCH_WRONG_SHOWING = PITCH_WRONG_QUESTION
  ? buildPitchShowing(PITCH_WRONG_QUESTION, DEFAULT_VOICE_ID, () => 0)
  : null;

const SENTENCE_RECOGNITION = {
  jp: "ラジオをつけてください。",
  answer: "Please turn on the radio.",
  options: [
    "Please turn on the radio.",
    "Please turn off the radio.",
    "Please buy a radio.",
    "The radio is broken.",
  ],
  correct: 0,
};

// ── the real halo (halo-preview.tsx) + option-grid + typed-box, lifted from
// drill-screen.tsx ──

interface McOption {
  readonly id: string;
  readonly label: string;
  readonly correct: boolean;
}

/** SAK-131: a thin wrapper over the shared `McOptionGrid` — the exact option
 * board drill-screen.tsx renders, no hand-copied markup of its own anymore.
 * Kept as `McGrid` so this page's call sites (and its `McOption` shape)
 * didn't all need to change. Passes `revealing` explicitly (required on
 * McOptionGrid, no default — see its own doc comment): every card on this
 * page is a static, already-revealed reference, never a real drill. */
function McGrid({ options }: { options: readonly McOption[] }) {
  return (
    <McOptionGrid
      revealing
      options={options.map(
        (o): McOptionGridItem => ({ key: o.id, label: o.label, correct: o.correct }),
      )}
    />
  );
}

/** SAK-131: a thin wrapper over the shared `TypedAnswerBox` — the exact
 * input drill-screen.tsx renders, read-only and pre-filled with the correct
 * answer since this is a reference sheet, not a real drill. */
function TypedBox({ answer }: { answer: string }) {
  return (
    <TypedAnswerBox value={answer} readOnly note="the correct answer, for reference" />
  );
}

/** Every option the real board would show — the pre-rolled `grammarSelection`
 * board when one rides the ctx (never recomputed; see the header comment),
 * else `distractors()` plus the fact itself. Direction-aware: en2jp's fallback
 * label is the fact's own GLYPH (the Japanese side), never its English
 * `answers[0]` — the bug that made every en2jp board read jp2en's cards
 * relabeled in English instead of the Japanese options en2jp actually asks for. */
function mcOptions(
  qt: QuestionType,
  fact: FactId,
  dir: Direction,
  ctx: PromptContext | undefined,
): McOption[] {
  const label = (id: FactId) =>
    qt.optionLabel?.(id, dir, ctx) ??
    (dir === "en2jp" ? factInfo(id)?.glyph : factInfo(id)?.answers[0]) ??
    factInfo(id)?.glyph ??
    factInfo(id)?.answers[0] ??
    String(id);
  if (ctx?.grammarSelection) {
    return ctx.grammarSelection.choices.map((id) => ({
      id: String(id),
      correct: id === fact,
      label: label(id),
    }));
  }
  const cap = qt.maxOptions ? qt.maxOptions - 1 : 3;
  const distractors = qt.distractors(fact, Math.max(cap, 0), ctx);
  return [fact, ...distractors].map((id) => ({
    id: String(id),
    correct: id === fact,
    label: label(id),
  }));
}

// ── generic card: any (fact, direction) the engine can already ask about ──

interface CardSpec {
  readonly label: string;
  readonly fact: FactId | null;
  readonly dir: Direction;
  readonly mode: "typed" | "mc";
  readonly ctx?: PromptContext;
  readonly audio?: boolean;
}

function QuizCard({ spec }: { spec: CardSpec }) {
  if (!spec.fact) return <Missing label={spec.label} />;
  const qt = questionsFor(spec.fact);
  const prompt = qt.prompt(spec.fact, spec.dir, spec.ctx);
  const reveal = revealFor(spec.fact, spec.dir, spec.ctx);
  const options = spec.mode === "mc" ? mcOptions(qt, spec.fact, spec.dir, spec.ctx) : null;
  const context = prompt.context ? (
    <span className="text-[13px] text-text">{prompt.context}</span>
  ) : undefined;

  return (
    <Card label={spec.label}>
      <div className="flex flex-col items-center gap-3">
        <Halo
          glyph={prompt.glyph}
          jp={prompt.jp}
          listen={spec.audio}
          sentenceFrame={spec.ctx?.grammarSelection?.frame}
          context={context}
        />
        {prompt.note ? <p className="max-w-[320px] text-center text-xs text-text-muted">{prompt.note}</p> : null}
        {options ? <McGrid options={options} /> : <TypedBox answer={reveal} />}
      </div>
    </Card>
  );
}

// ── the groups ──

interface Group {
  readonly title: string;
  readonly cards: readonly CardSpec[];
}

const GROUPS: readonly Group[] = [
  {
    title: "Kana",
    cards: [
      { label: "jp2en typed (kana → romaji)", fact: KANA_A, dir: "jp2en", mode: "typed" },
      { label: "jp2en typed, audio (hear → type romaji)", fact: KANA_A, dir: "jp2en", mode: "typed", audio: true },
      { label: "en2jp MC (romaji → pick kana)", fact: KANA_A, dir: "en2jp", mode: "mc" },
      { label: "en2jp MC, audio (hear → pick kana)", fact: KANA_A, dir: "en2jp", mode: "mc", audio: true },
    ],
  },
  {
    title: "Kanji meaning",
    cards: [
      { label: "jp2en typed", fact: KANJI_SEI_MEANING, dir: "jp2en", mode: "typed" },
      { label: "en2jp typed", fact: KANJI_SEI_MEANING, dir: "en2jp", mode: "typed" },
      { label: "en2jp MC", fact: KANJI_SEI_MEANING, dir: "en2jp", mode: "mc" },
      {
        label: "en2jp MC, component-variant recognition (亻 → 人)",
        fact: KANJI_HITO_MEANING,
        dir: "en2jp",
        mode: "mc",
        ctx: { variant: { glyph: "亻", original: "人" } },
      },
    ],
  },
  {
    title: "Kanji reading",
    cards: [
      { label: "jp2en typed (in-word context)", fact: KANJI_SEI_READING, dir: "jp2en", mode: "typed" },
      { label: "jp2en typed, audio", fact: KANJI_SEI_READING, dir: "jp2en", mode: "typed", audio: true },
    ],
  },
  {
    title: "Word meaning",
    cards: [
      { label: "jp2en typed", fact: WORD_SENSEI_MEANING, dir: "jp2en", mode: "typed" },
      { label: "jp2en MC", fact: WORD_SENSEI_MEANING, dir: "jp2en", mode: "mc" },
    ],
  },
  {
    title: "Word reading",
    cards: [
      { label: "jp2en typed", fact: WORD_SENSEI_READING, dir: "jp2en", mode: "typed" },
      { label: "jp2en typed, audio", fact: WORD_SENSEI_READING, dir: "jp2en", mode: "typed", audio: true },
      {
        label: "jp2en MC, audio (listening — options show written forms)",
        fact: WORD_SENSEI_READING,
        dir: "jp2en",
        mode: "mc",
        audio: true,
        ctx: { listen: true },
      },
    ],
  },
  {
    title: "Transitivity",
    cards: [
      { label: "jp2en MC (verb → pick English cue)", fact: TRANSITIVITY_HAPPENS, dir: "jp2en", mode: "mc" },
      { label: "en2jp typed (English cue → type verb)", fact: TRANSITIVITY_DOIT, dir: "en2jp", mode: "typed" },
      { label: "en2jp MC", fact: TRANSITIVITY_DOIT, dir: "en2jp", mode: "mc" },
    ],
  },
  {
    title: "Keigo",
    cards: [
      { label: "jp2en MC (keigo verb → pick meaning)", fact: KEIGO_EAT_FACT, dir: "jp2en", mode: "mc" },
      { label: "en2jp typed (production cue → type verb)", fact: KEIGO_EAT_FACT, dir: "en2jp", mode: "typed" },
      { label: "en2jp MC", fact: KEIGO_EAT_FACT, dir: "en2jp", mode: "mc" },
    ],
  },
  {
    title: "Radicals",
    cards: [
      { label: "jp2en typed", fact: RADICAL_KI_MEANING, dir: "jp2en", mode: "typed" },
      { label: "en2jp typed", fact: RADICAL_KI_MEANING, dir: "en2jp", mode: "typed" },
      { label: "en2jp MC", fact: RADICAL_KI_MEANING, dir: "en2jp", mode: "mc" },
    ],
  },
];

// Grammar's own four showings — production, fixed meaning, selection and the
// particle tap-drill — are one subject, one section, sub-headed by showing.
const GRAMMAR_PRODUCTION_CARDS: readonly CardSpec[] = [
  { label: "jp2en typed (build the pattern)", fact: GRAMMAR_TAI_PRODUCTION, dir: "jp2en", mode: "typed" },
  { label: "jp2en MC", fact: GRAMMAR_TAI_PRODUCTION, dir: "jp2en", mode: "mc" },
];
const GRAMMAR_FIXED_CARDS: readonly CardSpec[] = [
  { label: "jp2en MC (pattern → pick meaning)", fact: GRAMMAR_WA_MEANING, dir: "jp2en", mode: "mc" },
  { label: "en2jp MC (meaning → pick pattern)", fact: GRAMMAR_WA_MEANING, dir: "en2jp", mode: "mc" },
];
const GRAMMAR_SELECTION_CARDS: readonly CardSpec[] = GRAMMAR_TE_KARA_CTX
  ? [
      {
        label: "jp2en MC (blanked sentence + English → pick pattern)",
        fact: GRAMMAR_TE_KARA_FACT,
        dir: "jp2en",
        mode: "mc",
        ctx: GRAMMAR_TE_KARA_CTX,
      },
    ]
  : [];

export default function QuizGalleryDevPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Quiz gallery</h1>
      <p className="mt-1 text-sm text-text-muted">
        One example of every quiz question type the app can generate, grouped by
        subject. Every card reveals its own answer — reference only, never a real
        drill.
      </p>

      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="flex flex-wrap gap-4">
            {g.cards.map((c) => (
              <QuizCard key={c.label} spec={c} />
            ))}
          </div>
        </Section>
      ))}

      <Section title="Grammar">
        <Sub title="Production">
          <div className="flex flex-wrap gap-4">
            {GRAMMAR_PRODUCTION_CARDS.map((c) => (
              <QuizCard key={c.label} spec={c} />
            ))}
          </div>
        </Sub>
        <Sub title="Meaning — fixed (non-selectable pattern)">
          <div className="flex flex-wrap gap-4">
            {GRAMMAR_FIXED_CARDS.map((c) => (
              <QuizCard key={c.label} spec={c} />
            ))}
          </div>
        </Sub>
        <Sub title="Meaning — selection (corpus sentence, fill-the-blank)">
          <div className="flex flex-wrap gap-4">
            {GRAMMAR_SELECTION_CARDS.length > 0 ? (
              GRAMMAR_SELECTION_CARDS.map((c) => <QuizCard key={c.label} spec={c} />)
            ) : (
              <Missing label="no selectable te-kara example in the corpus right now" />
            )}
          </div>
        </Sub>
        <Sub title="Meaning — particle tap-drill (は/が/を)">
          <div className="flex flex-wrap gap-4">
            {PARTICLE_TAP_QUESTION ? (
              <Card label="tap the word this が marks">
                <ParticleTapPreview question={PARTICLE_TAP_QUESTION} />
              </Card>
            ) : (
              <Missing label="no が example available for the tap-drill" />
            )}
          </div>
        </Sub>
        <Sub title="Meaning — particle marker-choice (は/が/を)">
          <div className="flex flex-wrap gap-4">
            {PARTICLE_MARKER_QUESTION ? (
              <Card label="pick the particle that marks the highlighted word">
                <div className="flex flex-col items-center gap-3">
                  <Halo
                    glyph={PARTICLE_MARKER_QUESTION.jp}
                    jp
                    context={PARTICLE_MARKER_QUESTION.en}
                    body={
                      <ParticleMarkerSentence
                        jp={PARTICLE_MARKER_QUESTION.jp}
                        highlightSpan={PARTICLE_MARKER_QUESTION.highlightSpan}
                      />
                    }
                  />
                  <McGrid
                    options={PARTICLE_MARKER_QUESTION.options.map((o) => ({
                      id: o.recipeId,
                      label: o.label,
                      correct: o.recipeId === PARTICLE_MARKER_QUESTION.recipeId,
                    }))}
                  />
                </div>
              </Card>
            ) : (
              <Missing label="no が example available for the marker-choice board" />
            )}
          </div>
        </Sub>
      </Section>

      <Section title="Numbers / counters">
        <div className="flex flex-wrap gap-4">
          <NumberCard label="read typed (written form → type reading)" fact={NUMBER_FACT} item={NUMBER_READ} />
          <NumberCard label="write typed (reading → type digits)" fact={NUMBER_FACT} item={NUMBER_WRITE} />
          <NumberCard label="hear typed, audio (hear reading → type digits)" fact={NUMBER_FACT} item={NUMBER_HEAR} audio />
        </div>
      </Section>

      <Section title="Sentence recognition">
        <div className="flex flex-wrap gap-4">
          <Card label="audio MC (hear sentence → pick English meaning)">
            <div className="flex flex-col items-center gap-3">
              <Halo glyph={SENTENCE_RECOGNITION.jp} jp listen />
              <McGrid
                options={SENTENCE_RECOGNITION.options.map((o, i) => ({
                  id: o,
                  label: o,
                  correct: i === SENTENCE_RECOGNITION.correct,
                }))}
              />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Word pitch accent (SAK-128)">
        <p className="mb-3 text-xs text-text-muted">
          Not a track of its own (SAK-98) — an ADDITIONAL card queued right
          after a word&apos;s jp2en meaning card, every time it&apos;s shown,
          only for a word with verified pitch data, and only when Audio prompts
          is on.
        </p>
        <div className="flex flex-wrap gap-4">
          <Card label="pair mode (real homophone partner: 箸 vs 橋, both はし)">
            {PITCH_PAIR_SHOWING ? (
              <PitchPreview glyph="箸" showing={PITCH_PAIR_SHOWING} />
            ) : (
              <Missing label="no pair example available" />
            )}
          </Card>
          <Card label="wrong mode (no curriculum partner: real vs. synthetically mis-pitched お金)">
            {PITCH_WRONG_SHOWING ? (
              <PitchPreview glyph="お金" showing={PITCH_WRONG_SHOWING} />
            ) : (
              <Missing label="no wrong-mode example available" />
            )}
          </Card>
        </div>
      </Section>
    </main>
  );
}

function NumberCard({
  label,
  fact,
  item,
  audio,
}: {
  label: string;
  fact: FactId | null;
  item: NumberQuizItem | null;
  audio?: boolean;
}) {
  if (!fact || !item) return <Missing label={label} />;
  const qt = questionsFor(fact);
  const ctx: PromptContext = { numberItem: item };
  const prompt = qt.prompt(fact, "jp2en", ctx);
  const reveal = revealFor(fact, "jp2en", ctx);
  return (
    <Card label={label}>
      <div className="flex flex-col items-center gap-3">
        <Halo glyph={prompt.glyph} jp listen={audio} />
        <TypedBox answer={reveal} />
      </div>
    </Card>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[320px] rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-accent/80">
        {label}
      </div>
      {children}
    </div>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <div className="w-70 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-text-muted">
      {label} — no sample
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-border/60 pb-1.5 text-base font-medium text-text">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-[13px] font-medium text-text-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

