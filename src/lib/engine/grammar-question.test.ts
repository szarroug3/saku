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

describe("a split production fact is drilled on ITS OWN host", () => {
  const SUGIRU_V = patternProductionFactId("sugiru");
  const SUGIRU_I = patternProductionFactId("sugiru", "adj-i");
  const TAKAI: GrammarVehicle = { surface: "高い", kana: "たかい", cls: "adj-i" };
  const IKU: GrammarVehicle = { surface: "行く", kana: "いく", cls: "v5k-s" };

  test("the two facts are different ids with different baked answers", () => {
    // If these ever collapse to one id the split is undone and one score is
    // being kept for two rules — silently, because everything still renders.
    assert.notEqual(SUGIRU_V, SUGIRU_I);
    assert.equal(factInfo(SUGIRU_V)?.glyph, "行きすぎる");
    assert.equal(factInfo(SUGIRU_I)?.glyph, "高すぎる");
  });

  test("the verb fact keeps the UNQUALIFIED id — the one history already holds", () => {
    // The whole reason the primary host is unqualified. A user's existing
    // `grammar:sugiru/production` record has answers behind it that were given
    // on 行く, and it must go on meaning that.
    assert.equal(String(SUGIRU_V), "grammar:sugiru/production");
    assert.equal(String(SUGIRU_I), "grammar:sugiru/production@adj-i");
  });

  test("rolled vehicles never cross the host boundary, across the rng range", () => {
    for (const x of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      assert.equal(grammarVehicleFor(SUGIRU_I, () => x)?.cls?.startsWith("adj"), true);
      assert.equal(grammarVehicleFor(SUGIRU_V, () => x)?.cls?.startsWith("v"), true);
    }
  });

  test("a wrong-host ctx vehicle is refused like an illegal one", () => {
    // 行く builds 行きすぎる perfectly well — this is not about legality. It is
    // the OTHER fact's question, and answering it here would score the verb rule
    // under the adjective one. A stale ctx must collapse to the baked example.
    const qt = questionsFor(SUGIRU_I);
    assert.equal(qt.prompt(SUGIRU_I, "en2jp", { grammarVehicle: IKU }).glyph, "高い");
    assert.equal(qt.prompt(SUGIRU_I, "en2jp", { grammarVehicle: TAKAI }).glyph, "高い");
    assert.equal(qt.prompt(SUGIRU_V, "en2jp", { grammarVehicle: TAKAI }).glyph, "行く");
  });

  test("grading follows the same boundary", () => {
    assert.ok(checkTyped(SUGIRU_I, "高すぎる", "en2jp", { grammarVehicle: TAKAI }));
    // Wrong-host vehicle → the baked adj-i answer, not the verb one.
    assert.ok(checkTyped(SUGIRU_I, "高すぎる", "en2jp", { grammarVehicle: IKU }));
    assert.ok(!checkTyped(SUGIRU_I, "行きすぎる", "en2jp", { grammarVehicle: IKU }));
  });

  test("MC options for an adjective fact are all built on the adjective", () => {
    const ctx = { grammarVehicle: TAKAI };
    const opts = buildMcOptions(SUGIRU_I, ctx);
    assert.ok(opts.length > 1, "MC degenerated to one option");
    assert.equal(opts.filter((o) => o === SUGIRU_I).length, 1);
    const qt = questionsFor(SUGIRU_I);
    const labels = opts.map((o) => qt.optionLabel?.(o, "en2jp", ctx));
    assert.ok(labels.every((l) => l && l.startsWith("高")), `an option escaped the host: ${labels}`);
    assert.equal(new Set(labels).size, labels.length, "two options read alike");
  });

  test("a distractor is never a fact that does not exist", () => {
    // 〜ても builds 高くても fine but has NO adj-i production fact (it defers to
    // te-cause), so offering it would put an unresolvable id on the board.
    const qt = questionsFor(SUGIRU_I);
    for (const d of qt.distractors(SUGIRU_I, 6, { grammarVehicle: TAKAI })) {
      assert.ok(factInfo(d), `${d} is on the board and resolves to nothing`);
    }
  });

  test("〜ので is drilled on 静か now, not on 行く", () => {
    // The standalone bug, at the seam the user actually meets.
    const node = patternProductionFactId("node");
    assert.equal(factInfo(node)?.glyph, "静かなので");
    assert.equal(questionsFor(node).prompt(node, "en2jp").glyph, "静か");
    for (const x of [0, 0.3, 0.6, 0.9]) {
      assert.equal(grammarVehicleFor(node, () => x)?.cls, "adj-na");
    }
  });
});
