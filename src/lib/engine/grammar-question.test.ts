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
import {
  classProductionFactId,
  patternProductionFactId,
  specialVerbProductionFactId,
  GRAMMAR_SUBJECT,
} from "@/data/grammar";
import { factInfo } from "@/lib/facts";
import {
  ADJ_I_VEHICLES,
  ADJ_NA_VEHICLES,
  NOUN_VEHICLES,
  VERB_VEHICLES,
} from "@/lib/grammar/vehicles";
import { wordMeaningFactId } from "@/data/vocab";
import type { HistoryFile } from "@/types";

// A verb-only, unrestricted production fact as the generic #50 fixture. te-kara
// (and the whole 〜て family) now splits production by ENDING and carries no plain
// production fact — that per-ending seam is covered in te-endings.test.ts — so a
// non-te verb pattern (〜たい, baked on 行きたい) is the representative for the
// generic varied-vehicle machinery, which is host/legality-shaped, not te-shaped.
const TAI = classProductionFactId("tai", "v1");
const TAI_M = classProductionFactId("tai", "v5m");
const TABERU: GrammarVehicle = { surface: "食べる", kana: "たべる", cls: "v1", known: true };

const NOW = 1_700_000_000_000;

/** A learner who has CLAIMED these words and nothing else — the app's cheapest
 * route to "known" (see readable.ts's wordKnown, which reads the same claim). */
function knowing(...surfaces: string[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    claims: Object.fromEntries(surfaces.map((s) => [wordMeaningFactId(s), NOW])),
  };
}

/** A learner who knows the WHOLE vehicle pool, so `grammarVehicleFor` rolls
 * exactly as it did before the known-word gate existed — the fixture for every
 * test that is about host/legality, not about the gate itself. */
const ALL_VEHICLES: HistoryFile = knowing(
  ...[...VERB_VEHICLES, ...ADJ_I_VEHICLES, ...ADJ_NA_VEHICLES, ...NOUN_VEHICLES].map(
    (v) => v.surface,
  ),
);

