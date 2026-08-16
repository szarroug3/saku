// "Tap the marked word" — a grammar MEANING question for は/が/を that never
// blanks the sentence.
//
// Package 4 of docs/particle-teaching-workplan.md. Pure logic only — no React,
// no DOM. The UI lives in src/components/quiz/particle-tap-card.tsx.
//
// WHY THIS IS SAFE WHERE は/が CLOZE IS DEAD (see lib/grammar/questions.ts's
// header comment). A cloze item asks "which particle goes in this blank" —
// a judgement call that is often genuinely ambiguous for は/が (66% of
// minimal pairs share an identical English translation). This drill never
// blanks anything: the learner sees a COMPLETE, correct sentence and is
// asked to identify a FACT about it ("which word does this が mark") — one
// answer, always, because the sentence is already written and already
// correct. There is nothing to disambiguate.
//
// Scoped to は/が/を for this first pass — see PARTICLE_TAP_DRILL_IDS in
// lib/grammar/questions.ts, which is the allowlist this module reads.

import { grammarMeaning } from "@/data/grammar";
import { PARTICLE_TAP_DRILL_IDS } from "@/lib/grammar/questions";
import { recipe } from "@/data/grammar/recipes";
import type { FactId } from "@/types";

import { PARTICLE_DRILL_EXAMPLES } from "@/data/grammar/particle-drill-examples";
import type { ParticleDrillExample } from "@/data/grammar/particle-drill-examples";
export type { ParticleDrillExample } from "@/data/grammar/particle-drill-examples";

export type ParticleDrillChunkRole = "particle" | "answer" | "distractor" | "text";

/** One piece of the rendered sentence. Only `answer`/`distractor` chunks are
 * tappable; `particle` and `text` chunks are inert — plain sentence text, not
 * options. */
export interface ParticleDrillChunk {
  /** Stable within one question; not shared across questions. */
  readonly id: string;
  readonly text: string;
  readonly role: ParticleDrillChunkRole;
  readonly tappable: boolean;
}

export interface ParticleDrillQuestion {
  readonly recipeId: string;
  readonly jp: string;
  readonly en: string;
  /** The role question — "Which word is the subject?" for が. */
  readonly prompt: string;
  /** The whole sentence, left to right, as chunks. */
  readonly chunks: readonly ParticleDrillChunk[];
  readonly answerChunkId: string;
  /** The tappable board — answer + distractors, shuffled. Chunks still
   * render inline in sentence order; this is the grading/option surface. */
  readonly optionChunkIds: readonly string[];
}

/** What the drill asks for each particle. Scoped to は/が/を — see
 * PARTICLE_TAP_DRILL_IDS. */
const ROLE_PROMPTS: Readonly<Record<string, string>> = {
  wa: "Which word is the topic?",
  ga: "Which word is the subject?",
  wo: "Which word is the direct object?",
};

/** At most this many distractor chunks per board — a sentence with more than
 * a few tappable options stops reading as "tap the word" and starts reading
 * as a word-search. */
const MAX_DISTRACTORS = 3;

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a tap-drill question from an example, or refuse.
 *
 * Refuses rather than guesses: an out-of-bounds span, an overlap between the
 * particle/marked-word/distractor spans, or zero distractors all mean the
 * data is unsafe to render, and a bad item here is exactly the failure mode
 * this feature exists to avoid (see the header comment).
 */
export function buildParticleDrillQuestion(
  example: ParticleDrillExample,
  rng: () => number = Math.random,
): ParticleDrillQuestion | null {
  const promptText = ROLE_PROMPTS[example.recipe];
  if (!promptText) return null;
  if (example.distractorSpans.length < 1) return null;

  const spans: { start: number; end: number; role: ParticleDrillChunkRole }[] = [
    { start: example.particleSpan[0], end: example.particleSpan[1], role: "particle" },
    { start: example.markedWordSpan[0], end: example.markedWordSpan[1], role: "answer" },
    ...example.distractorSpans
      .slice(0, MAX_DISTRACTORS)
      .map((s) => ({ start: s[0], end: s[1], role: "distractor" as const })),
  ];

  for (const s of spans) {
    if (s.start < 0 || s.end > example.jp.length || s.start >= s.end) return null;
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) return null; // overlapping spans
  }

  const chunks: ParticleDrillChunk[] = [];
  let cursor = 0;
  let textSeq = 0;
  for (const s of spans) {
    if (s.start > cursor) {
      chunks.push({
        id: `text-${textSeq++}`,
        text: example.jp.slice(cursor, s.start),
        role: "text",
        tappable: false,
      });
    }
    chunks.push({
      id: `${s.role}-${s.start}-${s.end}`,
      text: example.jp.slice(s.start, s.end),
      role: s.role,
      tappable: s.role === "answer" || s.role === "distractor",
    });
    cursor = s.end;
  }
  if (cursor < example.jp.length) {
    chunks.push({
      id: `text-${textSeq++}`,
      text: example.jp.slice(cursor),
      role: "text",
      tappable: false,
    });
  }

  const answerChunk = chunks.find((c) => c.role === "answer");
  if (!answerChunk) return null;

  const optionChunkIds = shuffled(
    chunks.filter((c) => c.tappable).map((c) => c.id),
    rng,
  );

  return {
    recipeId: example.recipe,
    jp: example.jp,
    en: example.en,
    prompt: promptText,
    chunks,
    answerChunkId: answerChunk.id,
    optionChunkIds,
  };
}

