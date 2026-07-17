// Scale the drill glyph so a WORD fits on one line inside the halo.
//
// The drill used a fixed font size (GLYPH_PX for a Japanese glyph, 0.6× that
// for latin answer text). A single kana/kanji fits the halo's hole with room
// to spare, but a multi-character word — あなた, 先生, ありがとうございます —
// is as many times wider, so it overflowed the ring and wrapped to two lines.
//
// The fix is to size the glyph to its content: one character stays at its base
// size (nothing shrinks a lone 生), and longer content scales DOWN by its
// estimated rendered width until it fits GLYPH_FIT_PX on one line. There is a
// floor — a phrase long enough to fall below it sits AT the floor and accepts a
// little overflow rather than becoming illegibly tiny, which only happens past
// the beginner curriculum (~12+ characters).
//
// Pure and React-free on purpose: the drill screen owns the layout, this owns
// the arithmetic, and Node's type-stripping can load it directly for the test.

/** Usable one-line width, in px, for the glyph inside the ring. The halo hole
 * is radius 84 (diameter 168); this insets a touch so the text keeps clear of
 * the band. Not imported from drill-halo.tsx so this stays a pure module. */
export const GLYPH_FIT_PX = 150;

/** The smallest the glyph is allowed to shrink to. Sized so the longest
 * everyday phrase (ありがとうございます, 10 chars) still lands on one line inside
 * the halo; a rarer, longer phrase sits here and overflows slightly. */
export const GLYPH_MIN_PX = 15;

/** Estimated per-character advance as a fraction of the font size. CJK glyphs
 * are full-width (~1em, with a hair of safety); latin answer text averages far
 * narrower. An estimate, not a measurement — it only has to keep content from
 * wrapping, and erring wide just makes a long word a shade smaller. */
function charAdvance(jp: boolean): number {
  return jp ? 1.05 : 0.6;
}

/**
 * Font size (px) that keeps `text` on ONE line inside the halo.
 *
 * `base` is the size a single glyph would use (GLYPH_PX for the Japanese side,
 * 0.6× for the latin side — the drill's existing distinction, preserved). One
 * character returns `base` untouched; multi-character content scales down by
 * its estimated width to fit GLYPH_FIT_PX, never below GLYPH_MIN_PX.
 */
export function fitGlyphSize(text: string, jp: boolean, base: number): number {
  // Code points, not UTF-16 units — a surrogate-pair glyph is one character.
  const chars = [...text].length;
  if (chars <= 1) return base;
  const width = chars * charAdvance(jp) * base;
  if (width <= GLYPH_FIT_PX) return base;
  return Math.max(GLYPH_MIN_PX, Math.floor((GLYPH_FIT_PX / width) * base));
}
