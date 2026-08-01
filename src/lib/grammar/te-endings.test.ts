// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/te-endings.test.ts
//
// The て-form has one fact per conjugation class, even where several classes
// share the same surface ending. Remembering む → んで does not score ぬ → んで.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TE_FORM_RECIPE_ID,
  classProductionFactId,
  grammarProduction,
  patternMeaningFactId,
  patternProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { factInfo } from "@/lib/facts";
import { buildCoverageDeck } from "@/lib/ask-forms";
import { grammarVehicleFor, questionsFor } from "@/lib/engine/question";
import { CLASS_ANCHOR } from "./te-endings";
import type { AskConfig, FactId, HistoryFile } from "@/types";

const EMPTY: HistoryFile = { sessions: [], facts: {}, claims: {} };
const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
  english: { answers: ["typed", "mc"] },
};

const EXPECTED: Record<string, string> = {
  v5u: "買って",
  v5t: "待って",
  v5r: "帰って",
  v5m: "飲んで",
  v5b: "遊んで",
  v5n: "死んで",
  v5k: "書いて",
  v5g: "泳いで",
  v5s: "話して",
  v1: "食べて",
};

describe("the ten regular te-form class facts", () => {
  test("each fact is baked on its class anchor and remains independently addressable", () => {
    for (const anchor of CLASS_ANCHOR) {
      const id = classProductionFactId(TE_FORM_RECIPE_ID, anchor.cls);
      assert.equal(factInfo(id)?.glyph, EXPECTED[anchor.cls], anchor.cls);
      const production = grammarProduction(id);
      assert.equal(production?.lemma, anchor.surface);
      assert.deepEqual(production?.bucket, { kind: "class", cls: anchor.cls });
    }
    assert.notEqual(
      classProductionFactId(TE_FORM_RECIPE_ID, "v5m"),
      classProductionFactId(TE_FORM_RECIPE_ID, "v5n"),
    );
  });

  test("each fact rolls a vehicle of exactly its own class", () => {
    for (const anchor of CLASS_ANCHOR) {
      const vehicle = grammarVehicleFor(
        classProductionFactId(TE_FORM_RECIPE_ID, anchor.cls),
        EMPTY,
        () => 0,
      );
      assert.ok(vehicle, anchor.cls);
      assert.equal(vehicle.cls, anchor.cls);
      assert.equal(vehicle.known, false);
    }
  });

  test("grading accepts the built form in kanji and kana", () => {
    const id = classProductionFactId(TE_FORM_RECIPE_ID, "v5u");
    const qt = questionsFor(id);
    const ctx = {
      grammarVehicle: { surface: "買う", kana: "かう", cls: "v5u" as const, known: true },
    };
    assert.equal(qt.check(id, "jp2en", "買って", ctx), true);
    assert.equal(qt.check(id, "jp2en", "かって", ctx), true);
    assert.equal(qt.check(id, "jp2en", "待って", ctx), false);
  });
});

describe("the te-form lesson covers every production skill", () => {
  const lesson = CURRICULUM_LESSONS.find((l) => l.primaryPattern === TE_FORM_RECIPE_ID)!;
  const expected = new Set<FactId>([
    patternMeaningFactId(TE_FORM_RECIPE_ID),
    ...CLASS_ANCHOR.map((a) => classProductionFactId(TE_FORM_RECIPE_ID, a.cls)),
    ...["iku", "suru", "kuru"].map((q) => specialVerbProductionFactId(TE_FORM_RECIPE_ID, q)),
    patternProductionFactId(TE_FORM_RECIPE_ID, "adj-i"),
    patternProductionFactId(TE_FORM_RECIPE_ID, "adj-na"),
    specialVerbProductionFactId(TE_FORM_RECIPE_ID, "ii"),
  ]);

  test("its drills are definition, ten classes, three irregular verbs, and three adjectives", () => {
    assert.equal(lesson.drills.length, 17);
    assert.deepEqual(new Set(lesson.drills), expected);
  });

  test("the real coverage deck preserves all sixteen production facts", () => {
    const { deck } = buildCoverageDeck(lesson.drills, ALL);
    const production = new Set(deck.filter((f) => grammarProduction(f)));
    assert.equal(production.size, 16);
    for (const id of expected) {
      if (id !== patternMeaningFactId(TE_FORM_RECIPE_ID)) assert.ok(production.has(id), id);
    }
  });
});
