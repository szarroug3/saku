// Shared mora-counting for the pitch ingest scripts (SAK-281).
//
// WHY THIS IS ITS OWN FILE
// =========================
// pitch.mjs and pitch-pairs.mjs each carried their own copy of "count the
// morae in a kana reading," and the two copies had drifted: pitch.mjs's
// SMALL_KANA set was missing ゎ/ヮ (small wa), and it stripped every small
// kana unconditionally instead of only when it can bind to a preceding mora.
// A leading small kana — nothing can be lexically valid before it — has no
// mora to join, so it must count as one of its own; pitch-pairs.mjs already
// guarded for this, pitch.mjs did not.
//
// No current vocab word starts with a small kana or carries a small ゎ/ヮ, so
// the drift was dormant, not a live bug. But a landmine for the next word
// that does, so both scripts now import ONE implementation from here instead
// of maintaining their own.
//
// This mirrors src/lib/pitch.ts's `moraeOf` (that module's SMALL_KANA set and
// leading-small-kana handling are the ones this file matches) but stays a
// dependency-free duplicate rather than an import: ingest scripts are run
// with plain `node`, outside the app's react-server module graph, and
// src/lib/pitch.ts is a `.ts` file that graph is set up to load, not plain
// Node. Keep this in sync with src/lib/pitch.ts if that logic ever changes.

/**
 * A small (yōon) kana binds to the mora before it. きょ is ONE mora, not two.
 * っ, ん and ー are each their own mora and are NOT here.
 */
const SMALL_KANA = new Set([
  // hiragana
  "ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ",
  // katakana (readings are kana; be safe for either script)
  "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ", "ヮ",
]);

/** Count the morae of a kana reading. A mora is one beat of the language, and
 * kana map to it ALMOST one-to-one — the exceptions are the small y-glides
 * that form a yōon (きゃ, しゅ, ちょ) and the small vowels that form foreign
 * yōon (ファ, ウィ): those ride the preceding full kana and add no beat of
 * their own. Everything else is its own mora, INCLUDING the three that look
 * like they might not be — the long-vowel mark ー (コーヒー = ko-o-hi-i, 4),
 * the small っ sokuon (がっこう = ga-t-ko-o, 4), and ん (せんせい = se-n-se-e,
 * 4). A LEADING small kana has nothing before it to bind to, so it counts as
 * its own mora rather than vanishing — this is what a downstep is measured
 * against: an accent may fall on morae 0..moraCount, so any stored downstep
 * larger than this is impossible for the reading. */
export function moraCount(reading) {
  let n = 0;
  for (const c of reading) {
    if (SMALL_KANA.has(c) && n > 0) continue;
    n++;
  }
  return n;
}
