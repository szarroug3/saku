// Does this string contain Japanese writing?
//
// WHY THIS EXISTS. The app sets a --font-kana per theme (Mincho on aizome,
// Hiragino Sans on graphite, Maru Gothic on kiri) and every glyph slot decides
// for itself whether to use it. Those slots used to decide by KIND — "is this a
// kana step?" — so a kanji headword and a word headword fell through to
// --font-ui, which is -apple-system / Helvetica Neue / system-ui and has no CJK
// coverage at all. The OS then picked a Japanese face on its own, and on aizome
// you got a kana headword in Mincho beside a kanji headword in whatever macOS
// felt like. The theme's chosen face was skipped for most of the characters in
// the app.
//
// THE RULE IS ABOUT THE TEXT, NOT ABOUT THE ROW IT CAME FROM. A slot gets the
// Japanese font when the string it is showing actually contains a Japanese
// character. That keeps the three things that must NOT get it out by
// construction: a romaji reading, an English term name ("Counter", "Pitch
// accent" — the Terms shelf is English words), and a bare symbol like the ▲
// the practice picker uses for its shaky-items tile.
//
// A string that mixes the two — 〜すぎる with its wave dash, a word beside a
// latin gloss — counts as Japanese. Both faces have latin coverage, so the
// mixed case costs nothing, while splitting it per character would set one
// headword in two typefaces.

/**
 * Hiragana, katakana and Han, by script extension so the marks that belong to
 * Japanese without being letters come along: ー (the prolonged sound mark) is
 * Common with Hiragana/Katakana extensions, 々 (the repeat mark) is Common with
 * a Han extension.
 *
 * Plus the two tildes the grammar shelf writes its patterns with (〜てから,
 * ～すぎる). They are CJK punctuation, they carry no script extension of their
 * own, and a pattern is not going to render in the UI face because its first
 * character happens to be its placeholder.
 */
const JAPANESE =
  /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Han}〜～]/u;

/** True when `text` has at least one Japanese character in it. */
export function hasJapanese(text: string): boolean {
  return JAPANESE.test(text);
}

/**
 * `"font-kana"` for Japanese text and `""` for everything else — the one-liner
 * every glyph slot wants, so no call site re-derives the rule.
 */
export function japaneseFontClass(text: string): string {
  return hasJapanese(text) ? "font-kana" : "";
}
