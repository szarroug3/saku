// The stepped teach phase's step model: a session's teach facts, resolved to a
// sequence of items to walk through, ONE ENTRY AT A TIME.
//
// WHY AN ENTRY IS THE STEP, NOT A FACT
// ====================================
// The drill is fact-native — 生 is eleven askable things — and that is right for
// the drill. TEACHING is not drilling: you learn the character 生 once, as one
// shape with one meaning and a table of readings, and stepping through its
// eleven facts one screen at a time would be teaching the entry/fact split to a
// beginner who has no use for it. So the walk-through's unit is the ENTRY (the
// glyph you look up), and each item carries the entry's facts along.
//
// FED BY THE SESSION, NOT A CURSOR
// ================================
// The teach phase renders whatever `session.teach` holds — the facts the budget
// put in front of you before the drill (src/lib/quiz-session.tsx). This file
// only regroups that flat list into per-entry items; it decides nothing about
// what a lesson is. The session already made that decision when it started.
//
// GENERIC OVER THE FOUR SUBJECTS
// ==============================
// Grouping is the same for kana, kanji, words and grammar: fold the facts by the
// entry they belong to (via the facts registry — a lookup, never a parse),
// preserving first-seen order, and read each entry's glyph and subject off the
// same registry. Kana yields one fact per entry, kanji the meaning fact; a
// producible grammar pattern two. All come out as "one glyph, its facts, its
// kind", which is all the stepper needs.

import { entryOf, factInfo, glyphOf } from "@/lib/facts";
import type { EntryId, FactId } from "@/types";

/** Which subject an item belongs to — its FactInfo.subject, which is exactly one
 * of these strings. The view switches on it (kana gets a mnemonic, kanji gets
 * readings), so it is named as a union rather than a bare string. */
export type LessonKind = "kana" | "radical" | "kanji" | "word" | "grammar" | "transitivity";

const KINDS: readonly LessonKind[] = ["kana", "radical", "kanji", "word", "grammar", "transitivity"];

/** A subject id from the registry, narrowed to a LessonKind; falls back to
 * "kana" for anything unrecognised so a stray fact renders as something rather
 * than crashing the walk. */
function asKind(subject: string | undefined): LessonKind {
  return KINDS.includes(subject as LessonKind) ? (subject as LessonKind) : "kana";
}

/**
 * Whether a lesson step shows the "How it's written" section (stroke order /
 * count).
 *
 * A kana has a real stroke-order diagram; a KANJI has no diagram ingested yet
 * but its stroke COUNT is real data worth showing; a RADICAL is drawn the same
 * way. A WORD is several glyphs with no single stroke order, and a GRAMMAR
 * pattern (〜てから) has none and never will — for both, the section printed a
 * misleading "learned as a whole shape" line, so they are excluded.
 * `transitivity` is a pattern too and gets nothing.
 *
 * Extracted from the lesson-item-view.tsx call site so the rule is a testable
 * pure function rather than a regex over the component source; the view calls
 * straight through.
 */
export function showsHowItsWritten(kind: LessonKind): boolean {
  return kind === "kana" || kind === "kanji" || kind === "radical";
}

/** One step of the walk-through: a glyph, its subject, and the facts learning it
 * covers. */
export interface LessonItem {
  entry: EntryId;
  /** What it looks like — あ, 生, 先生, 〜てから. */
  glyph: string;
  /** Which subject it belongs to — decides how the item renders. */
  kind: LessonKind;
  /** The facts of this entry that this teach set covers — one for a kana, the
   * meaning fact for a kanji. */
  facts: FactId[];
}

/**
 * Group a flat fact list into per-entry items, in first-seen order.
 *
 * The join from a fact to its entry, glyph and subject is a registry LOOKUP
 * (`entryOf`, `factInfo`) — never a parse of the id, the rule the whole
 * entry/fact split is built on. An id whose data is gone (history outlives the
 * dictionaries) still groups: `entryOf` returns a stable stand-in and the glyph
 * degrades to the raw id, so a deleted character shows ugly rather than
 * vanishing the walk.
 */
export function itemsFromFacts(facts: readonly FactId[]): LessonItem[] {
  const byEntry = new Map<EntryId, LessonItem>();
  const order: EntryId[] = [];
  for (const f of facts) {
    const entry = entryOf(f);
    let item = byEntry.get(entry);
    if (!item) {
      const info = factInfo(f);
      item = {
        entry,
        glyph: info?.glyph ?? glyphOf(entry),
        kind: asKind(info?.subject),
        facts: [],
      };
      byEntry.set(entry, item);
      order.push(entry);
    }
    item.facts.push(f);
  }
  return order.map((e) => byEntry.get(e)!);
}
