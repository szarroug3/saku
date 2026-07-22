// Turning a pitch-accent NUMBER into a high/low pattern over morae.
//
// The data (src/data/generated/pitch.json, ingested from Kanjium) gives each
// word one integer: the mora position of the downstep, in the standard 標準式
// notation.
//   0  heiban    — no downstep. Low on mora 1, high from mora 2 to the end, and
//                  a following particle stays high.
//   1  atamadaka — high on mora 1, drops immediately; every later mora low.
//   n  odaka / nakadaka — low on mora 1, high through mora n, drops after it.
//
// This module is the one place that knows how to draw that: it splits a reading
// into MORAE (not characters) and marks each high or low. It is pure and holds
// no React, so the renderer's notation can be pinned by a test — the whole point
// being that 箸, 橋, 端, 雨, 先生 come out with the patterns a dictionary prints
// and a word with no data comes out as nothing at all, never a default.

/**
 * A small (yōon) kana binds to the mora before it. きょ is ONE mora, not two,
 * so the downstep in きょう「1」 falls after きょ — counting characters would put
 * it in the wrong place. っ, ん and ー are each their own mora and are NOT here.
 */
const SMALL_KANA = new Set([
  // hiragana
  "ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ",
  // katakana (readings are kana; be safe for either script)
  "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ", "ヮ",
]);

/**
 * Split a kana reading into morae. Each small kana joins the mora before it;
 * everything else — including っ, ん and the long-vowel ー — is its own mora.
 *
 * せんせい → [せ, ん, せ, い] (4). きょう → [きょ, う] (2). An empty or
 * leading-small-kana string degrades gracefully: the small kana starts a mora
 * of its own rather than throwing.
 */
export function moraeOf(reading: string): string[] {
  const morae: string[] = [];
  for (const ch of reading) {
    if (SMALL_KANA.has(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else {
      morae.push(ch);
    }
  }
  return morae;
}

/** One mora of a reading, and whether the voice is high on it. */
export interface PitchMora {
  readonly text: string;
  readonly high: boolean;
  /** True on the LAST high mora before the voice drops — where the overline
   * turns down. Never set for heiban (0), which has no drop within the word. */
  readonly drop: boolean;
}

/**
 * The high/low pattern for a reading given its downstep position.
 *
 * high(i), 1-indexed:
 *   mora 1  → high only for atamadaka (downstep === 1)
 *   mora i>1 → high when heiban (downstep === 0), else while i ≤ downstep
 *
 * The drop sits on mora `downstep` when downstep ≥ 1 (the last high mora before
 * the fall). Heiban has no in-word drop.
 *
 * A downstep past the end of the word (bad data) simply yields no drop marker;
 * it never throws.
 */
export function pitchPattern(reading: string, downstep: number): PitchMora[] {
  const morae = moraeOf(reading);
  return morae.map((text, index) => {
    const pos = index + 1; // 1-indexed mora position
    const high =
      pos === 1 ? downstep === 1 : downstep === 0 || pos <= downstep;
    const drop = downstep >= 1 && pos === downstep;
    return { text, high, drop };
  });
}

/** English name of the accent class, for screen readers and any explainer copy.
 * DRAFT wording, minimal, for the owner's voice pass. */
export function accentName(downstep: number): string {
  if (downstep === 0) return "heiban (flat)";
  if (downstep === 1) return "atamadaka (drops after the first mora)";
  return `drops after mora ${downstep}`;
}
