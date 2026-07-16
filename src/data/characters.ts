// Character data — port of legacy/characters.py.
//
// HOW TO EXTEND
// =============
// - Add a section to an existing script: append a Row to HIRAGANA_ROWS /
//   KATAKANA_ROWS below — [sectionId, label, kanaStringOrList, romajiList,
//   optionalMnemonicsList].
// - Add a whole new set (kanji, vocab words, …): append a CharSet to SETS at
//   the bottom. Example for later:
//
//     {
//       id: "minna-l1",
//       label: "Minna Lesson 1",
//       labelJa: "みんなの日本語 L1",
//       sections: [
//         { id: "l1-vocab", label: "Vocabulary", chars: [
//           { c: "先生", r: ["sensei"], meaning: "teacher",
//             m: "the one who was born (生) before (先) you" },
//         ]},
//       ],
//     }
//
//   Every entry needs `c` (the Japanese) and `r` (accepted answers). Optional:
//   `m` (mnemonic, shown in the Kana chart), `meaning`, and the reserved
//   `strokes` / `audio` fields for the stroke-order, draw, and listen modes.

import type { CharInfo, CharSection, CharSet, KanaChar } from "@/types";

/** One character's accepted answers: a single romaji or a variant list. */
type Romaji = string | string[];

/** [sectionId, label, kanaStringOrList, romajiList, optionalMnemonics] */
type Row = [string, string, string | string[], Romaji[], string[]?];

function sec(
  secId: string,
  label: string,
  kana: string | string[],
  romaji: Romaji[],
  mnemonics?: string[],
): CharSection {
  const kanaList = typeof kana === "string" ? [...kana] : kana;
  const chars: KanaChar[] = kanaList.map((c, i) => {
    const r = romaji[i];
    const ch: KanaChar = { c, r: Array.isArray(r) ? r : [r] };
    const m = mnemonics?.[i];
    if (m) ch.m = m;
    return ch;
  });
  return { id: secId, label, chars };
}

// Romaji rows shared by both scripts (list item = one character's accepted answers)
const R: Record<string, Romaji[]> = {
  vowels: ["a", "i", "u", "e", "o"],
  k: ["ka", "ki", "ku", "ke", "ko"],
  s: ["sa", ["shi", "si"], "su", "se", "so"],
  t: ["ta", ["chi", "ti"], ["tsu", "tu"], "te", "to"],
  n: ["na", "ni", "nu", "ne", "no"],
  h: ["ha", "hi", ["fu", "hu"], "he", "ho"],
  m: ["ma", "mi", "mu", "me", "mo"],
  y: ["ya", "yu", "yo"],
  r: ["ra", "ri", "ru", "re", "ro"],
  w: ["wa", ["wo", "o"], ["n", "nn"]],
  g: ["ga", "gi", "gu", "ge", "go"],
  z: ["za", ["ji", "zi"], "zu", "ze", "zo"],
  d: ["da", ["ji", "di"], ["zu", "du"], "de", "do"],
  b: ["ba", "bi", "bu", "be", "bo"],
  p: ["pa", "pi", "pu", "pe", "po"],
  ky: ["kya", "kyu", "kyo"],
  sh: [["sha", "sya"], ["shu", "syu"], ["sho", "syo"]],
  ch: [["cha", "tya"], ["chu", "tyu"], ["cho", "tyo"]],
  ny: ["nya", "nyu", "nyo"],
  hy: ["hya", "hyu", "hyo"],
  my: ["mya", "myu", "myo"],
  ry: ["rya", "ryu", "ryo"],
  gy: ["gya", "gyu", "gyo"],
  j: [
    ["ja", "jya", "zya"],
    ["ju", "jyu", "zyu"],
    ["jo", "jyo", "zyo"],
  ],
  dj: [
    ["ja", "dya"],
    ["ju", "dyu"],
    ["jo", "dyo"],
  ],
  by: ["bya", "byu", "byo"],
  py: ["pya", "pyu", "pyo"],
};

