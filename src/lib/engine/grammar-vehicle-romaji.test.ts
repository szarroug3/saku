// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/grammar-vehicle-romaji.test.ts
//
// THE TEST WHOSE ABSENCE HID A P0.
//
// `grammarQuestions.check` has two paths. One grades against the vehicle baked
// into the fact; the other grades against the vehicle the SHOWING rolled, and
// fires only when `ctx.grammarVehicle` is set. The drill always sets it
// (drill-screen's nextQuestion, ungated), so the varied path is the ONLY path a
// learner ever reaches — and no test passed a ctx, so 1,034 green tests were all
// exercising the branch the app never takes. The varied path compared strings
// with `===`. `tabetekudasai` for たべてください graded WRONG.
//
// So every case below passes a ctx. That is not a detail of these tests, it is
// the entire point of them: a property test of the grader that omits the ctx is
// a property test of a different function.
//
// THE PROPERTY: for every producible recipe and every legal vehicle, the romaji
// spelling of the accepted kana form grades true. Plus its guard rail, which is
// not negotiable and is asserted just as widely: a kanji-bearing form is still
// exact-match only. Romaji cannot spell 食, so romaji must never be allowed to
// reach it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SETS } from "@/data/characters";
import { patternProductionFactId } from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { factInfo } from "@/lib/facts";
import { apply, hostOfClass } from "@/lib/grammar/apply";
import {
  ADJ_I_VEHICLES,
  ADJ_NA_VEHICLES,
  NOUN_VEHICLES,
  VERB_VEHICLES,
  transitivityAllows,
  type Vehicle,
} from "@/lib/grammar/vehicles";
import { isKanaOnly, toHiragana, toKana } from "@/lib/romaji";
import { questionsFor, type GrammarVehicle, type PromptContext } from "./question";
import type { Direction, FactId } from "@/types";

/**
 * hiragana → one romaji spelling, read off the SAME kana table `lib/romaji`
 * inverts to do the conversion, so a test spelling and a typeable spelling
 * cannot drift. One spelling per kana is enough; where a kana has several, any
 * of the ones that actually reaches it will do.
 */
const ROMAJI: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const set of SETS) {
    if (set.id !== "hiragana") continue;
    for (const section of set.sections) {
      for (const ch of section.chars) {
        // The spelling that ROUND-TRIPS, not merely the first one listed. ず and
        // づ both romanize "zu", and the converter resolves that collision
        // first-wins in favour of ず — so "zu" is not a way to type づ, and
        // "du" is, exactly as a real IME behaves. Asking the converter which
        // spelling actually reaches this kana keeps the test honest about what
        // a learner can type instead of asserting a spelling nobody can enter.
        const r = ch.r.find((x) => toKana(x) === ch.c);
        if (r) out[ch.c] = r;
      }
    }
  }
  out["ん"] = "n";
  return out;
})();

/** Romaji for a hiragana string. Returns null for anything the table cannot
 * spell (a long mark, a stray small kana) — those cases are skipped rather than
 * guessed at, because a wrong spelling would assert nothing. */
function romajiFor(kana: string): string | null {
  let out = "";
  const chars = [...kana];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    // A small ゃゅょ belongs to the syllable before it, so consume the pair.
    const next = chars[i + 1];
    const pair = next && "ゃゅょ".includes(next) ? c + next : null;
    if (pair) {
      const r = ROMAJI[pair];
      if (!r) return null;
      out += r;
      i++;
      continue;
    }
    if (c === "っ") {
      // Gemination doubles the next consonant, which is what toKana expects.
      const after = chars[i + 1] && ROMAJI[chars[i + 1]];
      if (!after) return null;
      out += after[0];
      continue;
    }
    const r = ROMAJI[c];
    if (!r) return null;
    out += r;
  }
  return out || null;
}

const VEHICLES: readonly Vehicle[] = [
  ...VERB_VEHICLES,
  ...ADJ_I_VEHICLES,
  ...ADJ_NA_VEHICLES,
  ...NOUN_VEHICLES,
];

interface Case {
  fact: FactId;
  ctx: PromptContext;
  form: string;
  kanaForm: string;
  label: string;
}

/**
 * Every (producible recipe × legal vehicle) pair, as a gradeable case.
 *
 * Legality is decided by the same three things the drill's own path uses — the
 * recipe applies to the vehicle, the production fact for the vehicle's HOST
 * exists, and the recipe accepts that KIND of verb — so a case here is a card
 * the drill can actually deal.
 *
 * The third one arrived later, and this file is where its absence showed. A
 * recipe can restrict its verbs (`transitivity` in recipes.ts) and 〜てある does:
 * it needs a verb somebody does to something, so 行ってある is not Japanese. The
 * builder had no notion of that, so it minted te-aru × 行く as a case and the
 * property below then asserted the ungrammatical answer graded TRUE. The
 * property is unchanged and still holds for every card the drill can deal; what
 * changed is that this is no longer one of them.
 */
