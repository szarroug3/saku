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
//
// A second lane lives here too, for a different reason: the core particles
// (か/wa/ga/に/で/を/へ/まで/までに/だけ/しか). The tagger never signs them — a bare
// は/が/を slot is too common to be a signature — so `examplesFor` would
// otherwise answer empty for every one of them. Each gets ONE hand-picked
// sentence, for REFERENCE ONLY: see the row group below for what that does and
// does not buy them.

import type { Example } from "./corpus";

/** An authored row before its span is resolved. `recipe` is the one pattern it
 * is tagged for (see authored.test.ts: one tag per row, so it can be blanked).
 * `hostSurface` is the contiguous slice the blank covers and MUST appear
 * exactly once in `jp`; `hostDict` is the base word shown as the drill's prompt. */
interface Authored {
  readonly id: number;
  readonly recipe: string;
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
    recipe: "wake-da",
    jp: "彼はイギリスで育った。道理で英語がうまいわけだ。",
    en: "He grew up in England. No wonder his English is so good.",
    n: 13,
    v: ["彼", "イギリス", "育つ", "道理", "英語", "うまい"],
    hostSurface: "うまいわけだ",
    hostDict: "うまい",
  },
  {
    id: -2,
    recipe: "wake-da",
    jp: "三人で分ければ、一人2000円になるわけだ。",
    en: "Split three ways, it comes out to 2,000 yen each.",
    n: 11,
    v: ["三人", "分ける", "一人", "円", "なる"],
    hostSurface: "なるわけだ",
    hostDict: "なる",
  },
  {
    id: -3,
    recipe: "wake-da",
    jp: "つまり、君は何も知らなかったわけだね。",
    en: "So basically, you didn't know anything.",
    n: 11,
    v: ["君", "知る"],
    hostSurface: "知らなかったわけだ",
    hostDict: "知る",
  },
  {
    id: -4,
    recipe: "wake-da",
    jp: "電車が止まっている。それで彼は遅れているわけだ。",
    en: "The trains are stopped. So that's why he's running late.",
    n: 14,
    v: ["電車", "止まる", "彼", "遅れる"],
    hostSurface: "遅れているわけだ",
    hostDict: "遅れる",
  },
  {
    id: -5,
    recipe: "wake-da",
    jp: "彼女は日本に十年住んでいた。だから日本語がぺらぺらなわけだ。",
    en: "She lived in Japan for ten years, so of course she's fluent.",
    n: 15,
    v: ["彼女", "日本", "年", "住む", "日本語", "ぺらぺら"],
    hostSurface: "ぺらぺらなわけだ",
    hostDict: "ぺらぺら",
  },

  // --- particles: one plain reference example each -----------------------
  // The grammar corpus (corpus.ts) never tags these — a bare は/が/を slot is so
  // common that a morphological match is not a signature, and は/が selection
  // is dead outright (see questions.ts). So each core particle gets ONE hand
  // picked sentence here instead, purely for REFERENCE: shown on the pattern's
  // Library page with the particle itself highlighted, exactly what a learner
  // meeting these as bare vocab glosses ("marks the subject") was missing. They
  // still flow through examplesFor() like every other row, but PARTICLE_IDS /
  // PARTICLE_ALLOWLIST (questions.ts) keep is/ga/etc. out of any selection
  // question regardless — these rows change what is SHOWN, never what is ASKED.
  {
    id: -6,
    recipe: "ka",
    jp: "これは何ですか。",
    en: "What is this?",
    n: 5,
    v: ["これ", "何"],
    hostSurface: "か",
    hostDict: "か",
  },
  {
    id: -7,
    recipe: "wa",
    jp: "私は学生です。",
    en: "I am a student.",
    n: 4,
    v: ["私", "学生"],
    hostSurface: "は",
    hostDict: "は",
  },
  {
    id: -8,
    recipe: "ga",
    jp: "猫が好きです。",
    en: "I like cats.",
    n: 4,
    v: ["猫", "好き"],
    hostSurface: "が",
    hostDict: "が",
  },
  {
    id: -9,
    recipe: "ni",
    jp: "七時に起きます。",
    en: "I get up at seven o'clock.",
    n: 4,
    v: ["七時", "起きる"],
    hostSurface: "に",
    hostDict: "に",
  },
  {
    id: -10,
    recipe: "de",
    jp: "図書館で勉強します。",
    en: "I study at the library.",
    n: 4,
    v: ["図書館", "勉強", "する"],
    hostSurface: "で",
    hostDict: "で",
  },
  {
    id: -11,
    recipe: "wo",
    jp: "パンを食べます。",
    en: "I eat bread.",
    n: 3,
    v: ["パン", "食べる"],
    hostSurface: "を",
    hostDict: "を",
  },
  {
    id: -12,
    recipe: "e",
    jp: "学校へ行きます。",
    en: "I'm going to school.",
    n: 3,
    v: ["学校", "行く"],
    hostSurface: "へ",
    hostDict: "へ",
  },
  {
    id: -13,
    recipe: "made",
    jp: "駅まで歩きます。",
    en: "I'll walk to the station.",
    n: 3,
    v: ["駅", "歩く"],
    hostSurface: "まで",
    hostDict: "まで",
  },
  {
    id: -14,
    recipe: "made-ni",
    jp: "五時までに帰ります。",
    en: "I'll be home by five o'clock.",
    n: 3,
    v: ["五時", "帰る"],
    hostSurface: "までに",
    hostDict: "までに",
  },
  {
    id: -15,
    recipe: "dake",
    jp: "一つだけ食べました。",
    en: "I ate just one.",
    n: 4,
    v: ["一つ", "食べる"],
    hostSurface: "だけ",
    hostDict: "だけ",
  },
  {
    id: -16,
    recipe: "shika-nai",
    jp: "水しか飲まない。",
    en: "I drink nothing but water.",
    n: 3,
    v: ["水", "飲む"],
    hostSurface: "しか",
    hostDict: "しか",
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
    p: [r.recipe],
    sp: { [r.recipe]: [start, end, r.hostDict] as [number, number, string] },
  };
});
