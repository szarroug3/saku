// confusedWith / buildMcOptions — the honesty of the confusion score and the
// answerability of a multiple-choice board.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/confused.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildMcOptions, confusedWith } from "@/lib/engine/index";
import { kanaFact } from "@/data/characters";
import { meaningFactId } from "@/data/kanji";
import { entryOf, factInfo } from "@/lib/facts";

const KA = kanaFact("か"); // "ka"
const KI = kanaFact("き"); // "ki"
const DU = kanaFact("づ"); // "zu" / "du"
const ZU = kanaFact("ず"); // "zu"
const KATA_KA = kanaFact("カ"); // "ka"

const HITO = meaningFactId("人"); // person
const HAIRU = meaningFactId("入"); // enter

test("exactly one match in the deck returns that entry", () => {
  const said = confusedWith(KA, "ki", [KA, KI]);
  assert.equal(said, entryOf(KI));
});

test("zero matches in the deck returns null — a plain miss, no pair", () => {
  assert.equal(confusedWith(KA, "zzz", [KA, KI]), null);
});

test("two or more matching entries returns null — ambiguity claims nothing", () => {
  // づ and ず both read "zu": which one was meant is unknowable, so no pair.
  assert.equal(confusedWith(KA, "zu", [KA, DU, ZU]), null);
});

test("a different reading of the SAME entry is not a confusion", () => {
  // づ also accepts "du"; asked づ, typed "du", it must not confuse づ with づ.
  assert.equal(confusedWith(DU, "du", [DU, KI]), null);
});

test("a kanji reading no longer fabricates a pair from the prediction table", () => {
  // 入 is in 人's confusable table, so the OLD distractor-search returned 入 for
  // "enter" whether or not the user was studying it. With 入 absent from the
  // deck, the honest answer is silence.
  assert.equal(confusedWith(HITO, "enter", [HITO]), null);
  // And when 入 IS in the deck, the demonstrated confusion is claimed.
  assert.equal(confusedWith(HITO, "enter", [HITO, HAIRU]), entryOf(HAIRU));
});

test("empty / whitespace given never claims a pair", () => {
  assert.equal(confusedWith(KA, "   ", [KA, KI]), null);
});

test("cross-script lookalikes surface as MC distractors", () => {
  // Asking カ should be able to offer 力 (its kanji lookalike) as a wrong option.
  const opts = buildMcOptions(KATA_KA);
  assert.ok(opts.includes(meaningFactId("力")), "力 should be an option for カ");
  // ...and asking 力 should offer カ.
  const optsKanji = buildMcOptions(meaningFactId("力"));
  assert.ok(optsKanji.includes(kanaFact("カ")), "カ should be an option for 力");
});

test("a cross-script lookalike is a distractor, never an auto-scored confusion", () => {
  // Typing 力's meaning when asked カ, with 力 NOT in the deck, claims nothing:
  // the prediction table feeds options, never the score.
  assert.equal(confusedWith(KATA_KA, "power", [KATA_KA, KI]), null);
});

test("no MC option is co-correct with the asked fact (en2jp answerability)", () => {
  // か and カ both read "ka"; a board with both is unanswerable in en2jp. No
  // option may share an answer with the asked fact, in any subject.
  for (const asked of [KA, KATA_KA, KI, DU]) {
    const answers = new Set(
      (factInfo(asked)?.answers ?? []).map((a) => a.trim().toLowerCase()),
    );
    for (const opt of buildMcOptions(asked)) {
      if (opt === asked) continue;
      const shared = (factInfo(opt)?.answers ?? []).some((a) =>
        answers.has(a.trim().toLowerCase()),
      );
      assert.ok(!shared, `${opt} is co-correct with ${asked}`);
    }
  }
});
