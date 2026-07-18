// The stepped lesson page's step model: one lesson, resolved to a sequence of
// items to walk through, ONE ENTRY AT A TIME.
//
// WHY AN ENTRY IS THE STEP, NOT A FACT
// ====================================
// The drill is fact-native — 生 is eleven askable things — and that is right for
// the drill. A LESSON is not a drill: you learn the character 生 once, as one
// shape with one meaning and a table of readings, and stepping through its
// eleven facts one screen at a time would be teaching the entry/fact split to a
// beginner who has no use for it. So the walk-through's unit is the ENTRY (the
// glyph you look up), and each item carries the entry's facts along so the page
// can claim/seen exactly what the lesson cards already do.
//
// PURE, AND A VIEW OF HISTORY
// ===========================
// This holds no cursor. Every track's next lesson is `next*Lesson(history, …)`
// from the existing curriculum modules — the SAME functions Home's cards read —
// so the page and the card can never disagree about what "the next kana lesson"
// is. Finish or claim a group and the next one falls out of history with nothing
// to advance. The one job here is to publish those four differently-shaped
// lessons as one shape the stepper can render without knowing which track it is.
//
// GENERIC OVER THE FOUR TRACKS
// ============================
// Once a track's lesson has handed over its `facts`, the items are built the
// same way for all four: group the facts by the entry they belong to (via the
// facts registry — a lookup, never a parse), preserving first-seen order, and
// carry each entry's glyph and facts. Kana yields one fact per entry, kanji the
// meaning fact per entry; both come out as "one glyph, its facts", which is all
// the stepper needs.

import { kanjiTeachOrder } from "@/data/kanji";
import { WHY_SCRIPT, WHY_TRACK, type Why } from "@/data/why";
import { entryOf, factInfo, glyphOf } from "@/lib/facts";
import { nextGrammarLesson } from "@/lib/grammar-lesson";
import { nextKanjiLesson, type LessonRange } from "@/lib/kanji-lesson";
import { nextLesson, setFacts } from "@/lib/lesson";
import { nextWordLesson } from "@/lib/word-lesson";
import type { EntryId, FactId, HistoryFile, NewKanjiOrder } from "@/types";

/** The four curricula, as a route param. Matches each subject's own id, so a
 * plan's `track` also names how its items should render (kana gets a mnemonic
 * scaffold, kanji gets readings, and so on). */
export type LessonTrack = "kana" | "kanji" | "word" | "grammar";

export const LESSON_TRACKS: readonly LessonTrack[] = [
  "kana",
  "kanji",
  "word",
  "grammar",
];

/** A validated track, or "kana" (the default — the first thing anyone learns
 * and what the inline walkthrough used to teach) for anything unrecognised. A
 * URL outlives the code that made it, so a bad `?track=` degrades rather than
 * throws. */
export function asTrack(raw: string | null | undefined): LessonTrack {
  return LESSON_TRACKS.includes(raw as LessonTrack) ? (raw as LessonTrack) : "kana";
}

/** One step of the walk-through: a glyph, and the facts learning it covers. */
export interface LessonItem {
  entry: EntryId;
  /** What it looks like — あ, 生, 先生, 〜てから. */
  glyph: string;
  /** Which track it belongs to. The whole lesson is one track, so this equals
   * the plan's `track`; carried per item so a view holding one item alone knows
   * how to render it. */
  kind: LessonTrack;
  /** The facts of this entry that THIS lesson teaches — one for a kana, the
   * meaning fact for a kanji. What "I already know this" claims for the item. */
  facts: FactId[];
}

/** A claim button that spans more than the lesson — "I know all hiragana". */
export interface ClaimAll {
  label: string;
  facts: FactId[];
}

/** One lesson, resolved to what the stepper renders. Null-free: the page treats
 * a null plan as "nothing to learn on this track". */
export interface LessonPlan {
  track: LessonTrack;
  /** The header title — "Vowels あ", "Kanji · lesson 2 of 180". */
  label: string;
  /** One honest line under it. */
  sub: string;
  items: LessonItem[];
  /** Every fact the lesson teaches, across all items — what "Quiz me" and the
   * group-level "I already know these" act on. */
  facts: FactId[];
  /** The off-app guide, when the track has one (kana → Tofugu). */
  learn?: { url: string; label: string };
  /** A wider claim than the lesson — kana's "I know all hiragana". */
  claimAll?: ClaimAll;
  /** The track's "why?" teaching layer, shown once in the header. */
  why?: Why;
  /** A kanji lesson that is a single indivisible bundle over the user's max. */
  over?: boolean;
}

