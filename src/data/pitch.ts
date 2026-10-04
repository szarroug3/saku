// The pitch-accent lookup: one downstep position per word, keyed by written
// form. Ingested from the Kanjium database — see scripts/ingest/pitch.mjs for
// what it is, why only the unambiguous rows are kept, and the license.
//
// 9,428 of the 12,553 words (75.1%) carry a verified pitch, kana-only words
// like はい and うっかり included (SAK-503). The rest have none,
// and that is deliberate: a word whose accent Kanjium records more than one way,
// or that is not in the database, stores NO pitch rather than a guessed one, so
// `wordPitch` returning null is the normal shape for a quarter of the vocabulary
// and the renderer draws nothing at all for it, never a default mark.

import pitchJson from "./generated/pitch.json" with { type: "json" };

const PITCH: Record<string, number> = pitchJson as Record<string, number>;

/**
 * The downstep position for a word, or null when none is stored.
 *
 * Keyed on the written form (keb), which is unique across the vocabulary; the
 * ingest has already checked the reading agreed before writing the row, so a
 * hit here is safe to render against that word's reb. 箸 → 1, 橋 → 2, 端 → 0,
 * a word with no verified accent → null.
 */
/** The subject of a pitch fact (`word:<keb>/pitch`, SAK-344); see
 * src/data/pitch-facts.ts for the facts themselves. Here so the drill can
 * name it without loading the registry. */
export const PITCH_SUBJECT = "pitch";

/** True for a pitch fact's id. */
export function isPitchFact(fact: string): boolean {
  return fact.endsWith("/pitch");
}

export function wordPitch(keb: string): number | null {
  const value = PITCH[keb];
  return value === undefined ? null : value;
}
