// Plain-language rewrites of the glyph-origin story shown in the "Etymology"
// section of a kanji's Built-from card.
//
// WHY THIS LAYER EXISTS
// =====================
// The generated `originText` (scripts/ingest/kanji-etymology.mjs, from
// Wiktionary) is mechanically cleaned but still reads like a dictionary: it
// opens with jargon ("Ideogrammic compound: semantic 人 (man) + semantic 木
// (tree) …") and trails long scholarly cross-references ("Compare 森…", "Shuowen
// interprets…"). A learner wants one plain, memorable line. These hand-written
// entries replace the raw text for the kanji processed so far, modelled on the
// forest line — "doubled 木 (tree) to give the idea of many trees, thus a
// forest": short, concrete, no jargon, no em dashes.
//
// HOW IT PLUGS IN
// ===============
// `etymologyOf` prefers an entry here over the generated/manual `originText`. A
// kanji with no entry here falls back to its raw text, so this file can grow one
// committable batch at a time (teaching order, most-seen kanji first) without
// anything half-done. Number kanji 一…十 are skipped — their Built-from never
// renders. Where the source text is degenerate (no real origin to reword, e.g.
// 気), the kanji is left out for a later sourcing pass rather than guessed.
//
// HOUSE STYLE (enforced by kanji-etymology.test.ts)
// - No jargon: never "compound", "semantic", "phonetic", "pictogram",
//   "ideogram" — say what the pieces DO ("gives the meaning", "lends the sound").
// - No em or en dashes (— –); use commas, colons, periods.
// - Keep the piece glyphs and their sense in parentheses where they help.

import { BATCH_02 } from "./etymology-prose/batch-02.ts";
import { BATCH_03 } from "./etymology-prose/batch-03.ts";
import { BATCH_04 } from "./etymology-prose/batch-04.ts";
import { BATCH_05 } from "./etymology-prose/batch-05.ts";
import { BATCH_06 } from "./etymology-prose/batch-06.ts";
import { BATCH_07 } from "./etymology-prose/batch-07.ts";
import { BATCH_08 } from "./etymology-prose/batch-08.ts";
import { BATCH_09 } from "./etymology-prose/batch-09.ts";
import { BATCH_10 } from "./etymology-prose/batch-10.ts";
import { BATCH_11 } from "./etymology-prose/batch-11.ts";

// Batch 01 — the first hand-cleaned set (teaching order, most-seen first).
const BATCH_01: Readonly<Record<string, string>> = {
  人: "The original glyph looked like a side view of a standing man showing an arm and a leg.",
  大: "The original glyph looked like a person facing forward, standing tall to suggest something big.",
  日: "The original glyph looked like the sun, a mark added inside to set it apart from lookalikes.",
  不: "The original glyph looked like the calyx of a flower, later borrowed to mean not.",
  乙: "The origin is unclear.",
  乞: "A variant of 气, set apart to mean to beg.",
  山: "The original glyph looked like three mountain peaks.",
  出: "A foot (止) stepping out of a hollow (凵): to step outside, to exit.",
  上: "A short stroke above a long line, marking what is above (the opposite of 下).",
  生: "A young shoot (屮) rising from the ground (一): life and growth.",
  手: "The original glyph looked like a hand with its fingers spread.",
  口: "The original glyph looked like an open mouth.",
  合: "A lid (亼) closing over a container's mouth (口): things coming together and fitting.",
  中: "The original glyph looked like a flagpole standing in the center of a field, marking the middle.",
  行: "The original glyph looked like a crossroads. Its left half 彳 became the common radical for going and movement.",
  刀: "The original glyph looked like a knife.",
  分: "八 (to split) over 刀 (a knife): to divide something up, a part.",
  干: "The original glyph looked like a shield, later also borrowed to write dry.",
  年: "This glyph originally meant harvest but changed to year over time. It uses the definition of 禾 (grain) and the sound of 人.",
};

/** Every hand-cleaned story so far, batches merged in teaching order. Ranges are
 * disjoint by construction (the dump helper excludes already-cleaned kanji), so
 * no key is defined twice; the spread order is just for readability. */
export const PROSE_OVERRIDE: Readonly<Record<string, string>> = {
  ...BATCH_01,
  ...BATCH_02,
  ...BATCH_03,
  ...BATCH_04,
  ...BATCH_05,
  ...BATCH_06,
  ...BATCH_07,
  ...BATCH_08,
  ...BATCH_09,
  ...BATCH_10,
  ...BATCH_11,
};

/**
 * Kanji whose Wiktionary origin is DEGENERATE — a form-history note ("shinjitai
 * of 實", "variant of 來"), a bare glyph list ("國或玉"), or a stub with no real
 * story. There is nothing honest to rewrite, so rather than show the raw junk we
 * suppress the Etymology section entirely (etymologyOf nulls their originText),
 * and the prose-range helper skips them so they stop clogging future batches.
 * Collected from the batch agents' skip reports; kept disjoint from
 * PROSE_OVERRIDE (guarded in kanji-etymology.test.ts).
 */
export const PROSE_SKIP: ReadonlySet<string> = new Set([
  "気", "国", "会", "当", "実", "発", "来", "売", "乗", "対",
  "間", "着", "悪", "断", "覚", "画", "歩", "変", "数", "戦",
  "観", "関", "楽", "様", "経", "読", "独", "帰", "黄", "抜",
  "参", "残", "権", "広", "育", "雑", "顔", "毎", "価", "単",
  "斉", "済", "歯", "営", "区", "辺", "辞", "総",
]);
