// The deck model — WHAT a quiz draws from, as pure data.
//
// Home's shelves are all decks. The "Decks" shelf holds STATIC ones, derived
// from the character data; the "Target a weakness" shelf holds the same shape
// computed from history instead. The setup panel owns HOW you drill (mode,
// direction, answer style, length); a deck only ever answers WHICH characters.
//
// A deck answers WHICH, and NOTHING ELSE. There used to be a "Full coverage"
// deck that also reached over and set your length to one-pass-each — a card
// silently editing the setup panel, which is exactly what made Home confusing.
// It is now "Everything" (just the 214 characters); one-pass-each lives on as
// the Full coverage LENGTH chip, where a length belongs. If you are tempted to
// give a deck a side-effect again: don't. Decks are a set of characters.
//
// HOW TO EXTEND
// =============
// Adding a kanji or vocab set is a data addition, not a change here: append a
// CharSet to SETS in src/data/characters.ts and it grows a basic/extended deck
// pair automatically (`isExtendedSection` decides the split). Give it a face by
// adding a GLYPHS entry keyed "<setId>-basic" / "<setId>-extended" — without
// one it falls back to the set's first character, which still renders fine.
//
// Pure by contract: no React, no DOM, no fetch. Home renders these; it does
// not define them.

import {
  CHAR_INDEX,
  isExtendedSection,
  LOOKALIKES,
  SETS,
} from "@/data/characters";
import { accuracyOf } from "@/lib/accuracy";
import type {
  AccuracyMetric,
  CharSet,
  HistoryFile,
  QuizSessionRecord,
} from "@/types";

/** A named set of characters a quiz can draw from. */
export interface Deck {
  /** Stable id — React key, and what a click target reports. */
  id: string;
  label: string;
  /** The card's face: one representative character. */
  glyph: string;
  chars: string[];
}

/** Every character in the app, in data order. */
export const ALL_CHARS: string[] = Object.keys(CHAR_INDEX);

/** Card faces, keyed "<setId>-basic" / "<setId>-extended". A set with no entry
 * falls back to its own first character (see buildDecks). */
const GLYPHS: Record<string, string> = {
  "hiragana-basic": "あ",
  "hiragana-extended": "ぎゃ",
  "katakana-basic": "ア",
  "katakana-extended": "ギャ",
};

/** The id of the deck that is simply every character there is. */
export const EVERYTHING_ID = "everything";

function groupChars(set: CharSet, extended: boolean): string[] {
  return set.sections
    .filter((s) => isExtendedSection(s.label) === extended)
    .flatMap((s) => s.chars.map((c) => c.c));
}

function buildDecks(): Deck[] {
  const decks: Deck[] = [];
  for (const set of SETS) {
    for (const extended of [false, true]) {
      const chars = groupChars(set, extended);
      if (!chars.length) continue;
      const id = `${set.id}-${extended ? "extended" : "basic"}`;
      decks.push({
        id,
        label: `${set.label} ${extended ? "extended" : "basic"}`,
        glyph: GLYPHS[id] ?? chars[0],
        chars,
      });
    }
  }
  decks.push({
    id: EVERYTHING_ID,
    label: "Everything",
    glyph: "全",
    chars: ALL_CHARS,
  });
  return decks;
}

/** The static decks, in shelf order. */
export const DECKS: Deck[] = buildDecks();

// ---------- history-derived decks ----------

/**
 * The `n` characters you are worst at under `metric`, weakest first.
 *
 * Only characters with history count — an untouched character is unknown, not
 * weak. Ties break by `seen` descending, so a 0%-from-one-showing never
 * outranks a 0%-from-twenty: the latter is the better-evidenced weakness.
 */
export function weakestChars(
  history: HistoryFile,
  metric: AccuracyMetric,
  n = 20,
): string[] {
  const scored: Array<{ c: string; acc: number; seen: number }> = [];
  for (const [c, agg] of Object.entries(history.chars)) {
    // Guard against history for characters the data no longer has.
    if (!agg.seen || !CHAR_INDEX[c]) continue;
    const acc = accuracyOf(agg, metric);
    if (acc === null) continue;
    scored.push({ c, acc, seen: agg.seen });
  }
  scored.sort((a, b) => a.acc - b.acc || b.seen - a.seen);
  return scored.slice(0, n).map((s) => s.c);
}

/** Two characters you mix up, and how often. `count` is 0 for lookalikes. */
export interface ConfusionPair {
  a: string;
  b: string;
  /** Times the two were swapped across all sessions; 0 when unmeasured. */
  count: number;
}

export interface Confusions {
  /** Most-confused first. */
  pairs: ConfusionPair[];
  /** The unique characters across `pairs` — the deck to drill. */
  chars: string[];
  /** True when these are MEASURED mix-ups; false when they're the day-one
   * LOOKALIKES fallback, which must be labelled "common lookalikes" rather
   * than claiming a count the user never produced. */
  fromHistory: boolean;
}

/**
 * The mix-up pairs across every stored session.
 *
 * Mirrors engine.confusionPairs() (which reads a single SessionStats) over all
 * of history: each session's `detail[char].confused` counts one direction, so
 * summing on a sorted key folds "a said for b" and "b said for a" into one
 * symmetric pair.
 *
 * With no measured confusions — day one, or history from a version that never
 * stored `detail` — falls back to the LOOKALIKES groups restricted to
 * `enabled`, so the card still starts a useful quiz. Check `fromHistory`
 * before claiming a count.
 */
export function confusionDecks(
  history: HistoryFile,
  enabled: string[] = ALL_CHARS,
): Confusions {
  const counts = new Map<string, number>();
  for (const session of history.sessions) {
    for (const [c, d] of Object.entries(session.detail ?? {})) {
      for (const [x, n] of Object.entries(d.confused ?? {})) {
        if (c === x || !n) continue;
        const key = [c, x].sort().join("·");
        counts.set(key, (counts.get(key) ?? 0) + n);
      }
    }
  }

  if (counts.size) {
    const pairs = [...counts.entries()]
      .map(([key, count]) => {
        const [a, b] = key.split("·");
        return { a, b, count };
      })
      .sort((p, q) => q.count - p.count);
    return { pairs, chars: charsOf(pairs), fromHistory: true };
  }

  const on = new Set(enabled);
  const pairs: ConfusionPair[] = [];
  for (const group of LOOKALIKES) {
    const members = group.filter((c) => on.has(c));
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        pairs.push({ a: members[i], b: members[j], count: 0 });
      }
    }
  }
  return { pairs, chars: charsOf(pairs), fromHistory: false };
}

function charsOf(pairs: ConfusionPair[]): string[] {
  return [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
}

/** The most recent session, or null when there is no history. */
export function lastSession(history: HistoryFile): QuizSessionRecord | null {
  let latest: QuizSessionRecord | null = null;
  for (const s of history.sessions) if (!latest || s.ts > latest.ts) latest = s;
  return latest;
}

/**
 * Characters missed in the most recent session, most misses first.
 *
 * "Missed" is the forgiving reading — wrong at least once, or never gotten
 * right — matching engine.missedChars(stats, "forg") and the Results screen's
 * "Redrill the misses". Empty when there are no sessions, or when the latest
 * one predates per-character detail.
 */
export function lastMisses(history: HistoryFile): string[] {
  const detail = lastSession(history)?.detail;
  if (!detail) return [];
  return Object.entries(detail)
    .filter(([, d]) => d.misses > 0 || !d.everCorrect)
    .sort((a, b) => b[1].misses - a[1].misses)
    .map(([c]) => c);
}
