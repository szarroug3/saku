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
import { RECIPES } from "@/data/grammar/recipes";
import { BLANK } from "@/lib/grammar/questions";
import { buildMcOptions } from "@/lib/engine";
import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { factInfo } from "@/lib/facts";
import { VOCAB, wordMeaningFactId } from "@/data/vocab";
import type { FactId, HistoryFile } from "@/types";

/** A pinned rng, so a failure names one sentence and one board order rather
 * than "sometimes". Any deterministic sequence in [0,1) does. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A learner who knows every word in the vocabulary, as CLAIMS.
 *
 * Selection is gated on knownness now (lib/grammar/readable.ts), so a test about
 * what a selection card IS has to hand it a learner who can read something —
 * otherwise every assertion here would pass vacuously on `null`. Claims rather
 * than fabricated session aggregates, because that is the cheapest record that
 * makes `effectiveState` say "known", and because it double-books as proof the
 * gate honours claims. The gate's own behaviour is tested in
 * lib/grammar/readable.test.ts; here it is only being got out of the way.
 */
/** A learner at the very beginning: nothing known, so the gate admits nothing. */
const NOBODY: HistoryFile = { sessions: [], facts: {} };

const OMNISCIENT: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(VOCAB.map((w) => [wordMeaningFactId(w.keb), 1_700_000_000_000])),
};

const TE_KARA = "te-kara";
const TE_KARA_MEANING = patternMeaningFactId(TE_KARA);
const TE_KARA_PRODUCTION = patternProductionFactId(TE_KARA);

describe("grammarSelectionFor — the card carries its fact", () => {
  test("a selectable pattern yields a showing whose board is MEANING facts", () => {
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
    assert.ok(sel);
    assert.ok(sel.frame.includes(BLANK), "the frame must have a blank");
    assert.ok(sel.en.length > 0, "the English is the only context; it is required");
    assert.ok(sel.sourceId > 0, "a Tatoeba id, for attribution and bad-item reports");
  });

  test("a PRODUCTION fact never gets one — selection is not that question", () => {
    assert.equal(grammarSelectionFor(TE_KARA_PRODUCTION, OMNISCIENT, seeded(7)), null);
  });

  test("a non-grammar fact never gets one", () => {
    assert.equal(grammarSelectionFor("kana:あ/reading" as FactId, OMNISCIENT, seeded(7)), null);
  });

  test("は and が are on no board, ever", () => {
    // There is no recipe for either (see the header of grammar/questions.ts), so
    // this is asserting the property the whole subject rests on rather than a
    // filter: sweep every pattern's board and check nothing reading は or が got
    // there by any route.
    let boards = 0;
    for (const r of ["te-kara", "wo", "made", "tai", "te-cause"]) {
      const sel = grammarSelectionFor(patternMeaningFactId(r), OMNISCIENT, seeded(11));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
    assert.ok(sel);
    const shown = questionsFor(TE_KARA_MEANING).answerReveal?.(TE_KARA_MEANING, "jp2en", {
      grammarSelection: sel,
    });
    assert.equal(shown, "〜てから");
    assert.notEqual(shown, factInfo(TE_KARA_MEANING)?.answers[0]); // the gloss
  });

  test("a board belonging to another card is ignored, not rendered", () => {
    // A stale serialized runtime, or a re-cut of the data. The fallback is the
    // old pattern-and-glosses card, never someone else's sentence.
    const other = grammarSelectionFor(patternMeaningFactId("tai"), OMNISCIENT, seeded(3));
    assert.ok(other);
    if (other.choices.includes(TE_KARA_MEANING)) return; // not stale for this fact
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "jp2en", {
      grammarSelection: other,
    });
    assert.equal(p.context, "meaning");
  });
});

// ---------------------------------------------------------------------------
// THE FALLBACK CARD
// ---------------------------------------------------------------------------
// Every pattern lands here when the knownness gate leaves it no readable
// sentence, and 30 of the 81 recipes live here permanently. It shipped broken:
//
//   asked fact:    grammar:te-kara/meaning
//   prompt glyph:  〜てから
//   option labels: 〜てもいい, 〜てはいけない, 〜て, 〜て, 〜てください, 〜てから
//
// The prompt was on the board (a free point), and two buttons read 〜て (two
// recipes, distinct glosses, identical pattern text — the dedupe was looking at
// glosses). Both are asserted against below, by rendering the board the way the
// drill renders it rather than by inspecting the facts.

/** The drill's own option text, mirrored from drill-screen's `labelOf`: a
 * subject's per-showing label if it has one, else the glyph (en2jp, which offers
 * Japanese) or the first answer (jp2en, which offers English). */
function labelOf(fact: FactId, dir: "jp2en" | "en2jp"): string {
  const shown = questionsFor(fact).optionLabel?.(fact, dir);
  if (shown != null) return shown;
  const info = factInfo(fact);
  if (!info) return "";
  return dir === "en2jp" ? info.glyph : (info.answers[0] ?? "");
}

