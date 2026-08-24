// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/prompt-not-answer.test.ts
//
// THE INVARIANT: what a card SHOWS you is never what it ACCEPTS from you.
//
// A question whose prompt grades as its own answer is not a hard question or an
// easy one — it is not a question. The learner reads the prompt, types or picks
// it back, and the card records a correct answer having tested nothing. This
// held for all 214 kana in en2jp (the prompt is the romaji, and the grader
// forgave a romaji spelling of an all-kana target), which is the entire first
// phase of the app.
//
// So the invariant is asserted over EVERY fact in BOTH directions, not over the
// kana that happened to break it. It is a property of the question model, and
// the only way it stays true of the next subject is if the next subject has to
// pass it too.
//
// Two residual classes do not hold it yet. They are pinned below rather than
// filtered away silently: they are real, they are a different shape from the
// kana one, and fixing them is not this change. A pin is a debt with a name on
// it; a filter is a debt nobody finds again.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GRAMMAR_SUBJECT } from "../../data/grammar/index.ts";
import { KANA_SUBJECT } from "../../data/characters.ts";
import { KANJI_SUBJECT } from "../../data/kanji.ts";
import {
  VOCAB_SUBJECT,
  readingUnits,
  vocabRow,
  wordUnitMeaningFactId,
  wordUnitReadingFactId,
} from "../../data/vocab.ts";
import { ALL_FACTS, factInfo } from "../facts.ts";
import { questionsFor } from "./question.ts";
import type { Direction, FactId } from "@/types";

const DIRS: Direction[] = ["jp2en", "en2jp"];

interface Violation {
  fact: FactId;
  dir: Direction;
  subject: string;
  shown: string;
}

/**
 * Every (fact, direction) whose own prompt text grades as a correct answer.
 *
 * Asked through the public seam the drill uses — `prompt` then `check` on the
 * same QuestionType — so it cannot pass by testing a helper the drill does not
 * call. Facts that show no text (nothing to retype) are skipped; there is no
 * claim to make about them.
 *
 * Computed once: it walks ~21.7k facts twice and every test below is a question
 * about the same list.
 */
const VIOLATIONS: Violation[] = (() => {
  const out: Violation[] = [];
  for (const fact of ALL_FACTS) {
    const qt = questionsFor(fact);
    for (const dir of DIRS) {
      const shown = qt.prompt(fact, dir).glyph;
      if (!shown.trim()) continue;
      if (qt.check(fact, dir, shown)) {
        out.push({
          fact,
          dir,
          subject: factInfo(fact)?.subject ?? "?",
          shown,
        });
      }
    }
  }
  return out;
})();

function inSubject(subject: string): Violation[] {
  return VIOLATIONS.filter((v) => v.subject === subject);
}

describe("a card never accepts its own prompt", () => {
  test("kana holds it in both directions — this is the P0", () => {
    // The regression this file exists for. Zero, not "fewer": every one of the
    // 214 kana used to fail this in en2jp.
    assert.deepEqual(
      inSubject(KANA_SUBJECT).map((v) => `${v.fact} ${v.dir} shows ${v.shown}`),
      [],
    );
  });

  test("kanji holds it in both directions", () => {
    assert.deepEqual(inSubject(KANJI_SUBJECT), []);
  });

  test("nothing at all violates it in jp2en", () => {
    // jp2en shows Japanese and wants English or a reading, so the prompt and the
    // answer are in different scripts and the invariant is structural there.
    // Worth pinning anyway: it is the direction this change deliberately did not
    // touch, and "did not touch" is a claim a test should carry.
    assert.deepEqual(
      VIOLATIONS.filter((v) => v.dir === "jp2en"),
      [],
    );
  });
});

