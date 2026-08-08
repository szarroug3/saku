// Variant recognition — a character that reshapes as a component (人 → 亻, 水 →
// 氵, 心 → 忄/⺗) is TAUGHT the form on its lesson page, and now is QUIZZED on it
// too, folded into the base character's OWN meaning fact rather than a new SRS
// id. variantPromptFor rolls the showing; the kanji question type renders and
// grades it against the base glyph.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/variant-question.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  questionsFor,
  revealFor,
  variantPromptFor,
} from "@/lib/engine/question";
import { buildMcOptions } from "@/lib/engine/index";
import { meaningFactId, readingFactId, READING_INDEX } from "@/data/kanji";
import { factInfo } from "@/lib/facts";

const HITO = meaningFactId("人"); // has a variant: 亻
const DAI = meaningFactId("大"); // no variant on file
const MIZU = meaningFactId("水"); // has two variants: 氵, 氺

/** A deterministic rng returning a constant, so the coin and the pick are pinned.
 * 0.9 clears the "occasional" coin (rng() < 0.5 nulls) and floors to the first
 * form. */
const always = (v: number) => () => v;

test("a character WITH a variant produces a variant-recognition showing", () => {
  const v = variantPromptFor(HITO, "en2jp", always(0.9));
  assert.ok(v, "人 should roll a variant showing when the coin clears");
  assert.equal(v?.glyph, "亻", "the shown form is 人's variant 亻");
  assert.equal(v?.original, "人", "graded against the base character 人");
});

test("the variant showing is a display variation of the SAME meaning fact", () => {
  const v = variantPromptFor(HITO, "en2jp", always(0.9));
  const qt = questionsFor(HITO);
  const prompt = qt.prompt(HITO, "en2jp", { variant: v ?? undefined });
  // The prompt shows the FORM, in a JP font. It carries NO grey sub-label: the
  // whole question rides the card's single instruction line ("Which of these is
  // this a form of?" in drill-screen.tsx), so the prompt context is dropped the
  // way the grammar form-name's sub-label was.
  assert.equal(prompt.glyph, "亻", "the prompt shows the variant form");
  assert.equal(prompt.jp, true, "the form is Japanese and gets the JP font");
  assert.equal(prompt.context, null, "a variant prompt carries no grey sub-label");

  // Grading rides the base fact: 人 is right, another kanji is wrong. No new id.
  assert.equal(
    qt.check(HITO, "en2jp", "人", { variant: v ?? undefined }),
    true,
    "the base character 人 grades correct",
  );
  assert.equal(
    qt.check(HITO, "en2jp", "大", { variant: v ?? undefined }),
    false,
    "a different character grades wrong",
  );

  // A miss reveals the base character, not the form or the gloss.
  assert.equal(
    revealFor(HITO, "en2jp", { variant: v ?? undefined }),
    "人",
    "the reveal is the base character",
  );
});

test("the variant board is answerable — kanji to pick from, including the base", () => {
  const v = variantPromptFor(HITO, "en2jp", always(0.9));
  const board = buildMcOptions(HITO, "en2jp", { variant: v ?? undefined });
  assert.ok(board.length > 1, "a variant showing offers a real board of choices");
  assert.ok(board.includes(HITO), "the base character is on the board");
});

test("a multi-form character picks one of its forms", () => {
  const v = variantPromptFor(MIZU, "en2jp", always(0.9));
  assert.ok(v, "水 should roll a variant showing");
  assert.ok(
    ["氵", "氺"].includes(v?.glyph ?? ""),
    "the shown form is one of 水's variants",
  );
  assert.equal(v?.original, "水");
});

test("a character with NO variant does NOT produce a variant showing", () => {
  // Even with the coin cleared, 大 has no form on file, so nothing is rolled.
  assert.equal(variantPromptFor(DAI, "en2jp", always(0.9)), null);
  // Its en2jp meaning prompt is the ordinary English gloss, not a JP glyph.
  const prompt = questionsFor(DAI).prompt(DAI, "en2jp", {});
  assert.equal(prompt.jp, false, "no variant → plain English → glyph recognition");
});

test("the variant showing is en2jp only, and never a reading fact", () => {
  // jp2en asks the gloss; a variant belongs on the produce-the-glyph card.
  assert.equal(variantPromptFor(HITO, "jp2en", always(0.9)), null);
  // A reading fact carries an anchor and is jp2en only — never a variant showing.
  const anchor = [...READING_INDEX.values()].find((r) => r.k === "人")?.anchor;
  if (anchor) {
    const reading = readingFactId("人", anchor);
    assert.ok(factInfo(reading), "sanity: the reading fact exists");
    assert.equal(variantPromptFor(reading, "en2jp", always(0.9)), null);
  }
});

test("the showing is OCCASIONAL — a low coin keeps plain recognition", () => {
  // rng() < 0.5 leaves the base fact asked its ordinary English → glyph way.
  assert.equal(variantPromptFor(HITO, "en2jp", always(0.1)), null);
});

// The card reads as ONE instruction line, with no grey sub-label — the drill
// carries the whole variant question in the instruction slot, the way the grammar
// form-name folded in. No renderer in this harness, so this asserts the source.
const DRILL = readFileSync(
  resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../components/quiz/drill-screen.tsx",
  ),
  "utf-8",
)
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

test("a variant card shows a single instruction line, no sub-label", () => {
  // The instruction folds the question in.
  assert.match(
    DRILL,
    /q\.variant\s*\?[\s\S]*?"Which of these is this a form of\?"/,
    "the variant branch supplies the whole question as the instruction",
  );
  // The old grey sub-label copy is gone from BOTH surfaces.
  assert.doesNotMatch(
    DRILL,
    /which character is this a form of\?/,
    "the drill no longer prints a grey variant sub-label",
  );
});