/** Whether tapping `chunkId` answers the question correctly. */
export function gradeParticleDrillTap(
  question: ParticleDrillQuestion,
  tappedChunkId: string,
): boolean {
  return tappedChunkId === question.answerChunkId;
}

function examplesForRecipe(recipeId: string): readonly ParticleDrillExample[] {
  return PARTICLE_DRILL_EXAMPLES.filter((e) => e.recipe === recipeId);
}

/**
 * Roll a tap-drill showing for a grammar MEANING fact, as plain data — or
 * null. Mirrors `grammarSelectionFor`'s shape (engine/question.ts): null for
 * anything that is not a meaning fact, for a recipe outside
 * PARTICLE_TAP_DRILL_IDS, and for a recipe with no example to draw from.
 *
 * `rng` is injectable so a test can pin the sentence and the board order.
 */
export function particleDrillFor(
  fact: FactId,
  rng: () => number = Math.random,
): ParticleDrillQuestion | null {
  const mean = grammarMeaning(fact);
  if (!mean) return null;
  if (!PARTICLE_TAP_DRILL_IDS.has(mean.recipe.id)) return null;
  const candidates = examplesForRecipe(mean.recipe.id);
  if (candidates.length === 0) return null;
  const example = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
  return buildParticleDrillQuestion(example, rng);
}

// ---------------------------------------------------------------------------
// SECOND FORM — "which particle marks this word?"
//
// The tap-drill shows the particle and asks which word it marks; this is the
// same fact asked the other way round: the marked word is highlighted (dim
// the rest, light the target — the exact kanji-in-word treatment, just over a
// word in a sentence instead of a character in a word), and the learner picks
// which particle marks it from a small board of candidates.
//
// Safe for the identical reason the tap-drill is: the sentence on screen is
// COMPLETE and already correct. The question is "what IS here", a fact about
// this exact sentence, never "what average speaker would write here" — so a
// distractor being grammatically plausible in some OTHER sentence is beside
// the point; in THIS one it is simply not what is written, and that is what
// gets graded. This is why it can reuse the whole particle pool as
// distractors (は against が, unlike selection.ts's PARTICLE_ALLOWLIST, which
// exists to guard a DIFFERENT, blank-filling question this one never asks).
// ---------------------------------------------------------------------------

/** One particle on the board — its recipe id (for grading) and display text
 * (its pattern, 〜は). */
export interface ParticleMarkerOption {
  readonly recipeId: string;
  readonly label: string;
}

export interface ParticleMarkerQuestion {
  readonly recipeId: string;
  readonly jp: string;
  readonly en: string;
  /** The word being asked about — [start, end) into `jp`. Highlighted; the
   * rest of the sentence dims around it. */
  readonly highlightSpan: readonly [number, number];
  /** The board, already shuffled — the answer and up to 3 distractors. */
  readonly options: readonly ParticleMarkerOption[];
}

/** Every particle recipe with drill examples to draw from — the distractor
 * pool for the marker board. Computed from the data, not hand-listed, so a
 * particle only ever appears as a distractor once it has its own example. */
const PARTICLE_RECIPE_IDS: readonly string[] = [
  ...new Set(PARTICLE_DRILL_EXAMPLES.map((e) => e.recipe)),
];

function particleLabel(recipeId: string): string {
  return recipe(recipeId)?.pattern ?? recipeId;
}

/** At most this many options — matches MAX_DISTRACTORS + 1 answer, the same
 * board size the tap-drill caps its chunks at. */
const MAX_MARKER_OPTIONS = 4;

/** Build a marker-choice question from an example, or refuse — an
 * out-of-bounds highlight span, or too small a distractor pool, both mean the
 * data or the table is not ready to pose this safely. */
export function buildParticleMarkerQuestion(
  example: ParticleDrillExample,
  rng: () => number = Math.random,
): ParticleMarkerQuestion | null {
  const [start, end] = example.markedWordSpan;
  if (start < 0 || end > example.jp.length || start >= end) return null;
  const pool = PARTICLE_RECIPE_IDS.filter((id) => id !== example.recipe);
  if (pool.length === 0) return null;
  const distractorIds = shuffled(pool, rng).slice(0, MAX_MARKER_OPTIONS - 1);
  const options = shuffled(
    [example.recipe, ...distractorIds].map((id) => ({
      recipeId: id,
      label: particleLabel(id),
    })),
    rng,
  );
  return {
    recipeId: example.recipe,
    jp: example.jp,
    en: example.en,
    highlightSpan: example.markedWordSpan,
    options,
  };
}

/** Whether choosing `recipeId` answers the question correctly. */
export function gradeParticleMarkerChoice(
  question: ParticleMarkerQuestion,
  recipeId: string,
): boolean {
  return recipeId === question.recipeId;
}

/**
 * Roll a marker-choice showing for a grammar MEANING fact, as plain data — or
 * null. Same scope and data source as `particleDrillFor`; the caller decides
 * which of the two FORMS to ask (see drill-screen.tsx) — this only builds one
 * when asked to.
 */
export function particleMarkerFor(
  fact: FactId,
  rng: () => number = Math.random,
): ParticleMarkerQuestion | null {
  const mean = grammarMeaning(fact);
  if (!mean) return null;
  if (!PARTICLE_TAP_DRILL_IDS.has(mean.recipe.id)) return null;
  const candidates = examplesForRecipe(mean.recipe.id);
  if (candidates.length === 0) return null;
  const example = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
  return buildParticleMarkerQuestion(example, rng);
}
