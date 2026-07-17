// Local types for the conjugation engine.
//
// This library is deliberately STANDALONE: it imports nothing from the app
// (no `@/types`, no `@/data`, no config). It takes a word + a class name and
// returns strings. Keep it that way — the app's data model is not our problem.

/**
 * Conjugation classes we support, named exactly as JMdict `<pos>` entity tags.
 *
 * This is 19 verb classes + 3 adjective classes. Everything else JMdict offers
 * is either archaic or not a conjugation class at all — see `policy.ts`.
 */
export type WordClass =
  // --- godan (五段) ---
  | "v5u" // 買う
  | "v5k" // 書く
  | "v5g" // 泳ぐ
  | "v5s" // 話す
  | "v5t" // 待つ
  | "v5n" // 死ぬ
  | "v5b" // 遊ぶ
  | "v5m" // 読む
  | "v5r" // 帰る
  | "v5aru" // 下さる — irregular い-stem
  | "v5r-i" // ある — suppletive negative
  | "v5k-s" // 行く — irregular 音便
  | "v5u-s" // 問う — irregular 音便
  // --- ichidan (一段) ---
  | "v1" // 食べる
  | "v1-s" // くれる — imperative くれ, not くれろ
  // --- irregular / suppletive ---
  | "vs-i" // する, 勉強する
  | "vs-s" // 愛する
  | "vk" // くる
  | "vz" // 演ずる
  // --- adjectives ---
  | "adj-i" // 高い
  | "adj-ix" // いい / よい
  | "adj-na"; // 静か

/** Every form the engine can generate. */
export type Form =
  | "dictionary"
  | "masu"
  | "masuPast"
  | "masuNegative"
  | "te"
  | "ta"
  | "nai"
  | "naiPast"
  | "potential"
  | "passive"
  | "causative"
  | "causativePassive"
  | "imperative"
  | "volitional"
  | "ba"
  | "tara"
  | "tai"
  | "teiru"
  /**
   * The bare attachment stem — 連用形 for a verb (話し, 食べ, し, き), the
   * い-less stem for an adjective (高, よ, 静か).
   *
   * Not a word on its own, and that is why it's here: it is the single most
   * productive ATTACHMENT POINT in beginner grammar. 〜ながら, 〜すぎる,
   * 〜やすい, 〜にくい, 〜方, and V-stem 〜そう all hang off it. Without it
   * every one of those patterns would have to spell "masu minus ます" itself,
   * which is the rules table leaking into its callers.
   *
   * Verbs derive it (masu − ます) so the 音便/vowel-row machinery stays the one
   * source of truth; adjectives list it, because their stem is a trim of the
   * dictionary form and their tables already know the trim.
   */
  | "stem"
  | "adverb" // adjectives only: 高く / 静かに
  | "prenominal" // adjectives only: 高い本 / 静かな本
  | "polite"; // adjectives only: 高いです

/**
 * The four vowel-row stems of a godan verb, plus the two 音便 stems.
 * For ichidan verbs a/i/e/o all collapse to the bare stem.
 */
export type StemKey = "a" | "i" | "e" | "o" | "te" | "ta";

/** One row of the 9x4 vowel-shift table. */
export interface Row {
  a: string;
  i: string;
  e: string;
  o: string;
}

/** One outcome of the 音便 branch. */
export interface Onbin {
  te: string;
  ta: string;
}

/** Why we refused to generate. Refusing loudly is the entire point. */
export type RefusalReason =
  /** Tag isn't a conjugation class at all (`vs`, `n`, ...). See policy.ts. */
  | "not-a-conjugation-class"
  /** Classical/archaic class (v2*, v4*, vr, vn). Out of scope for a drill. */
  | "archaic-class"
  /** Tag is unknown to us entirely. */
  | "unknown-class"
  /** The word exists but this form of it does not (ある has no potential). */
  | "defective"
  /** This class has no such form (verbs have no `prenominal`). */
  | "form-not-in-class"
  /** The word doesn't have the shape its class claims (v5k not ending in く). */
  | "malformed";

export type ConjugateResult =
  | { ok: true; value: string }
  | { ok: false; reason: RefusalReason; detail: string };
