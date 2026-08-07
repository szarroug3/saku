// number-quiz.ts — the PROCEDURAL number-reading quiz generator.
//
// PURE: no React, no DOM, no Date.now/Math.random at module scope. It composes
// items from the pure reading engine in src/lib/number-reading.ts (numberReading,
// counterReading, and their acceptable-reading grading sets) — it never
// re-derives a reading of its own. An injectable `rng` makes every round
// deterministic under test, mirroring src/lib/engine/substitution.ts.
//
// IRREGULAR-FIRST
// ===============
// The value of drilling numbers is the sound shifts: 三百 さんびゃく, 八千 はっせん,
// 一本 いっぽん, 六匹 ろっぴき. So a round is assembled from a pool of MUST-INCLUDE
// irregular anchors first (the sound-shift bare numbers, the ones-digit branch
// readings 4/7/9, and each counter's irregular counts), and only then are the
// remaining slots FILLED with random regular items. A per-counter round with a
// large enough count therefore contains every irregular of that counter — the
// property counterIrregulars() names and number-quiz.test.ts pins.

import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
  type CounterKind,
} from "@/lib/number-reading";
import { romajiMatches } from "@/lib/romaji";

/** Injectable random source — () => [0,1). Same shape as the grammar engine's. */
export type Rng = () => number;

/**
 * The three ways a number showing can be asked — split like the drill asks a
 * word (see the drill screen). READ shows the digits and wants the reading; WRITE
 * shows the reading and wants the digits; HEAR plays the reading and wants the
 * digits. HEAR is WRITE's audio twin: same answer (the count), but the prompt is
 * the spoken word with the glyph hidden, the drill's listening card.
 */
export type NumberDirection = "read" | "write" | "hear";

/** One number-reading showing. Plain data so it can ride the screen's
 * serialized runtime, exactly like SubstitutionItem. */
export interface NumberQuizItem {
  /** Bare number, or a counted form. */
  readonly kind: "number" | "counter";
  /** The count / value being asked. */
  readonly n: number;
  /** The counter for a counted form, or null for a bare number. */
  readonly counter: CounterKind | null;
  /** READ: shown digits, answer is the reading. WRITE: shown reading, answer is
   * the digits. HEAR: the reading is PLAYED (glyph hidden), answer is the digits
   * — WRITE's audio twin, graded identically. */
  readonly direction: NumberDirection;
  /** The primary kana reading (numberReading or counterReading). */
  readonly reading: string;
  /** Every acceptable answer for the READ direction (branch/spelling alternates
   * included), from the reading engine's grading sets. */
  readonly accept: string[];
  /** String(n) — the answer for the WRITE direction. */
  readonly digits: string;
}

export interface NumberQuizConfig {
  /** How many items the round should contain. */
  readonly count: number;
  /** Whether counted forms may appear at all. */
  readonly includeCounters: boolean;
  /** The counters in play (ignored when includeCounters is false). */
  readonly counters: CounterKind[];
  /** Upper bound (inclusive) for bare numbers. */
  readonly numberMax: number;
  /** Directions the round may draw from. */
  readonly directions: NumberDirection[];
}

/**
 * The irregular counts of each counter — the counts whose reading carries a
 * sound change and so MUST be drilled. mai/dai are perfectly regular (none).
 * "tsu" is not composed at all (native ひとつ…とお); it is pure memorization, so
 * its "irregulars" are a representative sampler rather than derived shifts.
 * Every value here is ≤ 10, inside both counters' valid ranges.
 */
const IRREGULAR_COUNTS: Record<CounterKind, readonly number[]> = {
  tsu: [1, 2, 3, 5, 8, 10],
  nin: [1, 2, 4],
  hon: [1, 3, 6, 8, 10],
  hiki: [1, 3, 6, 8, 10],
  mai: [],
  ko: [1, 6, 8, 10],
  dai: [],
  satsu: [1, 8, 10],
  hai: [1, 3, 6, 8, 10],
  kai: [1, 6, 8, 10],
  sai: [1, 8, 10],
};

/** The bare numbers whose reading shifts sound: 三百 さんびゃく, 六百 ろっぴゃく,
 * 八百 はっぴゃく, 三千 さんぜん, 八千 はっせん. */
