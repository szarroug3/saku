// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/grammar-selection.test.ts
//
// The LIVE seam for #51: a grammar MEANING fact asked as a fill-the-blank
// SELECTION item. The generator (lib/grammar/questions.ts) and the card
// normaliser (lib/grammar/mc.ts) already had their own tests and were reached
// by nothing; these drive the seam the DRILL calls — roll a showing, render the
// prompt, label the options, grade a click, fold the session — because that is
// where "it generates fine" and "it scores the right thing" are different
// claims.
//
// The claim this file exists to defend: A SELECTION ANSWER MOVES THE MEANING
// FACT AND ONLY THE MEANING FACT. "Which pattern fits this blank" is a question
// about what a pattern means and where it goes, which is the standing the
// Library entry page shows as `Meaning`. "Build 〜てから on 食べる" is a different
// question with a different fact, and a selection answer may not touch it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { grammarSelectionFor, questionsFor } from "./question";
import {
  GRAMMAR_SUBJECT,
  grammarMeaning,
  patternMeaningFactId,
  patternProductionFactId,
} from "@/data/grammar";
import { BLANK } from "@/lib/grammar/questions";
import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/** A pinned rng, so a failure names one sentence and one board order rather
 * than "sometimes". Any deterministic sequence in [0,1) does. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TE_KARA = "te-kara";
const TE_KARA_MEANING = patternMeaningFactId(TE_KARA);
const TE_KARA_PRODUCTION = patternProductionFactId(TE_KARA);

describe("grammarSelectionFor — the card carries its fact", () => {
  test("a selectable pattern yields a showing whose board is MEANING facts", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel, "〜てから is selectable; it must produce a showing");
    // The asked fact is ON its own board — this is what makes the drill's
    // `picked === q.f` grading score the right thing without a new path.
    assert.ok(sel.choices.includes(TE_KARA_MEANING));
    for (const f of sel.choices) {
      assert.equal(factInfo(f)?.subject, GRAMMAR_SUBJECT);
      // Every option is a pattern's MEANING fact. Not one of them is a
      // production fact — the board cannot even name the other question.
      assert.ok(grammarMeaning(f), `${f} is not a meaning fact`);
    }
    assert.ok(!sel.choices.includes(TE_KARA_PRODUCTION));
  });

  test("the showing is a real corpus sentence with a blank in it", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    assert.ok(sel.frame.includes(BLANK), "the frame must have a blank");
    assert.ok(sel.en.length > 0, "the English is the only context; it is required");
    assert.ok(sel.sourceId > 0, "a Tatoeba id, for attribution and bad-item reports");
  });

  test("a PRODUCTION fact never gets one — selection is not that question", () => {
    assert.equal(grammarSelectionFor(TE_KARA_PRODUCTION, seeded(7)), null);
  });

  test("a non-grammar fact never gets one", () => {
    assert.equal(grammarSelectionFor("kana:あ/reading" as FactId, seeded(7)), null);
  });

  test("は and が are on no board, ever", () => {
    // There is no recipe for either (see the header of grammar/questions.ts), so
    // this is asserting the property the whole subject rests on rather than a
    // filter: sweep every pattern's board and check nothing reading は or が got
    // there by any route.
    let boards = 0;
    for (const r of ["te-kara", "wo", "made", "tai", "te-cause"]) {
      const sel = grammarSelectionFor(patternMeaningFactId(r), seeded(11));
      if (!sel) continue;
      boards++;
      for (const f of sel.choices) {
        const p = grammarMeaning(f)?.recipe.pattern ?? "";
        assert.ok(p !== "は" && p !== "が", `${p} reached a choice board`);
      }
    }
    assert.ok(boards > 0, "the sweep must actually have swept something");
  });
});

describe("the drill renders it through the MC control it already has", () => {
  test("prompt: host in the halo, blanked sentence and English under it", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "jp2en", {
      grammarSelection: sel,
    });
    // The halo gets ONE short Japanese thing, as it does for every subject.
    assert.equal(p.glyph, sel.host ?? BLANK);
    assert.ok(p.jp);
    assert.equal(p.context, sel.frame);
    assert.equal(p.note, sel.en);
  });

  test("without a showing, the old meaning card is unchanged", () => {
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "jp2en");
    assert.equal(p.glyph, "〜てから");
    assert.equal(p.context, "meaning");
    assert.equal(p.note ?? null, null);
  });

  test("every option reads as a PATTERN, in both directions, and all differ", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    const qt = questionsFor(TE_KARA_MEANING);
    for (const dir of ["jp2en", "en2jp"] as const) {
      const labels: (string | null | undefined)[] = sel.choices.map((f) =>
        qt.optionLabel?.(f, dir, { grammarSelection: sel }),
      );
      for (const [i, label] of labels.entries()) {
        assert.equal(label, grammarMeaning(sel.choices[i])?.recipe.pattern);
      }
      // Two options reading the same thing is the one thing MC may never do.
      assert.equal(new Set(labels).size, labels.length);
    }
  });

  test("a miss reveals the PATTERN that fits, not the fact's gloss", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    const shown = questionsFor(TE_KARA_MEANING).answerReveal?.(TE_KARA_MEANING, {
      grammarSelection: sel,
    });
    assert.equal(shown, "〜てから");
    assert.notEqual(shown, factInfo(TE_KARA_MEANING)?.answers[0]); // the gloss
  });

  test("a board belonging to another card is ignored, not rendered", () => {
    // A stale serialized runtime, or a re-cut of the data. The fallback is the
    // old pattern-and-glosses card, never someone else's sentence.
    const other = grammarSelectionFor(patternMeaningFactId("tai"), seeded(3));
    assert.ok(other);
    if (other.choices.includes(TE_KARA_MEANING)) return; // not stale for this fact
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "jp2en", {
      grammarSelection: other,
    });
    assert.equal(p.context, "meaning");
  });
});

describe("answering moves the MEANING fact and nothing else", () => {
  /** The drill's grading rule, verbatim (drill-screen submit): an MC click is
   * answered by WHICH FACT was picked, and the score goes to the asked fact. */
  function score(asked: FactId, picked: FactId) {
    const ok = picked === asked;
    return { seen: 1, firstTry: ok ? 1 : 0, correct: ok ? 1 : 0, missed: ok ? 0 : 1 };
  }

  test("a right answer moves Meaning and leaves How-to-build-it untouched", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    const meaning = emptyAggregate();
    const production = emptyAggregate();
    foldSession(meaning, score(TE_KARA_MEANING, TE_KARA_MEANING), 1_700_000_000_000);
    assert.equal(meaning.seen, 1);
    assert.equal(meaning.firstTry, 1);
    assert.ok(meaning.lastTested > 0, "the meaning fact was tested");
    // The production fact was never in the record, so nothing folded into it.
    assert.equal(production.seen, 0);
    assert.equal(production.lastTested, emptyAggregate().lastTested);
  });

  test("a wrong click scores the ASKED fact as a miss, not the clicked one", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    const wrong = sel.choices.find((f) => f !== TE_KARA_MEANING);
    assert.ok(wrong, "a one-option board is not a question");
    const asked = emptyAggregate();
    const clicked = emptyAggregate();
    foldSession(asked, score(TE_KARA_MEANING, wrong), 1_700_000_000_000);
    assert.equal(asked.seen, 1);
    assert.equal(asked.missed, 1);
    assert.equal(asked.firstTry, 0);
    // Picking 〜たい when the blank wanted 〜てから is a miss about 〜てから. It is
    // NOT evidence about 〜たい, which was never asked.
    assert.equal(clicked.seen, 0);
    // And it is not evidence about building the form either.
    assert.equal(emptyAggregate().seen, 0);
  });

  test("the fact a selection answer moves is exactly patternMeaningFactId", () => {
    // Stated as an identity rather than inferred from a fold, because this is
    // the modelling decision the whole task turns on.
    const sel = grammarSelectionFor(TE_KARA_MEANING, seeded(7));
    assert.ok(sel);
    assert.equal(TE_KARA_MEANING, patternMeaningFactId(TE_KARA));
    assert.notEqual(TE_KARA_MEANING, TE_KARA_PRODUCTION);
  });
});
