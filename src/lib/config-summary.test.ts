// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/config-summary.test.ts
//
// configSummary reads seven fields off the config (mode, dirs, styleJp2en,
// styleEn2jp, length, limType, limCount). We build a full QuizConfig here and
// override only those per case rather than importing defaultConfig from
// quiz-config.tsx — that module pulls in font-detect, which reaches for the DOM
// and cannot load under the node test harness. The base below mirrors
// defaultConfig's values for the fields under test; the rest are present only
// to satisfy the type and are never read.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { configSummary } from "@/lib/config-summary";
import type { QuizConfig } from "@/types";

const BASE: QuizConfig = {
  mode: "drill",
  dirs: { jp2en: true, en2jp: false },
  styleJp2en: "typed",
  styleEn2jp: "mc",
  length: "endless",
  limType: "cov",
  limCount: 50,
  retries: "lim",
  retryN: 2,
  timer: false,
  timerSec: 10,
  showAnswer: true,
  scriptLabel: true,
  fonts: [],
  blurSubmit: false,
  voiceName: "",
  listenRomaji: false,
  listenMeaning: false,
  accuracyMetric: "firstTry",
  showVolume: true,
  graduateRuns: 10,
  slowFloorMs: 1500,
  newKanjiOrder: "everyday",
  lessonMinCost: 0,
  lessonMaxCost: 0,
  wordsPerLesson: 5,
  restFirstMin: 5,
  restThenMin: 10,
  showStreak: true,
  showAccuracy: true,
  showRetryPips: true,
  fadeControls: true,
  selection: {} as QuizConfig["selection"],
};

function mk(over: Partial<QuizConfig>): QuizConfig {
  return { ...BASE, ...over };
}

describe("configSummary — direction", () => {
  test("both directions on collapses to 'Both directions'", () => {
    const s = configSummary(
      mk({ dirs: { jp2en: true, en2jp: true }, styleEn2jp: "typed" }),
    );
    assert.equal(s, "Both directions · Typed · Endless");
  });

  test("only jp2en names the JP → EN arrow", () => {
    const s = configSummary(mk({ dirs: { jp2en: true, en2jp: false } }));
    assert.equal(s, "Japanese → English · Typed · Endless");
  });

  test("only en2jp names the EN → JP arrow and reads its own style", () => {
    // en2jp defaults to mc, and with jp2en off that is the only style stated.
    const s = configSummary(mk({ dirs: { jp2en: false, en2jp: true } }));
    assert.equal(s, "English → Japanese · Multiple choice · Endless");
  });

  test("the invalid no-direction case degrades gracefully", () => {
    // The editor forbids this, but the summary must not blank out or drop a
    // separator. Style has no enabled direction to read, so it is omitted.
    const s = configSummary(mk({ dirs: { jp2en: false, en2jp: false } }));
    assert.equal(s, "No direction selected · Endless");
  });
});

describe("configSummary — answer style", () => {
  test("both directions typed is one word", () => {
    const s = configSummary(
      mk({
        dirs: { jp2en: true, en2jp: true },
        styleJp2en: "typed",
        styleEn2jp: "typed",
      }),
    );
    assert.equal(s, "Both directions · Typed · Endless");
  });

  test("both directions multiple choice is one word", () => {
    const s = configSummary(
      mk({
        dirs: { jp2en: true, en2jp: true },
        styleJp2en: "mc",
        styleEn2jp: "mc",
      }),
    );
    assert.equal(s, "Both directions · Multiple choice · Endless");
  });

  test("mixed styles across the two directions reads both", () => {
    const s = configSummary(
      mk({
        dirs: { jp2en: true, en2jp: true },
        styleJp2en: "typed",
        styleEn2jp: "mc",
      }),
    );
    assert.equal(s, "Both directions · Typed / multiple choice · Endless");
  });
});

describe("configSummary — length", () => {
  test("endless", () => {
    const s = configSummary(mk({ length: "endless" }));
    assert.equal(s, "Japanese → English · Typed · Endless");
  });

  test("limited by count reads the count", () => {
    const s = configSummary(
      mk({
        dirs: { jp2en: true, en2jp: false },
        styleJp2en: "mc",
        length: "limited",
        limType: "count",
        limCount: 50,
      }),
    );
    assert.equal(s, "Japanese → English · Multiple choice · Limited to 50");
  });

  test("limited by full coverage uses the editor's own name", () => {
    const s = configSummary(
      mk({ length: "limited", limType: "cov", limCount: 50 }),
    );
    assert.equal(s, "Japanese → English · Typed · Full coverage");
  });
});

describe("configSummary — mode", () => {
  test("drill, the default, adds no mode noun", () => {
    const s = configSummary(mk({ mode: "drill" }));
    assert.equal(s, "Japanese → English · Typed · Endless");
  });

  test("a non-drill mode leads with its name and still states the rest", () => {
    const s = configSummary(
      mk({
        mode: "grid",
        dirs: { jp2en: true, en2jp: true },
        styleEn2jp: "typed",
      }),
    );
    assert.equal(s, "Grid · Both directions · Typed · Endless");
  });

  test("match pairs is named", () => {
    const s = configSummary(mk({ mode: "pairs" }));
    assert.equal(s, "Match pairs · Japanese → English · Typed · Endless");
  });
});