describe("grammar production varies on the ctx vehicle (#50)", () => {
  test("prompt shows the SHOWING's verb, not the baked 行く", () => {
    const qt = questionsFor(TAI);
    const fixed = qt.prompt(TAI, "en2jp");
    assert.equal(fixed.glyph, "食べる");
    const varied = qt.prompt(TAI, "en2jp", { grammarVehicle: TABERU });
    assert.equal(varied.glyph, "食べる");
    // The form name is no longer a sub-label; it folds into the instruction
    // ("Type how this word is said in the 〜たい form."), so context is null.
    assert.equal(varied.context, null);
  });

  test("check grades against the vehicle it prompted on", () => {
    // With 食べる threaded, 食べたい is right and another class is wrong.
    const ctx = { grammarVehicle: TABERU };
    assert.ok(checkTyped(TAI, "食べたい", "en2jp", ctx));
    assert.ok(checkTyped(TAI, "たべたい", "en2jp", ctx)); // kana too
    assert.ok(!checkTyped(TAI, "行きたい", "en2jp", ctx));
    // No vehicle: the baked answer still grades, unchanged.
    assert.ok(checkTyped(TAI, "食べたい", "en2jp"));
  });

  test("option labels are the distractor patterns built on the SAME verb", () => {
    const ctx = { grammarVehicle: TABERU };
    const qt = questionsFor(TAI);
    for (const opt of qt.distractors(TAI, 5, ctx)) {
      const label = qt.optionLabel?.(opt, "en2jp", ctx);
      assert.ok(label, "a varied distractor has no label");
      // Every option reads as a form of 食べ… (built on 食べる), never 行…
      assert.ok(label.startsWith("食べ"), `${label} is not built on 食べる`);
    }
  });

  test("the reveal is the answer on the chosen verb, in BOTH scripts", () => {
    const qt = questionsFor(TAI);
    // Both are graded correct, so both are shown. A KNOWN vehicle led with kanji
    // (the script its prompt used), the kana in parentheses.
    assert.equal(
      qt.answerReveal?.(TAI, "en2jp", { grammarVehicle: TABERU }),
      "食べたい（たべたい）",
    );
    // No vehicle → null, so the drill falls back to the baked answer.
    assert.equal(qt.answerReveal?.(TAI, "en2jp", {}), null);
    assert.equal(factInfo(TAI)?.answers[0], "食べたい");
  });

  test("MC board: distinct labels, exactly one correct, all on one verb", () => {
    const ctx = { grammarVehicle: TABERU };
    const opts = buildMcOptions(TAI, "en2jp", ctx);
    assert.ok(opts.length > 1, "MC degenerated to one option");
    // Exactly one option is the asked fact (the correct one).
    assert.equal(opts.filter((o) => o === TAI).length, 1);
    const qt = questionsFor(TAI);
    const labels = opts.map((o) => qt.optionLabel?.(o, "en2jp", ctx));
    assert.ok(labels.every((l) => l && l.startsWith("食べ")), "an option escaped the vehicle");
    assert.equal(new Set(labels).size, labels.length, "two options read alike");
  });

  test("grammarVehicleFor rolls a plausible vehicle for a production fact, null otherwise", () => {
    const v = grammarVehicleFor(TAI, ALL_VEHICLES, () => 0.3);
    assert.ok(v && v.surface.length > 0 && v.cls);
    // A meaning fact is not a production fact — no vehicle.
    const meaning = factInfo(TAI)?.subject;
    assert.equal(meaning, GRAMMAR_SUBJECT); // sanity: we asked a grammar fact
  });

  test("an illegal ctx vehicle collapses to the fixed baked behaviour", () => {
    // A noun can't take 〜たい. Threading one must not break the item — it falls
    // back to the class anchor rather than emitting a bad form.
    const bad = { grammarVehicle: { surface: "本", kana: "ほん", cls: null, known: true } };
    const qt = questionsFor(TAI);
    assert.equal(qt.prompt(TAI, "en2jp", bad).glyph, "食べる");
    assert.ok(checkTyped(TAI, "食べたい", "en2jp", bad));
  });

  test("an UNKNOWN filler vehicle is shown and revealed in KANA, graded either script", () => {
    // 書く chosen as an unknown filler (known:false): the learner has not met the
    // kanji, so glyph, option labels and reveal are all drawn in kana — but the
    // grader still accepts BOTH scripts (the invariant: never mark correct
    // Japanese wrong). Legality/building still run on the real 書く surface.
    const KAKU_UNKNOWN = {
      grammarVehicle: { surface: "書く", kana: "かく", cls: "v5k", known: false },
    } as const;
    const fact = classProductionFactId("tai", "v5k");
    const qt = questionsFor(fact);
    // Prompt glyph is the kana reading, never the kanji surface.
    assert.equal(qt.prompt(fact, "en2jp", KAKU_UNKNOWN).glyph, "かく");
    // Reveal shows BOTH scripts (both are accepted). An unknown filler was drawn
    // in kana, so the kana form leads and the kanji rides in parentheses — the
    // learner sees what she typed AND the written form it maps to.
    assert.equal(qt.answerReveal?.(fact, "en2jp", KAKU_UNKNOWN), "かきたい（書きたい）");
    // Distractor option labels are all built on the kana reading of 書く: every
    // conjugation of かく starts with か and, crucially, carries NO kanji — the
    // learner has not met 書, so no option may show it.
    for (const opt of qt.distractors(fact, 5, KAKU_UNKNOWN)) {
      const label = qt.optionLabel?.(opt, "en2jp", KAKU_UNKNOWN);
      assert.ok(label, "an unknown-vehicle distractor has no label");
      assert.ok(label!.startsWith("か"), `${label} is not built on かく`);
      assert.ok(!/[一-鿿]/.test(label!), `${label} shows kanji for an unknown vehicle`);
    }
    // The grader accepts the kana answer AND the kanji answer — both are correct.
    assert.ok(checkTyped(fact, "かきたい", "en2jp", KAKU_UNKNOWN));
    assert.ok(checkTyped(fact, "書きたい", "en2jp", KAKU_UNKNOWN));
  });
});

