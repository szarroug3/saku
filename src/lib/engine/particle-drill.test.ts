// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/particle-drill.test.ts
//
// Package 4 of docs/particle-teaching-workplan.md — pure logic for the "tap
// the marked word" drill: build a question from a ParticleDrillExample, grade
// a tap, and refuse rather than guess on bad span data. No React, no DOM —
// see components/quiz/particle-tap-card.tsx for the UI these facts drive.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildParticleDrillQuestion,
  buildParticleMarkerQuestion,
  gradeParticleDrillTap,
  gradeParticleMarkerChoice,
  particleDrillFor,
  particleMarkerFor,
  type ParticleDrillExample,
} from "./particle-drill";
import { PARTICLE_TAP_DRILL_IDS } from "@/lib/grammar/questions";
import { patternMeaningFactId, patternProductionFactId } from "@/data/grammar";

/** A pinned rng, so a failure names one sentence and one board order rather
 * than "sometimes". */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NEKO_GA: ParticleDrillExample = {
  id: -101,
  recipe: "ga",
  jp: "猫が好きです。",
  en: "I like cats.",
  markedWordSpan: [0, 1], // 猫
  particleSpan: [1, 2], // が
  distractorSpans: [[2, 4]], // 好き
};

const WATASHI_WA: ParticleDrillExample = {
  id: -102,
  recipe: "wa",
  jp: "私は学生です。",
  en: "I am a student.",
  markedWordSpan: [0, 1], // 私
  particleSpan: [1, 2], // は
  distractorSpans: [[2, 4]], // 学生
};

describe("buildParticleDrillQuestion", () => {
  test("cuts the sentence into chunks that reassemble it exactly", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    assert.equal(q.chunks.map((c) => c.text).join(""), NEKO_GA.jp);
  });

  test("the answer chunk is the marked word, not the particle", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const answer = q.chunks.find((c) => c.id === q.answerChunkId);
    assert.equal(answer?.text, "猫");
    assert.equal(answer?.role, "answer");
  });

  test("the particle chunk is never tappable", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const particle = q.chunks.find((c) => c.role === "particle");
    assert.equal(particle?.text, "が");
    assert.equal(particle?.tappable, false);
  });

  test("distractor chunks are tappable but never the answer", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const distractor = q.chunks.find((c) => c.role === "distractor");
    assert.equal(distractor?.text, "好き");
    assert.equal(distractor?.tappable, true);
    assert.notEqual(distractor?.id, q.answerChunkId);
  });

  test("the option board holds exactly the tappable chunks", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const tappableIds = q.chunks.filter((c) => c.tappable).map((c) => c.id);
    assert.deepEqual(new Set(q.optionChunkIds), new Set(tappableIds));
  });

  test("refuses a recipe outside は/が/を", () => {
    const q = buildParticleDrillQuestion({ ...NEKO_GA, recipe: "ni" }, seeded(1));
    assert.equal(q, null);
  });

  test("refuses zero distractors", () => {
    const q = buildParticleDrillQuestion({ ...NEKO_GA, distractorSpans: [] }, seeded(1));
    assert.equal(q, null);
  });

  test("refuses an out-of-bounds span", () => {
    const q = buildParticleDrillQuestion(
      { ...NEKO_GA, distractorSpans: [[2, 99]] },
      seeded(1),
    );
    assert.equal(q, null);
  });

  test("refuses overlapping spans", () => {
    // markedWordSpan [0,1) overlaps a distractor claiming [0,2)
    const q = buildParticleDrillQuestion(
      { ...NEKO_GA, distractorSpans: [[0, 2]] },
      seeded(1),
    );
    assert.equal(q, null);
  });

  test("caps distractors rather than dropping the item", () => {
    const many: ParticleDrillExample = {
      ...WATASHI_WA,
      jp: "私は学生です先生です医者です",
      distractorSpans: [
        [2, 4],
        [6, 8],
        [10, 12],
        [14, 16],
      ],
    };
    const q = buildParticleDrillQuestion(many, seeded(1));
    assert.ok(q);
    const distractorCount = q.chunks.filter((c) => c.role === "distractor").length;
    assert.ok(distractorCount <= 3, `expected at most 3 distractors, got ${distractorCount}`);
  });
});

