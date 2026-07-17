// Kana that look like a kanji, and the kanji that look like them — a DISTRACTOR
// SOURCE, and nothing else. Same rule as data/confusable.ts: it may make the
// lookalike appear as a WRONG option, and it may never reach a score. See the
// long note there; the difference here is only that the two glyphs live in
// different SUBJECTS (a katakana and a jōyō kanji), which is exactly the seam
// the same-script distractor fill can never cross on its own.
//
// WHY HAND-AUTHORED
// =================
// KanjiVG (stroke geometry) is not ingested, so there is nothing to derive
// these from — the resemblance is in the drawn shape, not in any component or
// reading data the app holds. So they are hand-verified, one pair at a time,
// against Unicode UTS #39 confusables.txt.
//
// The bar is the same as every other distractor table: would a learner reading
// at speed actually pick the wrong one. カ (katakana KA) and 力 (power) are two
// strokes in nearly the same arrangement; that is a real trap. A pair that only
// "kind of rhymes" is a free point and does not belong here.

/**
 * Katakana ↔ jōyō-kanji visual lookalikes. Each pair is one katakana and one
 * kanji; order within a pair is not significant.
 *
 * confusables.txt omits 才/オ as the one genuine coincidence rather than a
 * confusable; it is kept here anyway, as a real lookalike a beginner does mix
 * up. ト/卜 is intentionally absent — 卜 is grade-9 / unranked, so it is not a
 * character a learner meets early enough for the confusion to matter.
 */
export const CROSS_SCRIPT_LOOKALIKES: readonly (readonly [string, string])[] = [
  ["力", "カ"], // power / KA — both two strokes, same lean.
  ["口", "ロ"], // mouth / RO — the box, at kana size.
  ["工", "エ"], // craft / E — three horizontals and a stem.
  ["夕", "タ"], // evening / TA — one stroke's reach apart.
  ["才", "オ"], // genius / O — kept though confusables.txt drops it.
  ["十", "ナ"], // ten / NA — a cross vs a cross with a tail.
  ["八", "ハ"], // eight / HA — the same two falling strokes.
  ["七", "セ"], // seven / SE — one hook.
  ["木", "ホ"], // tree / HO — 木 with the legs pulled in.
];

/** glyph → the cross-script glyphs predicted to be confusable with it. */
const INDEX: ReadonlyMap<string, readonly string[]> = build();

function build(): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const [a, b] of CROSS_SCRIPT_LOOKALIKES) {
    (map.get(a) ?? map.set(a, []).get(a)!).push(b);
    (map.get(b) ?? map.set(b, []).get(b)!).push(a);
  }
  return map;
}

/** The cross-script lookalikes of `glyph`, or an empty array. */
export function crossScriptLookalikes(glyph: string): readonly string[] {
  return INDEX.get(glyph) ?? [];
}