// Mnemonics — short shape hooks shown in the Kana chart tab. Edit freely.
const MH: Record<string, string[]> = {
  vowels: ["An antenna poking out of a TV", "Two eels swimming side by side (ii!)", "A sideways U wearing a hat", "An exotic bird strutting", "An ostrich craning its neck"],
  k: ["A kite with a little tail", "A key with two teeth", "A bird's open beak, ku-ku!", "A keg beside its tap", "Two cozy lines cuddling"],
  s: ["A fishing hook catching sardines", "A shiny fishing hook", "A spring suspended and coiled", "A set of crooked teeth", "A zigzag bolt soaring down"],
  t: ["'t' and 'a' squished together, ta!", "The number 5 cheering, chi!", "A tsunami wave rolling in", "A telephone pole crossbar", "A toe with a splinter in it"],
  n: ["A nail resting by a cross", "A knee pressed against a wall", "Noodles twirled on chopsticks", "A neko (cat) with a curled tail", "A no-entry sign"],
  h: ["An 'H' holding a balloon, ha!", "A big grin, hee!", "Mount Fuji puffing steam", "Hey, a little hill", "A house with chimney and antenna"],
  m: ["A mailbox with a looped flag", "Looks like 21: 'mi? I'm 21!'", "A cow's face going moo", "A big eye: me means eye", "A hook with more bait on it"],
  y: ["A yak's head with horns", "A unique fish swimming past", "A yo-yo hanging off a finger"],
  r: ["A rabbit's ear flopping over", "A river between two banks", "A loop-de-loop route with a curl", "A runner kneeling, ready", "The same road, no curl (vs る)"],
  w: ["A water slide off a pole", "Someone tripping, woah!", "A cursive lowercase 'n'"],
};
const MK: Record<string, string[]> = {
  vowels: ["An axe blade swinging", "An easel standing on one leg", "う's hat on a box, u again", "An elevator between floors", "An opera singer mid-kick"],
  k: ["か's kite, tail snipped off", "The top half of き's key", "A cook's hat", "A K that lost a leg", "A corner bracket"],
  s: ["Two saplings under a branch", "A smiling face: she smiles (strokes lie flat)", "A suit on a hanger", "せ's teeth, katakana style", "One needle sewing straight down (stroke stands up)"],
  t: ["A cook's hat with a tag inside", "A 7 cheating with an extra bar", "A standing tsunami (vs シ, these drops fall)", "A telephone pole with two wires", "A totem pole with a peg"],
  n: ["A plus sign missing an arm, nah", "Two lines, ni means two!", "Chopsticks crossing over noodles", "A necktie on a pole", "A nose sliding down (one stroke, no more)"],
  h: ["Two strokes laughing apart, ha ha", "A heel kicking sideways", "One clean cliff edge, full drop", "The exact same hill as へ, they match", "A pole with branches, home for birds"],
  m: ["A map pin tilted over", "Three lines, mi = three!", "A pyramid with a mummy inside", "A message crossed out with an X", "も's hook, straightened out"],
  y: ["や's yak horns again", "A U-boat hatch", "A backwards E, yo!"],
  r: ["A radar dish on a roof", "り's river, straighter banks", "A running shoe kicking up", "A reclining letter L", "A room seen from above"],
  w: ["A water glass flipped upside down", "A wobbly two-shelf bracket, woah", "One stroke lying down (vs ソ it points up)"],
};

const HIRAGANA_ROWS: Row[] = [
  ["h-vowels", "Vowels あ", "あいうえお", R.vowels, MH.vowels],
  ["h-k", "K か", "かきくけこ", R.k, MH.k],
  ["h-s", "S さ", "さしすせそ", R.s, MH.s],
  ["h-t", "T た", "たちつてと", R.t, MH.t],
  ["h-n", "N な", "なにぬねの", R.n, MH.n],
  ["h-h", "H は", "はひふへほ", R.h, MH.h],
  ["h-m", "M ま", "まみむめも", R.m, MH.m],
  ["h-y", "Y や", "やゆよ", R.y, MH.y],
  ["h-r", "R ら", "らりるれろ", R.r, MH.r],
  ["h-w", "W わ + ん", "わをん", R.w, MH.w],
  ["h-g", "Dakuten G が", "がぎぐげご", R.g],
  ["h-z", "Dakuten Z ざ", "ざじずぜぞ", R.z],
  ["h-d", "Dakuten D だ", "だぢづでど", R.d],
  ["h-b", "Dakuten B ば", "ばびぶべぼ", R.b],
  ["h-p", "Handakuten P ぱ", "ぱぴぷぺぽ", R.p],
  ["h-kya", "Combo き", ["きゃ", "きゅ", "きょ"], R.ky],
  ["h-sha", "Combo し", ["しゃ", "しゅ", "しょ"], R.sh],
  ["h-cha", "Combo ち", ["ちゃ", "ちゅ", "ちょ"], R.ch],
  ["h-nya", "Combo に", ["にゃ", "にゅ", "にょ"], R.ny],
  ["h-hya", "Combo ひ", ["ひゃ", "ひゅ", "ひょ"], R.hy],
  ["h-mya", "Combo み", ["みゃ", "みゅ", "みょ"], R.my],
  ["h-rya", "Combo り", ["りゃ", "りゅ", "りょ"], R.ry],
  ["h-gya", "Combo ぎ", ["ぎゃ", "ぎゅ", "ぎょ"], R.gy],
  ["h-ja", "Combo じ", ["じゃ", "じゅ", "じょ"], R.j],
  ["h-dja", "Combo ぢ", ["ぢゃ", "ぢゅ", "ぢょ"], R.dj],
  ["h-bya", "Combo び", ["びゃ", "びゅ", "びょ"], R.by],
  ["h-pya", "Combo ぴ", ["ぴゃ", "ぴゅ", "ぴょ"], R.py],
];

