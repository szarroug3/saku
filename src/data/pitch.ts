// The pitch-accent lookup: one downstep position per word, keyed by written
// form. Ingested from the Kanjium database — see scripts/ingest/pitch.mjs for
// what it is, why only the unambiguous rows are kept, and the licence.
//
// 8,683 of the 12,553 words (69.2%) carry a verified pitch. The rest have none,
// and that is deliberate: a word whose accent Kanjium records more than one way,
// or that is not in the database, stores NO pitch rather than a guessed one, so
// `wordPitch` returning null is the normal shape for a third of the vocabulary
// and the renderer draws nothing at all for it — never a default mark.

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
export function wordPitch(keb: string): number | null {
  const value = PITCH[keb];
  return value === undefined ? null : value;
}
