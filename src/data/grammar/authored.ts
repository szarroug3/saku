// Hand-authored grammar examples — the one lane the Tatoeba corpus cannot fill.
//
// WHY THIS FILE EXISTS
// ===================
// The corpus (corpus.ts) is 100% Tatoeba: every row is a real sentence a human
// wrote and another translated, and its `id` is that sentence's permalink. One
// recipe cannot stand on it — わけだ. Its 訳 token is shared by 言い訳だ ("it's an
// excuse"), the interrogative どういうわけだ, and the DIFFERENT patterns わけがない
// / わけではない / わけにはいかない, so the morphological tagger has no safe way to
// tell topic わけだ apart. It sits in grammar.NO_SIGNATURE for exactly that reason,
// and that note ends "needs hand-authored examples". This is those examples.
//
// These are NOT Tatoeba sentences and must never be attributed as such. Their ids
// are NEGATIVE — a Tatoeba id is always positive, so nothing can mistake one for a
// permalink, and the app builds no per-sentence link from an id in any case
// (attribution is one shared acknowledgement, see attribution-link.tsx). They are
// written by hand, verified by a human against the meaning of the pattern, and
// picked to show わけだ landing as "so that's the conclusion" across host types —
// which the verb-only production recipe deliberately cannot show (いい gives the
// 言い訳だ pun; see the recipe note).
//
// They flow into examplesFor() alongside the corpus, so they DRILL: a selection MC
// blanks the わけだ span and asks which pattern fills it, わけだ against its
// confusable siblings. They are deliberately kept OUT of the CORPUS array itself,
// so every corpus-count invariant (perPattern, the confound audit, the token
// filter) keeps measuring only what the ingest produced.

import type { Example } from "./corpus";

/** An authored row before its span is resolved. `hostSurface` is the contiguous
 * slice the blank covers — the host predicate through わけだ — and MUST appear
 * exactly once in `jp`; `hostDict` is the base word shown as the drill's prompt. */
interface Authored {
  readonly id: number;
  readonly jp: string;
  readonly en: string;
  readonly n: number;
  readonly v: readonly string[];
  readonly hostSurface: string;
  readonly hostDict: string;
}

// Five sentences, one per host shape, each a clean cloze. The noun host
// (…というわけだ) is left out on purpose: blanking it swallows the という, and a
// prompt word of "チャンス" would imply わけだ mounts a bare noun, which it does
// not. The lead-ins 道理で / つまり are kept — they are what make わけだ read as a
// conclusion rather than a bare reason, and they co-occur with it in real use.
const ROWS: readonly Authored[] = [
  {
    id: -1,
    jp: "彼はイギリスで育った。道理で英語がうまいわけだ。",
    en: "He grew up in England. No wonder his English is so good.",
    n: 13,
    v: ["彼", "イギリス", "育つ", "道理", "英語", "うまい"],
    hostSurface: "うまいわけだ",
    hostDict: "うまい",
  },
  {
    id: -2,
    jp: "三人で分ければ、一人2000円になるわけだ。",
    en: "Split three ways, it comes out to 2,000 yen each.",
    n: 11,
    v: ["三人", "分ける", "一人", "円", "なる"],
    hostSurface: "なるわけだ",
    hostDict: "なる",
  },
  {
    id: -3,
    jp: "つまり、君は何も知らなかったわけだね。",
    en: "So basically, you didn't know anything.",
    n: 11,
    v: ["君", "知る"],
    hostSurface: "知らなかったわけだ",
    hostDict: "知る",
  },
  {
    id: -4,
    jp: "電車が止まっている。それで彼は遅れているわけだ。",
    en: "The trains are stopped. So that's why he's running late.",
    n: 14,
    v: ["電車", "止まる", "彼", "遅れる"],
    hostSurface: "遅れているわけだ",
    hostDict: "遅れる",
  },
  {
    id: -5,
    jp: "彼女は日本に十年住んでいた。だから日本語がぺらぺらなわけだ。",
    en: "She lived in Japan for ten years, so of course she's fluent.",
    n: 15,
    v: ["彼女", "日本", "年", "住む", "日本語", "ぺらぺら"],
    hostSurface: "ぺらぺらなわけだ",
    hostDict: "ぺらぺら",
  },
];

/** The authored rows as Examples, span resolved from `hostSurface`. Throws at
 * module load if a `hostSurface` is missing or not unique — a typo cannot ship. */
export const AUTHORED: readonly Example[] = ROWS.map((r) => {
  const start = r.jp.indexOf(r.hostSurface);
  if (start < 0) {
    throw new Error(`authored ${r.id}: hostSurface "${r.hostSurface}" not in "${r.jp}"`);
  }
  if (r.jp.indexOf(r.hostSurface, start + 1) !== -1) {
    throw new Error(`authored ${r.id}: hostSurface "${r.hostSurface}" is not unique`);
  }
  const end = start + r.hostSurface.length;
  return {
    id: r.id,
    jp: r.jp,
    en: r.en,
    n: r.n,
    v: r.v,
    p: ["wake-da"],
    sp: { "wake-da": [start, end, r.hostDict] as [number, number, string] },
  };
});