/** The curriculum settings a plan needs — the same values Home reads off cfg,
 * passed in so this module stays a pure function of (track, history, settings)
 * and never reaches for a hook. */
export interface LessonSettings {
  kanjiOrder: NewKanjiOrder;
  lessonRange: LessonRange;
  wordsPerLesson: number;
  grammarPerLesson: number;
}

/**
 * Group a flat fact list into per-entry items, in first-seen order.
 *
 * The join back from a fact to its entry and glyph is a registry LOOKUP
 * (`entryOf`, `factInfo`) — never a parse of the id, the rule the whole
 * entry/fact split is built on. `kind` is stamped from the track rather than
 * read off the fact's subject: a lesson is single-track by construction, and
 * threading the track through is one fewer place a subject string could drift.
 */
function itemsFromFacts(facts: readonly FactId[], track: LessonTrack): LessonItem[] {
  const byEntry = new Map<EntryId, LessonItem>();
  const order: EntryId[] = [];
  for (const f of facts) {
    const entry = entryOf(f);
    let item = byEntry.get(entry);
    if (!item) {
      item = {
        entry,
        glyph: factInfo(f)?.glyph ?? glyphOf(entry),
        kind: track,
        facts: [],
      };
      byEntry.set(entry, item);
      order.push(entry);
    }
    item.facts.push(f);
  }
  return order.map((e) => byEntry.get(e)!);
}

/**
 * The next lesson on a track, resolved to a plan the stepper can render, or null
 * when the track has nothing new to teach.
 *
 * Each branch is a thin wrapper over the curriculum module that already owns
 * that track — this adds no policy of its own about what a lesson is, only a
 * common shape over four that arrive different.
 */
export function lessonPlan(
  track: LessonTrack,
  history: HistoryFile,
  settings: LessonSettings,
): LessonPlan | null {
  switch (track) {
    case "kana": {
      const l = nextLesson(history);
      if (!l) return null;
      return {
        track,
        label: l.group.label,
        sub: `${l.group.setLabel} · group ${l.group.index} of ${l.group.total}`,
        items: itemsFromFacts(l.facts, track),
        facts: l.facts,
        learn: { url: l.learn.url, label: l.learn.label },
        claimAll: {
          label: `I know all ${l.group.setLabel.toLowerCase()}`,
          facts: setFacts(l.group.setId),
        },
        // The script "why?" only where the question is live: the first group of
        // a script, the one juncture a beginner asks "why start here?". The same
        // rule the inline card used.
        why: l.group.index === 1 ? WHY_SCRIPT[l.group.setId] : undefined,
      };
    }
    case "kanji": {
      const l = nextKanjiLesson(
        history,
        kanjiTeachOrder(settings.kanjiOrder),
        settings.lessonRange,
      );
      if (!l) return null;
      return {
        track,
        label: `Kanji · lesson ${l.group.index} of ${l.group.total}`,
        sub: "Learn each character and what it means.",
        items: itemsFromFacts(l.facts, track),
        facts: l.facts,
        why: WHY_TRACK.kanji,
        over: l.over,
      };
    }
    case "word": {
      const l = nextWordLesson(history, settings.wordsPerLesson);
      if (!l) return null;
      return {
        track,
        label: `Words · lesson ${l.index}`,
        sub: "Words you can read now — learn what each one means.",
        items: itemsFromFacts(l.facts, track),
        facts: l.facts,
        why: WHY_TRACK.words,
      };
    }
    case "grammar": {
      const l = nextGrammarLesson(history, settings.grammarPerLesson);
      if (!l) return null;
      return {
        track,
        label: `Grammar · lesson ${l.index}`,
        sub: "Patterns for stringing words into sentences.",
        items: itemsFromFacts(l.facts, track),
        facts: l.facts,
        why: WHY_TRACK.grammar,
      };
    }
  }
}