const CASES: Case[] = (() => {
  const out: Case[] = [];
  for (const r of RECIPES) {
    if (!isProducible(r)) continue;
    for (const v of VEHICLES) {
      const host = v.cls === null ? "noun" : hostOfClass(v.cls);
      const fact = patternProductionFactId(r.id, host);
      if (!factInfo(fact)) continue;
      if (!transitivityAllows(r, v.surface)) continue;
      const surface = apply(r, v.surface, v.cls);
      if (!surface.ok || surface.value === v.surface) continue;
      const kana = apply(r, v.kana, v.cls);
      const gv: GrammarVehicle = { surface: v.surface, kana: v.kana, cls: v.cls };
      out.push({
        fact,
        ctx: { grammarVehicle: gv },
        form: surface.value,
        kanaForm: kana.ok ? kana.value : surface.value,
        label: `${r.id} on ${v.surface}`,
      });
    }
  }
  return out;
})();

const DIRS: Direction[] = ["jp2en", "en2jp"];

function check(c: Case, given: string, dir: Direction): boolean {
  return questionsFor(c.fact).check(c.fact, dir, given, c.ctx);
}

describe("a varied-vehicle production answer, graded with the ctx the drill sends", () => {
  test("there are cases at all, and plenty of them", () => {
    // A property test over an empty set passes and proves nothing. If the
    // recipe or vehicle data is ever re-cut this is the assertion that notices.
    assert.ok(CASES.length > 200, `only ${CASES.length} cases`);
  });

  test("the reported P0: tabetekudasai answers 〜てください on 食べる", () => {
    const c = CASES.find((x) => x.label === "te-request on 食べる");
    assert.ok(c, "the reproduction case must exist");
    assert.equal(c.form, "食べてください");
    assert.equal(c.kanaForm, "たべてください");
    for (const dir of DIRS) {
      assert.equal(check(c, "食べてください", dir), true, "kanji form");
      assert.equal(check(c, "たべてください", dir), true, "kana form");
      // The one that shipped false.
      assert.equal(check(c, "tabetekudasai", dir), true, "romaji spelling");
      // Katakana folds too, as it does everywhere else in the app.
      assert.equal(check(c, "タベテクダサイ", dir), true, "katakana");
    }
  });

  test("PROPERTY: the romaji spelling of the accepted kana form grades true", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of CASES) {
      if (!isKanaOnly(c.kanaForm)) continue;
      const romaji = romajiFor(toHiragana(c.kanaForm));
      if (!romaji) continue;
      checked++;
      for (const dir of DIRS) {
        if (!check(c, romaji, dir)) bad.push(`${c.label} ${dir}: ${romaji} for ${c.kanaForm}`);
      }
    }
    assert.ok(checked > 200, `only ${checked} spellable cases`);
    assert.deepEqual(bad, []);
  });

  test("PROPERTY: both written forms grade true, in both directions", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const dir of DIRS) {
        if (!check(c, c.form, dir)) bad.push(`${c.label} ${dir}: ${c.form}`);
        if (!check(c, c.kanaForm, dir)) bad.push(`${c.label} ${dir}: ${c.kanaForm}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("PROPERTY: a kanji-bearing form stays exact-match — romaji cannot reach it", () => {
    // The guard rail on the fix. `checkProduces` is unchanged and refuses a
    // romaji spelling of anything carrying a kanji; what makes the fix safe is
    // that the KANA form is the only one romaji is measured against. Where the
    // two forms differ (食べてください vs たべてください), a romanization of the
    // KANJI form's reading is still the kana form's spelling, so the only thing
    // left to assert is that latin junk that is not the reading never lands.
    const bad: string[] = [];
    for (const c of CASES) {
      if (isKanaOnly(c.form)) continue;
      for (const dir of DIRS) {
        if (check(c, "notthereading", dir)) bad.push(`${c.label} ${dir}: latin junk accepted`);
        // The vehicle's own dictionary form is not the answer to "build this
        // pattern on it", in any script.
        const v = c.ctx.grammarVehicle!;
        if (check(c, v.surface, dir)) bad.push(`${c.label} ${dir}: accepted the vehicle ${v.surface}`);
        if (check(c, v.kana, dir)) bad.push(`${c.label} ${dir}: accepted the vehicle kana ${v.kana}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("PROPERTY: the card never accepts the glyph it prompts with", () => {
    // The self-answering invariant, on the branch this change touches. The
    // prompt is the vehicle verb; the answer is that verb with the pattern on
    // it, and `builtOn` refuses a recipe that leaves the vehicle unchanged, so
    // the two can never coincide. Asserted rather than argued.
    const bad: string[] = [];
    for (const c of CASES) {
      for (const dir of DIRS) {
        const shown = questionsFor(c.fact).prompt(c.fact, dir, c.ctx).glyph;
        if (check(c, shown, dir)) bad.push(`${c.label} ${dir}: prompt ${shown} graded true`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("no vehicle in the ctx: the baked path, unchanged", () => {
    // The fix must not have moved the OTHER path. A production fact with no
    // ctx grades against its baked answers exactly as before.
    const fact = patternProductionFactId("te-request");
    const answers = factInfo(fact)?.answers ?? [];
    assert.deepEqual(answers.slice(0, 2), ["行ってください", "いってください"]);
    for (const a of answers) {
      assert.equal(questionsFor(fact).check(fact, "jp2en", a), true);
    }
    assert.equal(questionsFor(fact).check(fact, "jp2en", "ittekudasai"), true);
    assert.equal(questionsFor(fact).check(fact, "jp2en", "食べてください"), false);
  });
});
