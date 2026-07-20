// The shape of a transitive/intransitive pair: which way its endings differ, or
// that it does not fit any rule.
//
// WHY THIS EXISTS, AND WHAT IT DOES NOT CLAIM
// ===========================================
// You cannot DERIVE one verb of a pair from the other: the same ending contrast
// runs both directions in the language (開く/開ける is -く→-ける, 焼ける/焼く is
// the reverse), so a shape never tells you which verb is the intransitive one.
// That is why the teach card still makes you learn each pair as a pair, and why
// transitivity.ts refuses to generate pairs mechanically.
//
// But the shapes ARE worth naming once both verbs are in front of you: most
// pairs share a kanji and change only their kana tail, and that tail shift is
// usually one of a small set. Naming it turns "two words to memorise" into "the
// familiar -ある/-える swap again", which is a real aid to memory even though it
// is no help at derivation. So this module DESCRIBES the tail shift for a pair
// that already exists; it never PRODUCES a partner.
//
// The match is on the READINGS, not the written forms, and after the shared kana
// stem is removed, so 集まる/集める is seen as まる→める on the stem あつ. A pair
// whose readings share no stem (出る/だす), or whose tails fit none of the rules
// below (乗る/乗せる), is an exception: honest to mark, and left for the learner
// to hold on its own.

/** A kana's consonant column and vowel. The column groups the whole row (た ち
 * つ て と all share "t"), which is what a kana-level alternation cares about;
 * the romaji ち=chi/と=to split is a spelling artifact, not a kana one. */
const KANA: Record<string, readonly [string, string]> = {
  あ: ["", "a"], い: ["", "i"], う: ["", "u"], え: ["", "e"], お: ["", "o"],
  か: ["k", "a"], き: ["k", "i"], く: ["k", "u"], け: ["k", "e"], こ: ["k", "o"],
  が: ["g", "a"], ぎ: ["g", "i"], ぐ: ["g", "u"], げ: ["g", "e"], ご: ["g", "o"],
  さ: ["s", "a"], し: ["s", "i"], す: ["s", "u"], せ: ["s", "e"], そ: ["s", "o"],
  ざ: ["z", "a"], じ: ["z", "i"], ず: ["z", "u"], ぜ: ["z", "e"], ぞ: ["z", "o"],
  た: ["t", "a"], ち: ["t", "i"], つ: ["t", "u"], て: ["t", "e"], と: ["t", "o"],
  だ: ["d", "a"], ぢ: ["d", "i"], づ: ["d", "u"], で: ["d", "e"], ど: ["d", "o"],
  な: ["n", "a"], に: ["n", "i"], ぬ: ["n", "u"], ね: ["n", "e"], の: ["n", "o"],
  は: ["h", "a"], ひ: ["h", "i"], ふ: ["h", "u"], へ: ["h", "e"], ほ: ["h", "o"],
  ば: ["b", "a"], び: ["b", "i"], ぶ: ["b", "u"], べ: ["b", "e"], ぼ: ["b", "o"],
  ぱ: ["p", "a"], ぴ: ["p", "i"], ぷ: ["p", "u"], ぺ: ["p", "e"], ぽ: ["p", "o"],
  ま: ["m", "a"], み: ["m", "i"], む: ["m", "u"], め: ["m", "e"], も: ["m", "o"],
  や: ["y", "a"], ゆ: ["y", "u"], よ: ["y", "o"],
  ら: ["r", "a"], り: ["r", "i"], る: ["r", "u"], れ: ["r", "e"], ろ: ["r", "o"],
  わ: ["w", "a"], を: ["w", "o"],
};
const col = (k: string): string => KANA[k]?.[0] ?? "?";
const vow = (k: string): string => KANA[k]?.[1] ?? "?";

function sharedStem(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/** How a pair's endings differ. `from`/`to` are the intransitive and transitive
 * tails to show (with a leading dash), or null when the pair fits no rule. */
export interface PairPattern {
  /** A short id: the rule letter, or "exception". Stable, for keys and tests. */
  readonly id: string;
  /** The intransitive tail, e.g. "-ある". Null for an exception. */
  readonly from: string | null;
  /** The transitive tail, e.g. "-える". Null for an exception. */
  readonly to: string | null;
  readonly isException: boolean;
}

const EXCEPTION: PairPattern = { id: "exception", from: null, to: null, isException: true };
const rule = (id: string, from: string, to: string): PairPattern => ({
  id,
  from,
  to,
  isException: false,
});

/**
 * Name the tail shift between a pair's two readings, or mark it an exception.
 *
 * `happensReading` is the intransitive verb's reading, `doItReading` the
 * transitive one. The order matters: the rules are directional labels, not a
 * claim that the direction is predictable.
 */
export function pairPattern(happensReading: string, doItReading: string): PairPattern {
  const stem = sharedStem(happensReading, doItReading);
  if (stem.length === 0) return EXCEPTION; // no shared reading stem to point at
  const a = happensReading.slice(stem.length); // intransitive tail
  const b = doItReading.slice(stem.length); // transitive tail
  const oneKanaRu = (t: string): boolean => t.length === 2 && t[1] === "る";
  const suTail = (t: string): boolean =>
    t === "す" || t === "らす" || (t.length === 2 && t[1] === "す");

  // -ある / -える  (まる→める, and the w-drop わる→える)
  if (oneKanaRu(a) && oneKanaRu(b) && vow(a[0]) === "a" && vow(b[0]) === "e")
    return rule("A", "-ある", "-える");
  // -う (godan, not る) / -える
  if (a.length === 1 && a !== "る" && vow(a) === "u" && oneKanaRu(b) && vow(b[0]) === "e")
    return rule("B", "-う", "-える");
  // -れる / -る
  if (a === "れる" && b === "る") return rule("C", "-れる", "-る");
  // -れる / -す
  if (a === "れる" && suTail(b)) return rule("D", "-れる", "-す");
  // -る / -す (or -らす)
  if (a === "る" && suTail(b)) return rule("E", "-る", "-す");
  // -う / -あす  (わく→わかす: same column, u→a)
  if (
    a.length === 1 && a !== "る" && vow(a) === "u" &&
    b.length === 2 && b[1] === "す" && vow(b[0]) === "a" && col(a) === col(b[0])
  )
    return rule("F", "-う", "-あす");
  // -える / -やす
  if (oneKanaRu(a) && vow(a[0]) === "e" && b === "やす") return rule("G", "-える", "-やす");
  // -いる / -おす  (same column, i→o)
  if (
    oneKanaRu(a) && vow(a[0]) === "i" &&
    b.length === 2 && b[1] === "す" && vow(b[0]) === "o" && col(a[0]) === col(b[0])
  )
    return rule("H", "-いる", "-おす");
  // -える / -あす  (same column, e→a)
  if (
    oneKanaRu(a) && vow(a[0]) === "e" &&
    b.length === 2 && b[1] === "す" && vow(b[0]) === "a" && col(a[0]) === col(b[0])
  )
    return rule("J", "-える", "-あす");
  // -える / -く  (the one reverse: ichidan drops え to a godan -う). Checked last
  // so the far more common -れる shapes above claim their pairs first.
  if (oneKanaRu(a) && vow(a[0]) === "e" && b.length === 1 && vow(b) === "u" && col(a[0]) === col(b))
    return rule("I", "-える", "-く");
  return EXCEPTION;
}