const BARE_SHIFTS: readonly number[] = [300, 600, 800, 3000, 8000];

/** The irregular counts of a counter — the drill-worthy sound shifts (or, for
 * tsu, the memorization sampler). Exported so the round's guarantee is
 * unit-testable: a per-counter round of sufficient count contains all of these. */
export function counterIrregulars(counter: CounterKind): number[] {
  return [...IRREGULAR_COUNTS[counter]];
}

/** Fisher–Yates, in place, with an injectable rng. */
function shuffle<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = xs[i];
    xs[i] = xs[j];
    xs[j] = t;
  }
  return xs;
}

/** The largest count a counter can take: tsu tops out at 10, the rest at 99. */
function counterMax(counter: CounterKind): number {
  return counter === "tsu" ? 10 : 99;
}

/** Build an item from (n, counter, direction), or null when the reading engine
 * refuses the pair (out of range). The reading and grading set come straight
 * from the engine — never hand-rolled here. */
export function makeItem(
  n: number,
  counter: CounterKind | null,
  direction: NumberDirection,
): NumberQuizItem | null {
  if (counter) {
    const reading = counterReading(n, counter);
    if (reading === null) return null;
    return {
      kind: "counter",
      n,
      counter,
      direction,
      reading,
      accept: acceptableCounterReadings(n, counter),
      digits: String(n),
    };
  }
  const reading = numberReading(n);
  if (!reading) return null;
  return {
    kind: "number",
    n,
    counter: null,
    direction,
    reading,
    accept: acceptableNumberReadings(n),
    digits: String(n),
  };
}

/** A bare number ≤ max whose ones digit is `ones` (so its final digit reads on a
 * branch: 4 し, 7 しち, 9 く). Falls back to `ones` itself when the range is tiny. */
function numberWithOnes(ones: number, max: number, rng: Rng): number {
  if (ones > max) return ones; // out of range; caller drops it if unreadable
  const tensSpan = Math.floor((max - ones) / 10);
  const tens = tensSpan > 0 ? Math.floor(rng() * (tensSpan + 1)) : 0;
  const n = tens * 10 + ones;
  return n >= 1 && n <= max ? n : ones;
}

interface Slot {
  readonly n: number;
  readonly counter: CounterKind | null;
}

function slotKey(slot: Slot): string {
  return `${slot.counter ?? ""}:${slot.n}`;
}

/**
 * Build one round IRREGULAR-FIRST: the must-include anchors (bare sound shifts,
 * branch readings, each counter's irregular counts), shuffled and taken up to
 * `count`, then FILLED with random regular items. Returns exactly `count` items,
 * or fewer only when the pool is genuinely too small. Directions are dealt
 * balanced across cfg.directions so a mixed config always shows both.
 */