describe("gradeParticleDrillTap", () => {
  test("tapping the marked word grades correct", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    assert.ok(gradeParticleDrillTap(q, q.answerChunkId));
  });

  test("tapping a distractor grades wrong", () => {
    const q = buildParticleDrillQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const distractor = q.chunks.find((c) => c.role === "distractor");
    assert.ok(distractor);
    assert.ok(!gradeParticleDrillTap(q, distractor.id));
  });
});

describe("particleDrillFor — the fact-level roll", () => {
  test("PARTICLE_TAP_DRILL_IDS is scoped to は/が/を", () => {
    assert.deepEqual([...PARTICLE_TAP_DRILL_IDS].sort(), ["ga", "wa", "wo"]);
  });

  test("rolls a showing for a scoped meaning fact", () => {
    const fact = patternMeaningFactId("ga");
    const q = particleDrillFor(fact, seeded(3));
    assert.ok(q, "wa/が/を have example sentences to draw from");
    assert.equal(q.recipeId, "ga");
  });

  test("refuses a meaning fact outside the allowlist", () => {
    const fact = patternMeaningFactId("ni");
    assert.equal(particleDrillFor(fact, seeded(3)), null);
  });

  test("refuses a non-meaning fact", () => {
    const fact = patternProductionFactId("te-kara");
    assert.equal(particleDrillFor(fact, seeded(3)), null);
  });
});

describe("buildParticleMarkerQuestion", () => {
  test("highlights the marked word and offers it as one of the options", () => {
    const q = buildParticleMarkerQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    assert.equal(q.recipeId, "ga");
    const [start, end] = q.highlightSpan;
    assert.equal(NEKO_GA.jp.slice(start, end), "猫");
    assert.ok(q.options.some((o) => o.recipeId === "ga"));
  });

  test("the board holds at most 4 options with no duplicate recipes", () => {
    const q = buildParticleMarkerQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    assert.ok(q.options.length <= 4);
    assert.equal(new Set(q.options.map((o) => o.recipeId)).size, q.options.length);
  });

  test("refuses an out-of-bounds highlight span", () => {
    const q = buildParticleMarkerQuestion({ ...NEKO_GA, markedWordSpan: [0, 99] }, seeded(1));
    assert.equal(q, null);
  });
});

describe("gradeParticleMarkerChoice", () => {
  test("choosing the sentence's own recipe grades correct", () => {
    const q = buildParticleMarkerQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    assert.ok(gradeParticleMarkerChoice(q, "ga"));
  });

  test("choosing any other recipe grades wrong", () => {
    const q = buildParticleMarkerQuestion(NEKO_GA, seeded(1));
    assert.ok(q);
    const distractor = q.options.find((o) => o.recipeId !== "ga");
    assert.ok(distractor);
    assert.ok(!gradeParticleMarkerChoice(q, distractor.recipeId));
  });
});

describe("particleMarkerFor — the fact-level roll", () => {
  test("rolls a showing for a scoped meaning fact", () => {
    const fact = patternMeaningFactId("ga");
    const q = particleMarkerFor(fact, seeded(3));
    assert.ok(q, "wa/が/を have example sentences to draw from");
    assert.equal(q.recipeId, "ga");
  });

  test("refuses a meaning fact outside the allowlist", () => {
    const fact = patternMeaningFactId("ni");
    assert.equal(particleMarkerFor(fact, seeded(3)), null);
  });

  test("refuses a non-meaning fact", () => {
    const fact = patternProductionFactId("te-kara");
    assert.equal(particleMarkerFor(fact, seeded(3)), null);
  });
});
