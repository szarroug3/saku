// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/grammar-question.test.ts
//
// The LIVE seam for #50: the drill asks a grammar production fact through a
// QuestionType, threading a per-showing vehicle in the PromptContext. These
// tests drive that seam directly — prompt, check, distractors, option labels,
// reveal — because that is what the drill calls and what the fixed-vehicle bug
// lived in. The no-vehicle path must stay byte-for-byte the old behaviour.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { questionsFor, grammarVehicleFor, type GrammarVehicle } from "./question";
import { buildMcOptions, checkTyped } from "./index";
import { patternProductionFactId, GRAMMAR_SUBJECT } from "@/data/grammar";
import { factInfo } from "@/lib/facts";

const TE_KARA = patternProductionFactId("te-kara");
const TABERU: GrammarVehicle = { surface: "食べる", kana: "たべる", cls: "v1" };

describe("grammar production varies on the ctx vehicle (#50)", () => {
  test("prompt shows the SHOWING's verb, not the baked 行く", () => {
    const qt = questionsFor(TE_KARA);
    const fixed = qt.prompt(TE_KARA, "en2jp");
    assert.equal(fixed.glyph, "行く"); // unchanged when no vehicle is threaded
    const varied = qt.prompt(TE_KARA, "en2jp", { grammarVehicle: TABERU });
    assert.equal(varied.glyph, "食べる");
    assert.equal(varied.context, "〜てから form");
  });

  test("check grades against the vehicle it prompted on", () => {
    // With 食べる threaded, 食べてから is right and 行ってから is wrong — the exact
    // inversion of the old fixed-vehicle grading.
    const ctx = { grammarVehicle: TABERU };
    assert.ok(checkTyped(TE_KARA, "食べてから", "en2jp", ctx));
    assert.ok(checkTyped(TE_KARA, "たべてから", "en2jp", ctx)); // kana too
    assert.ok(!checkTyped(TE_KARA, "行ってから", "en2jp", ctx));
    // No vehicle: the baked answer still grades, unchanged.
    assert.ok(checkTyped(TE_KARA, "行ってから", "en2jp"));
  });

  test("option labels are the distractor patterns built on the SAME verb", () => {
    const ctx = { grammarVehicle: TABERU };
    const qt = questionsFor(TE_KARA);
    for (const opt of qt.distractors(TE_KARA, 5, ctx)) {
      const label = qt.optionLabel?.(opt, "en2jp", ctx);
      assert.ok(label, "a varied distractor has no label");
      // Every option reads as a form of 食べ… (built on 食べる), never 行…
      assert.ok(label.startsWith("食べ"), `${label} is not built on 食べる`);
    }
  });

  test("the reveal is the answer on the chosen verb", () => {
    const qt = questionsFor(TE_KARA);
    assert.equal(qt.answerReveal?.(TE_KARA, { grammarVehicle: TABERU }), "食べてから");
    // No vehicle → null, so the drill falls back to the baked answer.
    assert.equal(qt.answerReveal?.(TE_KARA, {}), null);
    assert.equal(factInfo(TE_KARA)?.answers[0], "行ってから");
  });

  test("MC board: distinct labels, exactly one correct, all on one verb", () => {
    const ctx = { grammarVehicle: TABERU };
    const opts = buildMcOptions(TE_KARA, ctx);
    assert.ok(opts.length > 1, "MC degenerated to one option");
    // Exactly one option is the asked fact (the correct one).
    assert.equal(opts.filter((o) => o === TE_KARA).length, 1);
    const qt = questionsFor(TE_KARA);
    const labels = opts.map((o) => qt.optionLabel?.(o, "en2jp", ctx));
    assert.ok(labels.every((l) => l && l.startsWith("食べ")), "an option escaped the vehicle");
    assert.equal(new Set(labels).size, labels.length, "two options read alike");
  });

  test("grammarVehicleFor rolls a plausible vehicle for a production fact, null otherwise", () => {
    const v = grammarVehicleFor(TE_KARA, () => 0.3);
    assert.ok(v && v.surface.length > 0 && v.cls);
    // A meaning fact is not a production fact — no vehicle.
    const meaning = factInfo(TE_KARA)?.subject;
    assert.equal(meaning, GRAMMAR_SUBJECT); // sanity: we asked a grammar fact
  });

  test("an illegal ctx vehicle collapses to the fixed baked behaviour", () => {
    // A noun can't take てから. Threading one must not break the item — it falls
    // back to 行く rather than emitting a bad form.
    const bad = { grammarVehicle: { surface: "本", kana: "ほん", cls: null } };
    const qt = questionsFor(TE_KARA);
    assert.equal(qt.prompt(TE_KARA, "en2jp", bad).glyph, "行く");
    assert.ok(checkTyped(TE_KARA, "行ってから", "en2jp", bad));
  });
});
