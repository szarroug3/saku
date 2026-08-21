// The homophone-pair lookup pitch quiz questions prefer (SAK-128): words that
// share a reading and differ ONLY in verified pitch accent — 箸/橋, 雨/飴 — so
// a pitch question can ask "which one means X" over two REAL clips instead of
// falling back to a synthetic wrong-pitch distractor. See
// scripts/ingest/pitch-pairs.mjs for how the table is built and why a pair
// requires both words to carry a verified `wordPitch()` entry at DIFFERENT
// downsteps; absence here is exactly as normal as absence in pitch.ts — most
// words have no homophone partner in the curriculum at all, and that is fine.

import pitchPairsJson from "./generated/pitch-pairs.json" with { type: "json" };

type RawPair = readonly [string, string, string]; // [kebA, kebB, reading]

const PAIRS: readonly RawPair[] = pitchPairsJson as unknown as readonly RawPair[];

/** One homophone-pitch partner for a word. */
export interface PitchPair {
  /** The OTHER word in the pair — the caller already has `keb`. */
  readonly partner: string;
  /** The reading both words share (their taught reading — see
   * scripts/ingest/pitch-pairs.mjs's `taughtReading`). */
  readonly reading: string;
}

const BY_KEB: ReadonlyMap<string, readonly PitchPair[]> = (() => {
  const map = new Map<string, PitchPair[]>();
  const add = (keb: string, partner: string, reading: string) => {
    const list = map.get(keb);
    const pair = { partner, reading };
    if (list) list.push(pair);
    else map.set(keb, [pair]);
  };
  for (const [a, b, reading] of PAIRS) {
    add(a, b, reading);
    add(b, a, reading);
  }
  return map;
})();

/**
 * Every homophone-pitch partner curriculum vocab has for `keb`, or an empty
 * array when it has none — the normal case for most words (only 404 of
 * 12,553 words are covered, see the ingest script's coverage report). Never
 * fabricated: both sides of every pair here were verified, at ingest time,
 * to share a reading and carry different downsteps.
 */
export function pitchPairsFor(keb: string): readonly PitchPair[] {
  return BY_KEB.get(keb) ?? [];
}