describe("the te-form IRREGULARS never show a learner unlearned kanji", () => {
  // The regression Sam hit in te-form lesson 1. 行く / する / 来る are the te-form's
  // memorized exceptions, each its own production fact PINNED to exactly that verb
  // (@iku/@suru/@kuru). A day-one learner knows none of them, and the fact cannot
  // be asked on any other verb — so the "safe to guess" fallback pool is empty. It
  // used to return NO vehicle there, stranding the card on its baked KANJI lemma:
  // the prompt showed 行く and a miss revealed 行って, both in kanji never taught.
  // Now the pinned verb is dealt in KANA, with the kanji only alongside the reveal.
  const DAY_ONE = knowing(); // no claims, no showings — the first grammar lesson

  const CASES = [
    { q: "iku", kana: "いく", kanaAns: "いって", kanjiAns: "行って" },
    { q: "suru", kana: "する", kanaAns: "して", kanjiAns: "して" },
    { q: "kuru", kana: "くる", kanaAns: "きて", kanjiAns: "来て" },
  ] as const;

  for (const c of CASES) {
    test(`@${c.q}: kana prompt, kana-led reveal, both scripts graded`, () => {
      const fact = specialVerbProductionFactId("te-sequence", c.q);
      const v = grammarVehicleFor(fact, DAY_ONE, () => 0);
      assert.ok(v, `@${c.q} rolled no vehicle — the card falls back to kanji`);
      assert.equal(v!.known, false, "an unmet verb must be drawn as unknown (kana)");
      const ctx = { grammarVehicle: v! };
      const qt = questionsFor(fact);
      // The prompt is kana, never a kanji the learner has not met.
      const glyph = qt.prompt(fact, "en2jp", ctx).glyph;
      assert.equal(glyph, c.kana);
      assert.ok(
        !/[一-鿿]/.test(String(glyph)),
        `${String(glyph)} shows kanji on a day-one card`,
      );
      // A miss reveals kana first (what she types), the kanji in parentheses when
      // it differs — both are accepted, so both are shown.
      const expected =
        c.kanaAns === c.kanjiAns ? c.kanaAns : `${c.kanaAns}（${c.kanjiAns}）`;
      assert.equal(qt.answerReveal?.(fact, "en2jp", ctx), expected);
      // Grading accepts kana AND kanji — the invariant that neither script is
      // ever marked wrong.
      assert.ok(checkTyped(fact, c.kanaAns, "en2jp", ctx), "kana rejected");
      assert.ok(checkTyped(fact, c.kanjiAns, "en2jp", ctx), "kanji rejected");
    });
  }
});