const KATAKANA_ROWS: Row[] = [
  ["k-vowels", "Vowels ア", "アイウエオ", R.vowels, MK.vowels],
  ["k-k", "K カ", "カキクケコ", R.k, MK.k],
  ["k-s", "S サ", "サシスセソ", R.s, MK.s],
  ["k-t", "T タ", "タチツテト", R.t, MK.t],
  ["k-n", "N ナ", "ナニヌネノ", R.n, MK.n],
  ["k-h", "H ハ", "ハヒフヘホ", R.h, MK.h],
  ["k-m", "M マ", "マミムメモ", R.m, MK.m],
  ["k-y", "Y ヤ", "ヤユヨ", R.y, MK.y],
  ["k-r", "R ラ", "ラリルレロ", R.r, MK.r],
  ["k-w", "W ワ + ン", "ワヲン", R.w, MK.w],
  ["k-g", "Dakuten G ガ", "ガギグゲゴ", R.g],
  ["k-z", "Dakuten Z ザ", "ザジズゼゾ", R.z],
  ["k-d", "Dakuten D ダ", "ダヂヅデド", R.d],
  ["k-b", "Dakuten B バ", "バビブベボ", R.b],
  ["k-p", "Handakuten P パ", "パピプペポ", R.p],
  ["k-kya", "Combo キ", ["キャ", "キュ", "キョ"], R.ky],
  ["k-sha", "Combo シ", ["シャ", "シュ", "ショ"], R.sh],
  ["k-cha", "Combo チ", ["チャ", "チュ", "チョ"], R.ch],
  ["k-nya", "Combo ニ", ["ニャ", "ニュ", "ニョ"], R.ny],
  ["k-hya", "Combo ヒ", ["ヒャ", "ヒュ", "ヒョ"], R.hy],
  ["k-mya", "Combo ミ", ["ミャ", "ミュ", "ミョ"], R.my],
  ["k-rya", "Combo リ", ["リャ", "リュ", "リョ"], R.ry],
  ["k-gya", "Combo ギ", ["ギャ", "ギュ", "ギョ"], R.gy],
  ["k-ja", "Combo ジ", ["ジャ", "ジュ", "ジョ"], R.j],
  ["k-dja", "Combo ヂ", ["ヂャ", "ヂュ", "ヂョ"], R.dj],
  ["k-bya", "Combo ビ", ["ビャ", "ビュ", "ビョ"], R.by],
  ["k-pya", "Combo ピ", ["ピャ", "ピュ", "ピョ"], R.py],
];

export const SETS: CharSet[] = [
  {
    id: "hiragana",
    label: "Hiragana",
    labelJa: "ひらがな",
    sections: HIRAGANA_ROWS.map((row) => sec(...row)),
  },
  {
    id: "katakana",
    label: "Katakana",
    labelJa: "カタカナ",
    sections: KATAKANA_ROWS.map((row) => sec(...row)),
  },
];

/** Commonly-confused characters — MC distractors + results grouping. */
// Groups can mix scripts. Order preserved from legacy/characters.py.
export const LOOKALIKES: string[][] = [
  ["シ", "ツ"],
  ["ソ", "ン"],
  ["ク", "ワ", "フ", "ウ"],
  ["コ", "ユ"],
  ["ス", "ヌ"],
  ["チ", "テ"],
  ["ナ", "メ"],
  ["ね", "れ", "わ"],
  ["ぬ", "め"],
  ["る", "ろ"],
  ["は", "ほ"],
  ["き", "さ"],
  ["た", "な"],
  ["あ", "お"],
  ["か", "カ"],
  ["や", "ヤ"],
  ["も", "モ"],
  ["り", "リ"],
  ["せ", "セ"],
  ["き", "キ"],
  ["に", "ニ"],
  ["へ", "ヘ"],
];

/** char → flattened info (set/section labels, romaji). */
export const CHAR_INDEX: Record<string, CharInfo> = buildCharIndex();

/** char → its lookalikes (all other members of its LOOKALIKES groups). */
export const LOOK_GROUP: Record<string, string[]> = buildLookGroup();

function buildCharIndex(): Record<string, CharInfo> {
  const index: Record<string, CharInfo> = {};
  for (const set of SETS) {
    for (const sec of set.sections) {
      for (const ch of sec.chars) {
        index[ch.c] = {
          c: ch.c,
          r: ch.r,
          set: set.id,
          setLabel: set.label,
          sec: sec.id,
          secLabel: sec.label,
          meaning: ch.meaning ?? null,
        };
      }
    }
  }
  return index;
}

function buildLookGroup(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const group of LOOKALIKES) {
    for (const c of group) {
      (groups[c] ??= []).push(...group.filter((x) => x !== c));
    }
  }
  return groups;
}

/** Mnemonic for the Kana chart: explicit, combo-derived, or mark-derived. */
export function mnemonicFor(ch: KanaChar, secLabel: string): string {
  if (ch.m) return ch.m;
  if (ch.c.length > 1) return `${ch.c[0]} + small ${ch.c[1]}`;
  if (/^Dakuten/.test(secLabel)) return "Base kana + ゛ voicing mark";
  if (/^Handakuten/.test(secLabel)) return "Base kana + ゜ p-mark";
  return "";
}

/** Basic vs Extended grouping used by the character picker. */
export function isExtendedSection(label: string): boolean {
  return /^(Dakuten|Handakuten|Combo)/.test(label);
}
