// The two identities everything else is keyed by, and what a consumer may know
// about a fact. The root of src/types: the Sky's own shapes (sky.ts) and the
// store's rows (store.ts) both speak this vocabulary, and it depends on
// neither, which is what keeps the split acyclic. Read through @/types.

// ---------- identity: entries and facts ----------
//
// A character string used to be three things at once: the identity, the
// display glyph, and the primary key. For 214 kana that is elegant. It breaks
// on kanji — and not on collisions, on GRANULARITY.
//
// `history.chars["生"]` held exactly ONE accuracy. 生 has ~11 readings. There
// was nowhere to put セイ-at-88% and ショウ-at-22%, so the app would report
// "生: 61%" — a number true of nothing — and then drill the reading you
// already own.
//
// So identity splits in two:
//
//   Entry — what you look up.  `kanji:生`, `word:先生`, `kana:し`.
//   Fact  — one thing you can be ASKED. 生 is 1 meaning + ~10 readings, each
//           reading keyed on (kanji, word) — never on the kanji alone, because
//           "what is the reading of 生" has eleven answers and cannot be graded.
//
// Facts key history, score accuracy, and feed drills. Entries are what you
// browse, and what confusions are paired by (you mix up 生 and 先, not one of
// 生's readings with one of 先's).
//
// BOTH IDS ARE OPAQUE. The grammar above is illustrative, not an API: ids are
// minted in src/lib/fact-id.ts and resolved by lookup in src/lib/facts.ts.
// Nothing else may parse one. The moment a call site does
// `id.startsWith("kana:")` the model is welded shut, and kanji / vocabulary /
// grammar / counters / whatever comes next becomes a special case instead of
// another row of data.
//
// The brands are load-bearing, in both directions:
//   - `Record<FactId, T>` will NOT accept a bare `string` index. Reaching into
//     history or a run's stats with an un-narrowed string is a compile error.
//   - a function taking `FactId[]` will not accept `EntryId[]`, or vice versa.
// `Object.keys()` still widens back to `string[]`; src/lib/facts.ts `factKeys`
// / `entryKeys` are the sanctioned places to restore the brand, so the cast is
// spelled in one file rather than at every walk.

declare const ENTRY_BRAND: unique symbol;
declare const FACT_BRAND: unique symbol;

/** What you look up. Opaque — mint with src/lib/fact-id.ts, resolve with
 * src/lib/facts.ts. Never parse one. */
export type EntryId = string & { readonly [ENTRY_BRAND]: true };

/** One askable thing — the unit history, accuracy and drilling are keyed by.
 * Opaque; see EntryId. */
export type FactId = string & { readonly [FACT_BRAND]: true };

/**
 * What a generic consumer is allowed to know about a fact.
 *
 * Subject-agnostic on purpose: a screen renders `glyph` and checks `answers`
 * without knowing whether it is looking at kana, a kanji reading, or a
 * conjugation.
 *
 * Deliberately THIN. Everything a subject knows about its own material —
 * kana's script and row, its mnemonics, a kanji's radicals — stays in that
 * subject's module (src/data/characters.ts and CHAR_INDEX, for kana) and is
 * read by that subject's own screens. Fields get promoted here when something
 * generic needs them, not in anticipation.
 */
export interface FactInfo {
  readonly id: FactId;
  /** The entry this fact belongs to. One entry, many facts. */
  readonly entry: EntryId;
  /** What the entry looks like on screen — し, 生, 先生. DISPLAY ONLY: it is
   * not an identity and two entries may legitimately share one. */
  readonly glyph: string;
  /** Accepted answers; the first is the canonical one to display. */
  readonly answers: readonly string[];
  /** Which subject minted this — "kana" today. Carried so that nobody has to
   * infer a subject by parsing an id. */
  readonly subject: string;
  readonly meaning: string | null;
}
