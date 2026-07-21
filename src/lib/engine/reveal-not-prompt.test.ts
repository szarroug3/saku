// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/reveal-not-prompt.test.ts
//
// THE INVARIANT: the answer a missed card REVEALS is never the prompt it SHOWED.
//
// Sibling to prompt-not-answer.test.ts, and deliberately a separate file. That
// one pins the GRADING side — a card must not accept its own prompt back. This
// one pins the TELLING side — a card must not print its own prompt back. They
// are the same sentence about two different seams (`check` vs `revealFor`) and
// they failed independently: kana en2jp was fixed for grading in task 19 and was
// still revealing "a = a" afterwards.
//
// The bug this file exists for: the drill composed its reveal as
//
//     questionsFor(f).answerReveal?.(f, dir, ctx) ?? factInfo(f)?.answers[0]
//
// and only grammar implemented `answerReveal`. The other four subjects fell
// through to `answers[0]`, which in en2jp is the English/romaji face — the
// prompt. あ revealed "a = a", 生 revealed "life = life". The learner who could
// not produce the answer was shown the question again.
//
// So it is asserted over EVERY fact in BOTH directions rather than over the four
// subjects that happened to break it. The fix was structural — `revealFor`
// derives the default from the answer axis, so a subject registered tomorrow
// with no `answerReveal` is correct without doing anything — and this is the
// test that keeps that true, since the failure mode of the old shape was a
// subject nobody remembered to give an override.
//
// UNLIKE prompt-not-answer.test.ts, THERE ARE NO RESIDUALS HERE. That file pins
// two known shapes (68 loanwords, 81 grammar patterns) because they are about
// romaji-forgiving GRADING, which is a data and grader question. Reveal is plain
// string identity and holds everywhere, so this file asserts zero violations
// with nothing pinned. If a violation ever appears it is a real regression, not
// a residual to re-pin.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GRAMMAR_SUBJECT } from "../../data/grammar/index.ts";
import { KANA_SUBJECT, kanaFact } from "../../data/characters.ts";
import { KANJI_SUBJECT, meaningFactId } from "../../data/kanji.ts";
import { TRANSITIVITY_SUBJECT } from "../../data/transitivity-facts.ts";
import {
  VOCAB_SUBJECT,
  wordMeaningFactId,
  wordReadingFactId,
} from "../../data/vocab.ts";
import { ALL_FACTS, factInfo } from "../facts.ts";
import { questionsFor, revealFor } from "./question.ts";
import type { Direction, FactId } from "@/types";

const DIRS: Direction[] = ["jp2en", "en2jp"];

interface Violation {
  fact: FactId;
  dir: Direction;
  subject: string;
  shown: string;
  revealed: string;
}

/**
 * Every (fact, direction) whose reveal reprints its own prompt.
 *
 * Asked through the two seams the drill screen actually calls — `prompt` off the
 * fact's QuestionType, then the exported `revealFor` — so it cannot pass by
 * testing a helper the drill routes around. That was the old shape's real
 * problem: the composition lived in JSX, where no test could reach it.
 *
 * No ctx is passed, which is the FIXED showing of every fact: grammar's varied
 * vehicle and selection frame are per-showing and are covered by their own
 * suites. The fixed showing is the one every subject has and the one the four
 * broken subjects only ever have.
 *
 * Facts that show no prompt text are skipped — there is nothing to echo.
 *
 * Computed once: it walks every fact twice and each test below asks a different
 * question about the same list.
 */
const VIOLATIONS: Violation[] = (() => {
  const out: Violation[] = [];
  for (const fact of ALL_FACTS) {
    const qt = questionsFor(fact);
    for (const dir of DIRS) {
      const shown = qt.prompt(fact, dir).glyph.trim();
      if (!shown) continue;
      const revealed = revealFor(fact, dir).trim();
      if (revealed === shown) {
        out.push({
          fact,
          dir,
          subject: factInfo(fact)?.subject ?? "?",
          shown,
          revealed,
        });
      }
    }
  }
  return out;
})();

function describeAll(vs: Violation[]): string[] {
  return vs.map((v) => `${v.fact} ${v.dir} reveals ${v.revealed}`);
}

function inSubject(subject: string): Violation[] {
  return VIOLATIONS.filter((v) => v.subject === subject);
}

describe("a missed card never reveals its own prompt", () => {
  test("no fact in any subject, in either direction", () => {
    // The whole claim, in one assertion. The per-subject tests below are not
    // redundant with it: this one names the property, they name the four
    // subjects that were broken, and a subject added later is caught here
    // without anyone remembering to add a case.
    assert.deepEqual(describeAll(VIOLATIONS), []);
  });

  for (const subject of [
    KANA_SUBJECT,
    KANJI_SUBJECT,
    VOCAB_SUBJECT,
    GRAMMAR_SUBJECT,
    TRANSITIVITY_SUBJECT,
  ]) {
    test(`${subject} holds it in both directions`, () => {
      assert.deepEqual(describeAll(inSubject(subject)), []);
    });
  }
});