describe("a split production fact is drilled on ITS OWN host", () => {
  const SUGIRU_V = classProductionFactId("sugiru", "v5k");
  const SUGIRU_I = patternProductionFactId("sugiru", "adj-i");
  const TAKAI: GrammarVehicle = { surface: "高い", kana: "たかい", cls: "adj-i", known: true };
  const IKU: GrammarVehicle = { surface: "行く", kana: "いく", cls: "v5k-s", known: true };

  test("the two facts are different ids with different baked answers", () => {
    // If these ever collapse to one id the split is undone and one score is
    // being kept for two rules — silently, because everything still renders.
    assert.notEqual(SUGIRU_V, SUGIRU_I);
    assert.equal(factInfo(SUGIRU_V)?.glyph, "書きすぎる");
    assert.equal(factInfo(SUGIRU_I)?.glyph, "高すぎる");
  });

  test("the verb class and adjective host use distinct qualified ids", () => {
    assert.equal(String(SUGIRU_V), "grammar:sugiru/production@v5k");
    assert.equal(String(SUGIRU_I), "grammar:sugiru/production@adj-i");
  });

  test("rolled vehicles never cross the host boundary, across the rng range", () => {
    for (const x of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      assert.equal(grammarVehicleFor(SUGIRU_I, ALL_VEHICLES, () => x)?.cls?.startsWith("adj"), true);
      assert.equal(grammarVehicleFor(SUGIRU_V, ALL_VEHICLES, () => x)?.cls?.startsWith("v"), true);
    }
  });

  test("a wrong-host ctx vehicle is refused like an illegal one", () => {
    // 行く builds 行きすぎる perfectly well — this is not about legality. It is
    // the OTHER fact's question, and answering it here would score the verb rule
    // under the adjective one. A stale ctx must collapse to the baked example.
    const qt = questionsFor(SUGIRU_I);
    assert.equal(qt.prompt(SUGIRU_I, "en2jp", { grammarVehicle: IKU }).glyph, "高い");
    assert.equal(qt.prompt(SUGIRU_I, "en2jp", { grammarVehicle: TAKAI }).glyph, "高い");
    assert.equal(qt.prompt(SUGIRU_V, "en2jp", { grammarVehicle: TAKAI }).glyph, "書く");
  });

  test("grading follows the same boundary", () => {
    assert.ok(checkTyped(SUGIRU_I, "高すぎる", "en2jp", { grammarVehicle: TAKAI }));
    // Wrong-host vehicle → the baked adj-i answer, not the verb one.
    assert.ok(checkTyped(SUGIRU_I, "高すぎる", "en2jp", { grammarVehicle: IKU }));
    assert.ok(!checkTyped(SUGIRU_I, "行きすぎる", "en2jp", { grammarVehicle: IKU }));
  });

  test("MC options for an adjective fact are all built on the adjective", () => {
    const ctx = { grammarVehicle: TAKAI };
    const opts = buildMcOptions(SUGIRU_I, "en2jp", ctx);
    assert.ok(opts.length > 1, "MC degenerated to one option");
    assert.equal(opts.filter((o) => o === SUGIRU_I).length, 1);
    const qt = questionsFor(SUGIRU_I);
    const labels = opts.map((o) => qt.optionLabel?.(o, "en2jp", ctx));
    assert.ok(labels.every((l) => l && l.startsWith("高")), `an option escaped the host: ${labels}`);
    assert.equal(new Set(labels).size, labels.length, "two options read alike");
  });

  test("a distractor is never a fact that does not exist", () => {
    // 〜ても builds 高くても fine but has NO adj-i production fact — the whole 〜て
    // family splits production by ENDING (verb only), so offering a 〜ても host
    // fact would put an unresolvable id on the board.
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
      assert.equal(grammarVehicleFor(node, ALL_VEHICLES, () => x)?.cls, "adj-na");
    }
  });
});

describe("grammarVehicleFor prefers known vehicles, fills with predictable unknowns", () => {
  const SUGIRU_I = patternProductionFactId("sugiru", "adj-i");

  test("a learner who knows one pool verb always rolls that verb, marked known", () => {
    // Knowing 読む and nothing else: every showing of 〜たい is on 読む, never a
    // verb she has not met. This is the whole point — a production item tests the
    // pattern, not whether she can conjugate an unknown word.
    const knows = knowing("読む");
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      const v = grammarVehicleFor(TAI_M, knows, () => x);
      assert.equal(v?.surface, "読む");
      assert.equal(v?.known, true);
    }
  });

  test("a CLAIM makes a word an eligible vehicle, exactly like a lesson", () => {
    // knowing() records claims, not tests — so this asserts the claim path.
    assert.equal(grammarVehicleFor(TAI, knowing("食べる"), () => 0)?.surface, "食べる");
  });

  test("knowing no pool word still rolls a vehicle — unknown, predictable, kana-shown", () => {
    // The BUG: this used to yield null and the production item was not asked.
    // Now it rolls an unknown vehicle of this fact's class, marked known:false
    // so every showing surface is drawn in kana and the instruction names it.
    const NOBODY: HistoryFile = { sessions: [], facts: {} };
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      const v = grammarVehicleFor(TAI, NOBODY, () => x);
      assert.ok(v, "should still roll a vehicle for a total beginner");
      assert.equal(v!.known, false);
      assert.equal(v!.cls, "v1");
    }
  });

  test("the host pin holds: a known verb still yields an ADJ vehicle for an adj fact", () => {
    // SUGIRU_I is the adj-i fact. Knowing only a verb leaves it with no known
    // adj vehicle, so it fills with an unknown adj (all adj hosts are
    // predictable) — an adj-i, never the verb, which would be the other fact's
    // question. Marked known:false → shown in kana.
    const onlyVerb = knowing("行く");
    const filled = grammarVehicleFor(SUGIRU_I, onlyVerb, () => 0.3);
    assert.ok(filled);
    assert.equal(filled!.cls?.startsWith("adj-i"), true);
    assert.equal(filled!.known, false);
    // And knowing the adjective rolls it as a KNOWN vehicle.
    const known = grammarVehicleFor(SUGIRU_I, knowing("高い"), () => 0.3);
    assert.equal(known?.surface, "高い");
    assert.equal(known?.known, true);
  });
});

