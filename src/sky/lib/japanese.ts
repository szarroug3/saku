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
