// Which track a lesson item belongs to, and whether that track is OPENING right
// now — the gate the track intro cards ride in on.
//
// NO NEW PROGRESSION SYSTEM, AND THERE WAS NO NEED FOR ONE
// =======================================================
// The app already answers "has this track been opened" several times over —
// hasStartedWordTrack, hasStartedGrammarTrack, hasStartedTransitivityTrack —
// each of them the same shape: is any curriculum item of this track non-fresh in
// history. There is no cursor and no flag on disk anywhere in this app; history
// IS the cursor. This module generalises that existing answer to all the tracks
// rather than adding another thing to keep in step. (Radicals no longer have a
// SCHEDULING track of their own — they are woven into the kanji sets, see
// kanji-lesson.ts — but "radical" is still a TrackId with an intro card, so the
// first woven radical still opens with an explanation of what a radical is.)
//
// It reads history the other way round from those, though, and the difference is
// the point. They walk the CURRICULUM asking history about each item (6,213
// words). This walks HISTORY asking which track each
// fact belongs to, because the question here is "which tracks has this learner
// touched at all", and history is the smaller of the two by orders of magnitude
// on the run that matters — the first lesson, where history is nearly empty and
// the answer is "none of them".
//
// WHY THE TEACH SET IS EXCLUDED
// =============================
// A track intro has to be decided from what the learner knew BEFORE this lesson,
// and the lesson's own facts are already in history by the time the walk renders
// it: the words track marks its facts seen on Start (see startWordLesson in
// src/app/page.tsx), precisely so that teaching a word unlocks its kanji's
// readings whichever button you pressed. Counting those would make the words
// track "already started" at the exact moment it started, and the card would
// never fire.
//
// The cost of excluding them is that re-teaching a track's first lesson shows its
// card again. That is the same answer the phase intros already give ("a group
// re-taught later shows its card again, which is the right answer for a card
// whose whole job is to explain the material") and it is the right one here too:
// the alternative is a learner who resets and re-walks lesson one being dropped
// into hiragana with the word "romaji" undefined.

import { CHAR_INDEX, KANA_SUBJECT } from "@/data/characters";
import { COUNTER_ENTRIES } from "@/data/counters";
import { KEIGO_ENTRIES } from "@/data/keigo";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB_SUBJECT } from "@/data/vocab";
import type { TrackId } from "@/data/track-intros";
import { effectiveState } from "@/lib/claims";
import { factInfo } from "@/lib/facts";
import type { LessonItem } from "@/lib/lesson-items";
import type { FactId, HistoryFile } from "@/types";

/** Subject id → the track it opens, for the subjects that are one track each.
 * `kana` is absent because it is TWO tracks and needs the glyph to tell them
 * apart; `transitivity` is absent because its opening card is gated elsewhere
 * (see TRACK_INTROS). */
const TRACK_OF_SUBJECT: Readonly<Record<string, TrackId>> = {
  [RADICAL_SUBJECT]: "radical",
  [KANJI_SUBJECT]: "kanji",
  [VOCAB_SUBJECT]: "word",
  [GRAMMAR_SUBJECT]: "grammar",
};

/**
 * The track a subject-and-glyph pair belongs to, or null for anything with no
 * opening card.
 *
 * The kana fork is a LOOKUP, never a parse: CHAR_INDEX carries each character's
 * set, so ア resolves to katakana because the data file says so and not because
 * the glyph is in some code range. A character the app no longer ships resolves
 * to null rather than guessing, which is the same degradation itemsFromFacts
 * takes when history outlives the dictionaries.
 */
export function trackOf(subject: string | undefined, glyph: string): TrackId | null {
  if (subject === KANA_SUBJECT) {
    const set = CHAR_INDEX[glyph]?.set;
    return set === "hiragana" || set === "katakana" ? set : null;
  }
  return subject ? (TRACK_OF_SUBJECT[subject] ?? null) : null;
}

/** The track a walk item belongs to. A counters-track entry is routed by its
 * ENTRY, not its subject: a counter is a `word` fact carrying a track label (see
 * COUNTER_ENTRIES in src/data/counters.ts), so it must be told apart from the
 * general words track by the one thing that distinguishes it. */
export function trackOfItem(item: LessonItem): TrackId | null {
  if (COUNTER_ENTRIES.has(item.entry)) return "counters";
  if (KEIGO_ENTRIES.has(item.entry)) return "keigo";
  return trackOf(item.kind, item.glyph);
}

/** The track a fact belongs to — by its entry's label first (counters), then its
 * subject through the registry, never a parse of the id. */
function trackOfFact(fact: FactId): TrackId | null {
  const info = factInfo(fact);
  if (!info) return null;
  if (COUNTER_ENTRIES.has(info.entry)) return "counters";
  if (KEIGO_ENTRIES.has(info.entry)) return "keigo";
  return trackOf(info.subject, info.glyph);
}

/** Has the app any record of this fact — answered, claimed, or "quiz me"'d? The
 * one definition of "new", the same `lastTested === 0` rule the four
 * hasStarted*Track predicates use. */
function met(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested !== 0;
}

/**
 * Every track the learner has already touched, ignoring the facts of the lesson
 * they are about to be taught.
 *
 * A track is absent from the result exactly when its first lesson is the one in
 * hand — which is when its intro card is due.
 */
export function startedTracks(
  history: HistoryFile,
  exclude: ReadonlySet<FactId>,
): Set<TrackId> {
  const started = new Set<TrackId>();
  // All three records, because any of them makes a fact met: what you answered,
  // what you claimed, and what you asked to be quizzed on.
  const seen = new Set<string>([
    ...Object.keys(history.facts ?? {}),
    ...Object.keys(history.claims ?? {}),
    ...Object.keys(history.seen ?? {}),
  ]);
  for (const key of seen) {
    const fact = key as FactId;
    if (exclude.has(fact)) continue;
    if (!met(fact, history)) continue;
    const track = trackOfFact(fact);
    if (track) started.add(track);
  }
  return started;
}