describe("grammarVehicleFor is session-aware across DIFFERENT recipes (SAK-203 round 2)", () => {
  // The exact live report: "is およぐ / is in the state of およぐ" (〜ている) and
  // "please およぐ" (〜てください) in the SAME session — two DIFFERENT recipes'
  // v5g fact both independently rolling 泳ぐ, because each call to
  // grammarVehicleFor previously had zero visibility into what any other fact
  // had already picked. `usedVehicles` closes that: the caller (drill-screen's
  // presentCard) threads every surface picked so far in the session.
  const TEIRU_V5G = classProductionFactId("te-iru", "v5g");
  const TEREQUEST_V5G = classProductionFactId("te-request", "v5g");
  const knowsBoth = knowing("泳ぐ", "急ぐ");

  test("〜ている and 〜てください no longer both land on 泳ぐ once it's already used", () => {
    const first = grammarVehicleFor(TEIRU_V5G, knowsBoth, () => 0);
    assert.equal(first?.surface, "泳ぐ", "sanity: unaware pick is still the earliest-taught");
    const usedVehicles = new Set([first!.surface]);
    const second = grammarVehicleFor(TEREQUEST_V5G, knowsBoth, () => 0, usedVehicles);
    assert.equal(second?.surface, "急ぐ", "picked 泳ぐ again despite an unused pool alternative");
    assert.notEqual(second?.surface, first?.surface);
  });

  test("without usedVehicles threaded, the old bug reproduces (both roll 泳ぐ)", () => {
    // Proves the test above is not vacuous — the two facts really do draw
    // from the same pool with the same tie-break absent session-awareness.
    const a = grammarVehicleFor(TEIRU_V5G, knowsBoth, () => 0);
    const b = grammarVehicleFor(TEREQUEST_V5G, knowsBoth, () => 0);
    assert.equal(a?.surface, "泳ぐ");
    assert.equal(b?.surface, "泳ぐ");
  });

  test("行く-class irregulars still repeat across recipes — expected, not a regression", () => {
    // 行く is hard-coded to ONE vehicle per recipe wherever it's irregular
    // (mintSpecialWordFacts). No session-awareness can or should avoid this.
    const iku1 = specialVerbProductionFactId("te-iru", "iku");
    const iku2 = specialVerbProductionFactId("te-request", "iku");
    const knows = knowing("行く");
    const first = grammarVehicleFor(iku1, knows, () => 0);
    assert.equal(first?.surface, "行く");
    const second = grammarVehicleFor(iku2, knows, () => 0, new Set([first!.surface]));
    assert.equal(second?.surface, "行く", "an irregular has no other legal vehicle");
  });

  test("a THIRD recipe on the same used-up pool falls back to a repeat honestly", () => {
    // v5g now has two members. A third recipe's v5g fact, with both already
    // used elsewhere in the session, has nowhere left to go — repeating one
    // of them is the pool's real ceiling, not a bug.
    const third = classProductionFactId("te-permission", "v5g");
    const usedVehicles = new Set(["泳ぐ", "急ぐ"]);
    const v = grammarVehicleFor(third, knowsBoth, () => 0, usedVehicles);
    assert.ok(v && (v.surface === "泳ぐ" || v.surface === "急ぐ"), "v5g fact became unaskable");
  });

  test("an empty usedVehicles set behaves exactly like omitting the argument", () => {
    const withNone = grammarVehicleFor(TAI, ALL_VEHICLES, () => 0.3);
    const withEmpty = grammarVehicleFor(TAI, ALL_VEHICLES, () => 0.3, new Set());
    assert.equal(withEmpty?.surface, withNone?.surface);
  });
});