describe("the two shapes that do NOT hold it yet", () => {
  // Neither is the kana bug and neither is fixed here. Both are pinned by exact
  // count so they cannot quietly grow, and named so the next reader knows what
  // they are looking at.

  test("every remaining violation is a word or a grammar pattern, asked en2jp", () => {
    const unexplained = VIOLATIONS.filter(
      (v) =>
        v.dir !== "en2jp" ||
        (v.subject !== VOCAB_SUBJECT && v.subject !== GRAMMAR_SUBJECT),
    );
    assert.deepEqual(
      unexplained.map((v) => `${v.subject} ${v.fact} ${v.dir}`),
      [],
      "a NEW shape of self-answering card appeared — investigate, do not re-pin",
    );
  });

  test("loanwords whose English gloss is their own romanization", () => {
    // 寿司 asked en2jp prompts "sushi" and the answer is すし, which "sushi"
    // romaji-matches. The gloss IS the romanization, so the romaji forgiveness
    // that makes これ answerable "kore" with no IME hands these away.
    //
    // Unlike kana this is a DATA coincidence, not a structural one: it is the
    // borrowed vocabulary, not the subject. It needs a decision about borrowed
    // glosses, not a grader change, so it is pinned and left.
    assert.equal(inSubject(VOCAB_SUBJECT).length, 68);
  });

  test("grammar meaning cards accept the English gloss they prompt with", () => {
    // en2jp on a grammar meaning fact prompts the gloss ("after doing X") and
    // asks for the pattern, but grammarQuestions.check falls through to
    // `accepts`, which matches the fact's baked answers — the gloss. Structural,
    // like the kana one, and the same fix shape would serve it.
    // The full grammar recipe table, including the standalone adjective noun
    // form and the five core particles は/が/に/で/か, carries one meaning card
    // per recipe. 114 = 106 + SAK-174's eight new bare copula/particle rows
    // (da, desu, to-and, mo, ne, yo, tte, ga-nai).
    assert.equal(inSubject(GRAMMAR_SUBJECT).length, 114);
  });
});

describe("a multi-reading word's cards show the other axis, and grade neither of it", () => {
  // The per-unit word model gives a word more than one card, and the QUALIFIED
  // non-primary units (word:日/reading@にち) are the new shape the VIOLATIONS walk
  // above only reaches in bulk. Pinned here on a concrete multi-reading word so
  // the invariant is spelled out for the shape, not just aggregated over 21.7k
  // facts: each card shows the glyph and, as CONTEXT, the OTHER half of the unit,
  // and the grader accepts neither the glyph nor that context — only the answer.
  //
  // 日 has two reading-units, ひ (day) and にち (Sunday); にち is the non-primary,
  // qualified one. Derived from the row so the case survives the glosses moving.
  const KEB = "日";
  const units = readingUnits(vocabRow(KEB)!);
  const nonPrimary = units[1]; // にち — qualified, the new-shape unit
  const readingFact = wordUnitReadingFactId(KEB, nonPrimary.reb);
  const meaningFact = wordUnitMeaningFactId(KEB, nonPrimary.reb);

  test("the word really has a qualified second reading-unit to test", () => {
    assert.ok(units.length >= 2, `${KEB} is no longer multi-reading — pick another`);
    assert.ok(nonPrimary.reb !== units[0].reb, "the second unit repeats the primary");
  });

  test("the reading card shows the definition as context, and grades only the reading", () => {
    // Reading card (day → ひ shape): glyph + the union of glosses read this way,
    // asking for the kana. The context is the DEFINITION, not the reading, so
    // showing it cannot leak the answer.
    const q = questionsFor(readingFact);
    const p = q.prompt(readingFact, "jp2en");
    assert.equal(p.glyph, KEB, "the reading card shows the written word");
    assert.equal(
      p.context,
      nonPrimary.glosses.join(", "),
      "the reading card's context is the definition it is read as",
    );
    assert.ok(p.context !== nonPrimary.reb, "context must not BE the reading answer");
    // Neither what it shows grades as what it wants.
    assert.ok(!q.check(readingFact, "jp2en", p.glyph), "the glyph must not grade");
    assert.ok(!q.check(readingFact, "jp2en", p.context ?? ""), "the context must not grade");
    // And the real answer still does, so this is a live card and not a broken one.
    assert.ok(q.check(readingFact, "jp2en", nonPrimary.reb), "the reading must grade");
  });

  test("the meaning card shows the reading as context, and grades only the meaning", () => {
    // Meaning card (ひ → day shape): glyph + the reading kana, asking for the
    // gloss. The context is the READING, not the meaning.
    const q = questionsFor(meaningFact);
    const p = q.prompt(meaningFact, "jp2en");
    assert.equal(p.glyph, KEB, "the meaning card shows the written word");
    assert.equal(p.context, nonPrimary.reb, "the meaning card's context is the reading");
    assert.ok(!q.check(meaningFact, "jp2en", p.glyph), "the glyph must not grade");
    assert.ok(!q.check(meaningFact, "jp2en", p.context ?? ""), "the reading must not grade");
    assert.ok(
      q.check(meaningFact, "jp2en", nonPrimary.glosses[0]),
      "the meaning must grade",
    );
  });
});
