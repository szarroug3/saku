// The Sky redesign's own copy of the "is this Japanese" check.
//
// The app has an equivalent in @/lib/japanese-text, but the Sky redesign does not import
// from the existing tree (see README). Three lines duplicated is cheaper than a
// dependency that has to be untangled at cutover.

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/;

/** `font-kana` when the text contains Japanese, so it renders in the theme's
 * Japanese face rather than the UI face. Empty string otherwise. */
export function japaneseFont(text: string): string {
  return JAPANESE.test(text) ? "font-kana" : "";
}

/**
 * The size Japanese is drawn at so that `glyphs` of it fit across `width`.
 *
 * A Japanese character is about as wide as the type is tall, which is what
 * makes this possible without measuring anything: the size that fits n of them
 * across a box is the box's width over n. Capped at `max`, which is the one
 * size everything short shares, and floored at `min`, below which it stops
 * being readable and the caller should be wrapping or scrolling instead.
 */
function fitJapanese(text: string, width: number, max: number, min: number): number {
  const glyphs = [...text].length;
  if (glyphs === 0) return max;
  return Math.max(min, Math.min(max, Math.floor(width / glyphs)));
}

/**
 * The size a Japanese prompt is drawn at (SAK-390).
 *
 * Every short prompt gets the same size, which is the thing that was wrong:
 * two characters were drawn at 64px and three at 36, so 待つ was huge and
 * 食べる, one character longer, was nearly half of it, and card to card it
 * read as the quiz changing its mind.
 *
 * Length is handled by fitting instead of by a step. A Japanese character is
 * about as wide as the type is tall, so the size that fits n of them across
 * the card is the width over n, capped at the one size short prompts share.
 * Everything up to six characters is that one size; past that it comes down
 * smoothly, because a sentence cannot be 64px and should not pretend to be.
 *
 * English is not covered: it keeps its own smaller size, since it is a
 * different kind of thing to read and its letters are not square.
 */
export function promptSize(text: string): number {
  // 420 is the card's inner column at its narrowest, which is the width the
  // prompt has with the list of cards open beside it on the smallest screen
  // that shows both. Fitting the tightest case means it never reflows when
  // that panel opens.
  return fitJapanese(text, 420, 64, 22);
}

/**
 * The size a Japanese answer is drawn at on a multiple-choice tile (SAK-391).
 *
 * The board is three fixed columns, so a label longer than its tile used to
 * wrap — and Japanese has no spaces, so the break fell inside the word.
 * 行ってはいけない broke in half next to 行ってから sitting on one line.
 *
 * The tile keeps its place in the grid and the text comes down to fit it
 * instead, so the board stays a board and no word is ever broken. 118 is a
 * tile's width less its padding at the narrowest the grid gets.
 */
export function optionSize(text: string): number {
  return fitJapanese(text, 118, 18, 11);
}
