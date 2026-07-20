// The teach walk's step list: the lesson's items, plus the teaching cards that
// introduce a new PHASE of the curriculum.
//
// WHY A LAYER ABOVE itemsFromFacts
// ================================
// `itemsFromFacts` answers "what glyphs does this teach set cover", and that is
// all it should ever answer — it is subject-generic and knows nothing about
// kana's curriculum. A phase intro is not a glyph and has no fact, so folding it
// in there would put "kana has a dakuten phase" inside the generic grouper.
//
// So the walk steps over LessonSteps instead: an item step wraps exactly the
// LessonItem it always did, and an intro step carries a card. Anything with no
// intro produces a step list that is the item list one-for-one, which is why a
// phase without a card behaves exactly as it did before this file existed.
//
// ONE HELPER, TWO CALLERS, ONE COUNT
// ==================================
// The walk renders the steps and the session HUD counts them ("1 of 6"). Both
// call this, so the count and the content cannot disagree — the same reason the
// HUD already derived its items from `itemsFromFacts` rather than keeping its
// own copy.
//
// ANCHORED ON THE EDGES OF THE TEACH SET
// ======================================
// A "before" card shows when the teach set OPENS on a section that has one; an
// "after" card shows when it CLOSES on one. Local, deterministic, and a
// function of the teach set alone — no cursor, nothing on disk, nothing to get
// out of step with history. A group re-taught later shows its card again, which
// is the right answer for a card whose whole job is to explain the material.
//
// Kana only, by the item's own `kind` — with EXCEPTIONS. A kanji/word rule with
// no kana section to hang on rides the WORD that first puts it in play: the
// iteration mark 々 and rendaku both surface the moment the first 々 word (時々)
// is taught, because that one word makes both rules visible at once (ときどき is
// 々 AND the と → ど voicing). Okurigana is word-gated the same way, over three
// cards: the idea rides the first word that carries a kana tail, and the moving
// and fixed cards ride the first word whose tail moves and the first whose tail
// does not, so each contrast is real rather than hypothetical. See
// phase-intros.ts for why these are word-gated rather than anchored to a section.

import { CHAR_INDEX } from "@/data/characters";
import { dakutenRowFor, type DakutenRow } from "@/data/dakuten-rows";
import {
  INTRO_AFTER,
  INTRO_BEFORE,
  ITERATION_MARK,
  OKURIGANA_FIXED,
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  RENDAKU,
  type PhaseIntro,
} from "@/data/phase-intros";
import { vocabRow } from "@/data/vocab";
import { itemsFromFacts, type LessonItem } from "@/lib/lesson-items";
import { wordClassOf } from "@/lib/word-forms";
import type { FactId } from "@/types";

/** One step of the walk — a character to learn, a conversion to learn, or a
 * concept to read. */
export type LessonStep =
  | { type: "intro"; key: string; intro: PhaseIntro }
  | { type: "conversion"; key: string; row: DakutenRow }
  | { type: "item"; key: string; item: LessonItem };

/** The kana section a step's glyph belongs to, or null for anything that isn't
 * a kana we ship. A lookup, never a parse. */
function sectionOf(item: LessonItem): string | null {
  if (item.kind !== "kana") return null;
  return CHAR_INDEX[item.glyph]?.sec ?? null;
}

/** The iteration mark, whose presence in a word's spelling is the whole gate for
 * the two rules it introduces. A word that contains it is by definition the first
 * place both 々 and rendaku are in play. */
const ITERATION_GLYPH = "々";

/** A kanji, roughly: the CJK unified ideographs plus extension A. Deliberately
 * not 々 (U+3005), which is punctuation the iteration-mark gate owns. */
const KANJI = /[\u4e00-\u9faf\u3400-\u4dbf]/;
/** A hiragana. Okurigana is always hiragana — the katakana range is not it. */
const HIRAGANA = /[\u3040-\u309f]/;

/**
 * Does this written form end a kanji with a kana tail — okurigana?
 *
 * True when a hiragana appears somewhere AFTER a kanji: a kanji stem followed by
 * a hiragana tail (生きる, 高い, 一つ, 言う). Pure kana (これ) has no kanji, pure
 * kanji (先生) has no tail, and 時々 has only 々 after its kanji — none is
 * okurigana. A word with a hiragana in front of a later kanji (お茶) is not
 * caught either, because the tail has to come after the kanji, not before it.
 */
export function hasOkurigana(word: string): boolean {
  let seenKanji = false;
  for (const ch of word) {
    if (KANJI.test(ch)) {
      seenKanji = true;
      continue;
    }
    if (seenKanji && HIRAGANA.test(ch)) return true;
  }
  return false;
}

