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
//
// A third lane, added by SAK-276: the SAK-174 copula/sentence-final-particle
// rows (だ/です/も/ね/よ/って), と's bare 'and' sense (to-and), the bare predicate
// がない, and the bare FORM lessons (ない/た/ます/prenominal-な, plus the
// compound-verb patterns たがる/始める/続ける). None of these ever got a
// grammar.py signature OR a NO_SIGNATURE entry — SAK-174 and the later
// form-lesson rows landed in recipes.ts without anyone updating the Python
// side, which is exactly the silent-zero this file's header warns about. None
// of them has grammar.py's actual disqualifying problem (a real ambiguity of
// MEANING, like potential/passive, or a token collision, like て-mo/ni-iku):
// they are either meaning-only bare particles in the same shape は/が/で
// already get ONE reference example (だ/です/も/ね/よ/って/がない/to-and), or a
// real, unambiguous, everyday content pattern the tagger simply never learned
// (nai-form/ta-form/masu-form/prenominal-form/tagaru/hajimeru/tsuzukeru/
// ta-ato-de — the last already flagged CORPUS-SCARCE on its own row and now
// finally getting the hand-authored example that note asked for). Same
// REFERENCE-ONLY treatment as the particles above: one hand-picked sentence
// each, chosen so the pattern's own written text is a literal, unique
// substring of the sentence (authored.test.ts checks this).
//
// Two more SAK-174-era rows — stem-form (〜(stem)) and volitional-form
// (〜(よ)う) — are NOT here. Their `pattern` string is a display placeholder,
// not real text: "(stem)" never appears in any Japanese sentence (the stem
// has no standalone written surface — かき/たべ only exist as the first half of
// a longer conjugated word), and "(よ)う" is class-conditional spelling (行こう
// has no よ, 食べよう does) with no single fixed string to match. Neither can
// satisfy the same span-matches-pattern check every row below must pass, so
// they are documented exemptions in grammar.NO_SIGNATURE / CORPUS_META.noSignature
// instead of a fabricated row.

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

  // --- SAK-276: SAK-174's copulas/sentence-final particles, one bare-form ---
  // ------- reference example each, same treatment as the particles above ---
  {
    id: -17,
    recipe: "da",
    jp: "あの人は先生だ。",
    en: "That person is a teacher.",
    n: 4,
    v: ["あの人", "先生"],
    hostSurface: "だ",
    hostDict: "だ",
  },
  {
    id: -18,
    recipe: "desu",
    jp: "あの人は先生です。",
    en: "That person is a teacher.",
    n: 4,
    v: ["あの人", "先生"],
    hostSurface: "です",
    hostDict: "です",
  },
  {
    id: -19,
    recipe: "mo",
    jp: "妹も先生です。",
    en: "My sister is also a teacher.",
    n: 4,
    v: ["妹", "先生"],
    hostSurface: "も",
    hostDict: "も",
  },
  {
    id: -20,
    recipe: "ne",
    jp: "今日は暑いですね。",
    en: "It's hot today, isn't it.",
    n: 5,
    v: ["今日", "暑い"],
    hostSurface: "ね",
    hostDict: "ね",
  },
  {
    id: -21,
    recipe: "yo",
    jp: "もう遅いよ。",
    en: "It's already late, I'm telling you.",
    n: 3,
    v: ["もう", "遅い"],
    hostSurface: "よ",
    hostDict: "よ",
  },
  {
    id: -22,
    recipe: "tte",
    jp: "明日は休みだって。",
    en: "I heard tomorrow's a holiday.",
    n: 4,
    v: ["明日", "休み"],
    hostSurface: "って",
    hostDict: "って",
  },
  {
    id: -23,
    recipe: "ga-nai",
    jp: "時間がない。",
    en: "There's no time.",
    n: 2,
    v: ["時間"],
    hostSurface: "がない",
    hostDict: "がない",
  },
  {
    id: -24,
    recipe: "to-and",
    jp: "私と彼はクラスメートだ。",
    en: "He and I are classmates.",
    n: 6,
    v: ["私", "彼", "クラスメート"],
    hostSurface: "と",
    hostDict: "と",
  },

  // --- SAK-276: bare FORM lessons, one reference example each ---------------
  // Same rationale as above: each written pattern is real, unambiguous text
  // (unlike stem-form/volitional-form's placeholder labels — see this file's
  // header), but too common a shape for grammar.py's tagger to treat as a
  // distinguishing signature, exactly the reason は/が/を never got one either.
  {
    id: -25,
    recipe: "nai-form",
    jp: "肉を食べない。",
    en: "I don't eat meat.",
    n: 4,
    v: ["肉", "食べる"],
    hostSurface: "食べない",
    hostDict: "食べる",
  },
  {
    id: -26,
    recipe: "ta-form",
    jp: "映画を見た。",
    en: "I watched a movie.",
    n: 3,
    v: ["映画", "見る"],
    hostSurface: "見た",
    hostDict: "見る",
  },
  {
    id: -27,
    recipe: "masu-form",
    jp: "毎日、日本語を勉強します。",
    en: "I study Japanese every day.",
    n: 6,
    v: ["毎日", "日本語", "勉強する"],
    hostSurface: "勉強します",
    hostDict: "勉強する",
  },
  {
    id: -28,
    recipe: "prenominal-form",
    jp: "静かな部屋で休みたい。",
    en: "I want to rest in a quiet room.",
    n: 6,
    v: ["静か", "部屋", "休む"],
    hostSurface: "静かな",
    hostDict: "静か",
  },

  // --- SAK-276: aspectual/desiderative compound verbs, never signed ---------
  {
    id: -29,
    recipe: "tagaru",
    jp: "子供は外で遊びたがる。",
    en: "The child wants to play outside.",
    n: 6,
    v: ["子供", "外", "遊ぶ"],
    hostSurface: "遊びたがる",
    hostDict: "遊ぶ",
  },
  {
    id: -30,
    recipe: "hajimeru",
    jp: "赤ちゃんが歩き始める。",
    en: "The baby starts walking.",
    n: 4,
    v: ["赤ちゃん", "歩く"],
    hostSurface: "歩き始める",
    hostDict: "歩く",
  },
  {
    id: -31,
    recipe: "tsuzukeru",
    jp: "雨が降り続ける。",
    en: "The rain keeps falling.",
    n: 4,
    v: ["雨", "降る"],
    hostSurface: "降り続ける",
    hostDict: "降る",
  },

  // --- SAK-276: ta-ato-de finally gets the hand-authored example its own ---
  // ------- row (recipes.ts) already asked for ("CORPUS-SCARCE ... Needs -----
  // ------- hand-authored examples") -----------------------------------------
  {
    id: -32,
    recipe: "ta-ato-de",
    jp: "宿題をしたあとで、テレビを見た。",
    en: "After doing my homework, I watched TV.",
    n: 8,
    v: ["宿題", "する", "テレビ", "見る"],
    hostSurface: "したあとで",
    hostDict: "する",
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