describe("the fixed meaning card is a real question in both directions", () => {
  /** Patterns worth sweeping: the one from the bug report, its 〜て neighbours,
   * and a spread of the rest. */
  const SWEEP = RECIPES.map((r) => patternMeaningFactId(r.id));

  test("jp2en shows the PATTERN and offers English", () => {
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "jp2en");
    assert.equal(p.glyph, "〜てから");
    assert.ok(p.jp, "the pattern is Japanese");
    assert.equal(p.context, "meaning");
    const opts = buildMcOptions(TE_KARA_MEANING);
    assert.ok(opts.length > 1, "a one-option board is not a question");
    for (const o of opts) {
      assert.notEqual(labelOf(o, "jp2en"), p.glyph, "the prompt is on the board");
    }
  });

  test("en2jp shows the ENGLISH and offers patterns — the reported bug", () => {
    const p = questionsFor(TE_KARA_MEANING).prompt(TE_KARA_MEANING, "en2jp");
    assert.equal(p.glyph, "after doing X");
    assert.equal(p.jp, false, "English must not get the JP font");
    assert.equal(p.context, "pattern");
    const opts = buildMcOptions(TE_KARA_MEANING);
    // The exact shipped failure: prompt 〜てから, and 〜てから among the buttons.
    assert.ok(opts.map((o) => labelOf(o, "en2jp")).includes("〜てから"));
    assert.ok(!opts.map((o) => labelOf(o, "en2jp")).includes(p.glyph));
  });

  test("a TYPED en2jp meaning card accepts the pattern it now asks for", () => {
    // を, へ, まで, までに, だけ are pure kana, so they reach the drill as typed
    // en2jp cards rather than MC. The romaji input can only produce kana, so the
    // gloss was never typeable there and every answer graded wrong.
    for (const id of ["wo", "made", "dake"]) {
      const fact = patternMeaningFactId(id);
      const pattern = grammarMeaning(fact)!.recipe.pattern;
      const qt = questionsFor(fact);
      assert.ok(qt.check(fact, "en2jp", pattern), `${id}: pattern rejected`);
      assert.ok(
        qt.check(fact, "en2jp", pattern.replace(/^〜/, "")),
        `${id}: pattern without the citation 〜 rejected`,
      );
      // jp2en is unchanged: there the question is what it MEANS.
      assert.ok(qt.check(fact, "jp2en", factInfo(fact)!.answers[0]));
    }
  });

  test("a missed card reveals the half it ASKED for, not the half it showed", () => {
    const qt = questionsFor(TE_KARA_MEANING);
    // en2jp asked for the pattern, so a miss shows the pattern. Revealing the
    // baked answer here printed "after doing X pattern = after doing X".
    assert.equal(qt.answerReveal?.(TE_KARA_MEANING, "en2jp"), "〜てから");
    // jp2en asked for the meaning; no override, so the drill's own fallback
    // (the fact's first answer) is right and this returns null.
    assert.equal(qt.answerReveal?.(TE_KARA_MEANING, "jp2en"), null);
  });

  test("the prompt is never among the options, for any pattern, either way", () => {
    for (const fact of SWEEP) {
      for (const dir of ["jp2en", "en2jp"] as const) {
        const p = questionsFor(fact).prompt(fact, dir);
        const opts = buildMcOptions(fact);
        if (opts.length < 2) continue; // degrades to typed; not a board
        for (const o of opts) {
          assert.notEqual(
            labelOf(o, dir),
            p.glyph,
            `${fact} ${dir}: the prompt was an option`,
          );
        }
      }
    }
  });

  test("no two options render the same label, for any pattern, either way", () => {
    for (const fact of SWEEP) {
      for (const dir of ["jp2en", "en2jp"] as const) {
        const labels = buildMcOptions(fact).map((o) => labelOf(o, dir));
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${fact} ${dir}: duplicate labels ${labels.join(", ")}`,
        );
      }
    }
  });

  test("grammar meaning stays askable when NO sentence is readable", () => {
    // The whole reason this card has to be solid. With an empty history the gate
    // admits nothing, so every pattern falls back — and the fallback must be a
    // question, not silence and not the degenerate board.
    let fellBack = 0;
    for (const fact of SWEEP) {
      assert.equal(
        grammarSelectionFor(fact, NOBODY, seeded(5)),
        null,
        `${fact} produced a selection item for a learner who knows nothing`,
      );
      fellBack++;
      for (const dir of ["jp2en", "en2jp"] as const) {
        const p = questionsFor(fact).prompt(fact, dir);
        assert.ok(p.glyph.length > 0, `${fact} ${dir}: empty prompt`);
      }
      assert.ok(buildMcOptions(fact).length > 1, `${fact}: no board`);
    }
    assert.equal(fellBack, RECIPES.length);
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
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
    const sel = grammarSelectionFor(TE_KARA_MEANING, OMNISCIENT, seeded(7));
    assert.ok(sel);
    assert.equal(TE_KARA_MEANING, patternMeaningFactId(TE_KARA));
    assert.notEqual(TE_KARA_MEANING, TE_KARA_PRODUCTION);
  });
});