/** Does the word's tail MOVE — i.e. does it conjugate? A non-null conjugation
 * class (verb or い-adjective) means the okurigana is the part that changes;
 * null (a counter, a plain noun) means the tail is fixed. Resolved through the
 * app's own pos→class bridge (`wordClassOf`), because vocab.json stores JMdict's
 * EXPANDED pos names and `classFromTags` speaks the short codes — see the head of
 * word-forms.ts. A word with no vocab row cannot be shown to conjugate, so it
 * counts as fixed. */
function tailMoves(word: string): boolean {
  const row = vocabRow(word);
  return row ? wordClassOf(row) !== null : false;
}

/**
 * The teach set, as the steps the walk pages through.
 *
 * Items in the order `itemsFromFacts` gives them — untouched — with at most one
 * card in front and any number behind (a script's last group closes on both its
 * long-vowel and its sokuon card), plus the two word-gated cards (々 and rendaku)
 * ahead of the first word that carries 々, and the three okurigana cards ahead of
 * the first word with a kana tail (intro), the first whose tail moves (moving),
 * and the first whose tail is fixed (fixed).
 */
export function lessonSteps(facts: readonly FactId[]): LessonStep[] {
  const items = itemsFromFacts(facts);
  const steps: LessonStep[] = [];
  // A converted kana is not taught on its own card. Its whole row is one
  // lesson — "voice the k and it becomes g" — so the first character of a row
  // to come past emits that row's card, at the position it would have had, and
  // its other four fold into the same card rather than adding four steps. See
  // src/data/dakuten-rows.ts.
  const rowsSeen = new Set<string>();
  // The iteration mark and rendaku have no kana section to anchor to; they ride
  // the first word whose spelling uses 々, and only the first one, so a teach set
  // full of 々 words teaches the pair once rather than before every word.
  let markedIteration = false;
  // Okurigana rides words the same way, over three cards each fired once: the
  // idea at the first word with a kana tail, the moving card at the first whose
  // tail conjugates, the fixed card at the first whose tail does not.
  let markedOkurigana = false;
  let markedOkuriganaMoving = false;
  let markedOkuriganaFixed = false;
  for (const item of items) {
    const row = item.kind === "kana" ? dakutenRowFor(item.glyph) : null;
    if (row) {
      if (rowsSeen.has(row.id)) continue;
      rowsSeen.add(row.id);
      steps.push({ type: "conversion", key: row.id, row });
      continue;
    }
    if (!markedIteration && item.glyph.includes(ITERATION_GLYPH)) {
      markedIteration = true;
      steps.push({ type: "intro", key: ITERATION_MARK.id, intro: ITERATION_MARK });
      steps.push({ type: "intro", key: RENDAKU.id, intro: RENDAKU });
    }
    if (item.kind === "word" && hasOkurigana(item.glyph)) {
      // The idea leads, so when the first tail word is itself a moving word the
      // intro and moving cards land together ahead of it, intro first.
      if (!markedOkurigana) {
        markedOkurigana = true;
        steps.push({ type: "intro", key: OKURIGANA_INTRO.id, intro: OKURIGANA_INTRO });
      }
      const moves = tailMoves(item.glyph);
      if (!markedOkuriganaMoving && moves) {
        markedOkuriganaMoving = true;
        steps.push({ type: "intro", key: OKURIGANA_MOVING.id, intro: OKURIGANA_MOVING });
      }
      if (!markedOkuriganaFixed && !moves) {
        markedOkuriganaFixed = true;
        steps.push({ type: "intro", key: OKURIGANA_FIXED.id, intro: OKURIGANA_FIXED });
      }
    }
    steps.push({ type: "item", key: item.entry, item });
  }
  if (!items.length) return steps;

  const opensOn = sectionOf(items[0]);
  const before = opensOn ? INTRO_BEFORE[opensOn] : undefined;
  if (before) steps.unshift({ type: "intro", key: before.id, intro: before });

  // Closing a script can owe more than one card — long vowels AND small っ both
  // come due once every shape is known — so this is a list where the opening
  // side is a single card. They are pushed in table order, and each is an
  // ordinary step: the walk pages through them and the HUD counts them like
  // anything else, which is the whole reason both read this function.
  const closesOn = sectionOf(items[items.length - 1]);
  const after = closesOn ? INTRO_AFTER[closesOn] : undefined;
  for (const intro of after ?? []) {
    steps.push({ type: "intro", key: intro.id, intro });
  }

  return steps;
}