export function buildNumberRound(
  cfg: NumberQuizConfig,
  rng: Rng,
): NumberQuizItem[] {
  const anchors: Slot[] = [];

  // Bare sound-shift numbers within range.
  for (const v of BARE_SHIFTS) {
    if (v <= cfg.numberMax) anchors.push({ n: v, counter: null });
  }
  // At least one ones-digit-4, -7, -9 for the branch readings.
  for (const ones of [4, 7, 9]) {
    anchors.push({ n: numberWithOnes(ones, cfg.numberMax, rng), counter: null });
  }
  // Each active counter's irregular counts.
  if (cfg.includeCounters) {
    for (const counter of cfg.counters) {
      for (const k of IRREGULAR_COUNTS[counter]) {
        if (k <= counterMax(counter)) anchors.push({ n: k, counter });
      }
    }
  }

  // Dedupe anchors, shuffle, take up to count.
  const seen = new Set<string>();
  const uniqueAnchors: Slot[] = [];
  for (const a of anchors) {
    const key = slotKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueAnchors.push(a);
  }
  shuffle(uniqueAnchors, rng);

  const slots: Slot[] = uniqueAnchors.slice(0, cfg.count);
  // Reset the dedupe set to the CHOSEN slots only, so a fill may reuse an anchor
  // value that didn't make the cut.
  seen.clear();
  for (const s of slots) seen.add(slotKey(s));

  // Fill remaining slots with random regular items, avoiding duplicates.
  const canCount = cfg.includeCounters && cfg.counters.length > 0;
  let attempts = 0;
  const maxAttempts = Math.max(200, cfg.count * 40);
  while (slots.length < cfg.count && attempts < maxAttempts) {
    attempts++;
    const useCounter = canCount && rng() < 0.5;
    let slot: Slot;
    if (useCounter) {
      const counter = cfg.counters[Math.floor(rng() * cfg.counters.length)];
      const hi = Math.min(counterMax(counter), cfg.numberMax);
      if (hi < 1) continue;
      const n = 1 + Math.floor(rng() * hi);
      slot = { n, counter };
    } else {
      const n = 1 + Math.floor(rng() * cfg.numberMax);
      slot = { n, counter: null };
    }
    const key = slotKey(slot);
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(slot);
  }

  // Deal directions balanced across the allowed set, then shuffle the deal so
  // direction doesn't correlate with position — every allowed direction always
  // appears when count ≥ directions.length.
  const dirPool: readonly NumberDirection[] =
    cfg.directions.length > 0 ? cfg.directions : (["read"] as const);
  const dirs: NumberDirection[] = slots.map((_, i) => dirPool[i % dirPool.length]);
  shuffle(dirs, rng);

  const items: NumberQuizItem[] = [];
  for (let i = 0; i < slots.length; i++) {
    const item = makeItem(slots[i].n, slots[i].counter, dirs[i]);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Roll ONE number-reading item for a construction-category drill showing.
 *
 * The fact-based Drill interleaves a generated count wherever a construction
 * CATEGORY fact (〜本, the tens, …) comes up — one item per showing, frozen on
 * the card (see drill-screen.tsx). This is that one item: a random count in the
 * category's range and a random direction from its config, composed through
 * `makeItem` so the reading and grading set are the engine's, never re-derived.
 *
 * Unlike `buildNumberRound` this is NOT irregular-first — a single showing is
 * one draw, and the irregular-coverage guarantee is a property of a whole round
 * (the lesson's number-reading leg keeps that). Returns null only when the
 * config can name no readable item, which the caller treats as "skip".
 */
export function rollConstructionItem(
  cfg: NumberQuizConfig,
  rng: Rng,
): NumberQuizItem | null {
  const dirPool: readonly NumberDirection[] =
    cfg.directions.length > 0 ? cfg.directions : (["read"] as const);
  const dir = dirPool[Math.floor(rng() * dirPool.length)];
  const canCount = cfg.includeCounters && cfg.counters.length > 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (canCount) {
      const counter = cfg.counters[Math.floor(rng() * cfg.counters.length)];
      const hi = Math.min(counterMax(counter), cfg.numberMax);
      if (hi < 1) continue;
      // Occasionally force an irregular count, so the sound shifts the category
      // exists to teach actually surface in the drill and not only in the lesson
      // round. The engine still owns the reading; this only steers which n.
      const irregs = IRREGULAR_COUNTS[counter].filter((k) => k <= hi);
      const n =
        irregs.length && rng() < 0.5
          ? irregs[Math.floor(rng() * irregs.length)]
          : 1 + Math.floor(rng() * hi);
      const item = makeItem(n, counter, dir);
      if (item) return item;
    } else {
      const n = 1 + Math.floor(rng() * cfg.numberMax);
      const item = makeItem(n, null, dir);
      if (item) return item;
    }
  }
  return null;
}

/** Normalize a typed WRITE answer: trim and fold full-width ０-９ to ASCII. */
function normalizeDigits(given: string): string {
  return given
    .trim()
    .replace(/[０-９]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
    );
}

/**
 * Grade a typed answer for a number-reading item.
 *
 * READ: the answer is a reading — folded romaji→kana and compared against every
 * acceptable reading via the app's own romajiMatches, so よんじゅうなな typed as
 * "yonjuunana" grades true, and the engine's branch/spelling alternates are all
 * honored. WRITE and HEAR: the answer is the count as digits — normalized and
 * compared to item.digits (さんぼん → 3, full-width ３ accepted). HEAR differs from
 * WRITE only in how the prompt is presented (audio vs. text), not in grading.
 */
export function gradeNumberItem(item: NumberQuizItem, given: string): boolean {
  if (item.direction === "read") {
    return item.accept.some((a) => romajiMatches(given, a));
  }
  return normalizeDigits(given) === item.digits;
}