describe("the reveal is the answer, not merely something else", () => {
  // "Not the prompt" is satisfiable by revealing garbage, so the invariant above
  // is necessary and not sufficient. These pin the other half: what comes back
  // is the thing the card would have ACCEPTED.

  test("every reveal is non-empty", () => {
    // A blank reveal is the same silence as printing the question back, and it
    // is what a `?? ""` fallback degrades to the moment a lookup misses.
    const blank = ALL_FACTS.flatMap((f) =>
      DIRS.filter((d) => !revealFor(f, d).trim()).map((d) => `${f} ${d}`),
    );
    assert.deepEqual(blank, []);
  });

  /**
   * Every (fact, direction) whose revealed answer its OWN grader would reject.
   *
   * The strongest form of the claim, and the reason this file is not merely "the
   * two strings differ": show the learner exactly what the grader would have
   * taken from her. Grammar runs on its FIXED showing, matching the walk above.
   */
  const REJECTED: Array<{ fact: FactId; dir: Direction; revealed: string }> =
    (() => {
      const out: Array<{ fact: FactId; dir: Direction; revealed: string }> = [];
      for (const fact of ALL_FACTS) {
        const qt = questionsFor(fact);
        for (const dir of DIRS) {
          const revealed = revealFor(fact, dir);
          if (!qt.check(fact, dir, revealed)) out.push({ fact, dir, revealed });
        }
      }
      return out;
    })();

  test("every subject but grammar reveals a string its own grader accepts", () => {
    assert.deepEqual(
      REJECTED.filter((r) => factInfo(r.fact)?.subject !== GRAMMAR_SUBJECT).map(
        (r) => `${r.fact} ${r.dir} reveals ${r.revealed}`,
      ),
      [],
    );
  });

  test("the grammar residual is the SENSE SUFFIX, and only that", () => {
    // A handful of grammar meaning cards reveal a label their own `check` would
    // not accept — "〜られる (可能)" where the grader wants "〜られる".
    //
    // This is not the reveal bug and it is not a new one. `patternLabel` appends
    // the sense on purpose: two recipes can share a bare pattern (〜られる 可能 vs
    // 受身, 〜から 理由 vs 起点), and an MC board offering both would put two
    // identical buttons up and grade the right one wrong. `optionLabel` has said
    // so since the sense work; the reveal simply agrees with the button it lights
    // up, which is the behaviour a learner wants.
    //
    // So it is a DISPLAY suffix on a correct answer, not a wrong answer — pinned
    // by that shape rather than by count, so a seventh ambiguous pattern is fine
    // and a genuinely unacceptable reveal is not. Deciding whether the reveal
    // should say "〜られる (可能)" or "〜られる" is a copy question and belongs with
    // whoever owns patternLabel.
    const notMerelySuffixed = REJECTED.filter(({ fact, dir, revealed }) => {
      const bare = revealed.replace(/\s*\([^()]*\)$/, "");
      return bare === revealed || !questionsFor(fact).check(fact, dir, bare);
    });
    assert.deepEqual(
      notMerelySuffixed.map((r) => `${r.fact} ${r.dir} reveals ${r.revealed}`),
      [],
      "a reveal appeared that is NOT the accepted answer plus a sense suffix — investigate, do not re-pin",
    );
  });
});

describe("the four subjects that shipped the bug, by name", () => {
  // The concrete cards from the report, spelled out. The property tests above
  // would catch a regression in any of them, but a diff that reintroduces
  // `answers[0]` should fail with the actual string a learner saw next to the
  // one she should have seen, not only with a count.

  const CASES: Array<{ fact: FactId; dir: Direction; reveal: string }> = [
    // "a = a" — the headline. en2jp prompts the romaji, so the answer is the kana.
    { fact: kanaFact("あ"), dir: "en2jp", reveal: "あ" },
    { fact: kanaFact("し"), dir: "en2jp", reveal: "し" },
    // jp2en was always right and must stay right: this direction is not touched.
    { fact: kanaFact("あ"), dir: "jp2en", reveal: "a" },
    // "life = life".
    { fact: meaningFactId("生"), dir: "en2jp", reveal: "生" },
    { fact: meaningFactId("生"), dir: "jp2en", reveal: "life" },
    // "teacher in japanese = teacher".
    { fact: wordMeaningFactId("先生"), dir: "en2jp", reveal: "先生" },
    // A word asked by its READING produces the kana, not the written word — the
    // one fact shape whose en2jp answer is not its glyph.
    { fact: wordReadingFactId("先生"), dir: "en2jp", reveal: "せんせい" },
  ];

  for (const c of CASES) {
    test(`${c.fact} ${c.dir} reveals ${c.reveal}`, () => {
      assert.equal(revealFor(c.fact, c.dir), c.reveal);
    });
  }
});
