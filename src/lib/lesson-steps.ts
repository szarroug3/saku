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
// Kana only, by the item's own `kind`. A kanji or word lesson gets its items and
// nothing else, because the anchors are kana section ids.

import { CHAR_INDEX } from "@/data/characters";
import { dakutenRowFor, type DakutenRow } from "@/data/dakuten-rows";
import { INTRO_AFTER, INTRO_BEFORE, type PhaseIntro } from "@/data/phase-intros";
import { itemsFromFacts, type LessonItem } from "@/lib/lesson-items";
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

/**
 * The teach set, as the steps the walk pages through.
 *
 * Items in the order `itemsFromFacts` gives them — untouched — with at most one
 * card in front and at most one behind.
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
  for (const item of items) {
    const row = item.kind === "kana" ? dakutenRowFor(item.glyph) : null;
    if (row) {
      if (rowsSeen.has(row.id)) continue;
      rowsSeen.add(row.id);
      steps.push({ type: "conversion", key: row.id, row });
      continue;
    }
    steps.push({ type: "item", key: item.entry, item });
  }
  if (!items.length) return steps;

  const opensOn = sectionOf(items[0]);
  const before = opensOn ? INTRO_BEFORE[opensOn] : undefined;
  if (before) steps.unshift({ type: "intro", key: before.id, intro: before });

  const closesOn = sectionOf(items[items.length - 1]);
  const after = closesOn ? INTRO_AFTER[closesOn] : undefined;
  if (after) steps.push({ type: "intro", key: after.id, intro: after });

  return steps;
}
