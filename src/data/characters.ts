// Character data — port of legacy/characters.py.
//
// HOW TO EXTEND
// =============
// - Add a section to an existing script: append a Row to HIRAGANA_ROWS /
//   KATAKANA_ROWS below — [sectionId, label, kanaStringOrList, romajiList].
//
//   Mnemonics do NOT live here. src/data/mnemonics.ts is the one source for a
//   character's story, and everything that shows one (the entry card, the teach
//   walkthrough, the library tile's tooltip) reads it from there. A second short
//   table used to sit in this file and drifted out of agreement with it — あ's
//   tile said "an antenna poking out of a TV" while its card told the acrobat
//   story. Author the mnemonic once, in mnemonics.ts.
// - Add a whole new set (kanji, vocab words, …): append a CharSet to SETS at
//   the bottom. Example for later:
//
//     {
//       id: "minna-l1",
//       label: "Minna Lesson 1",
//       labelJa: "みんなの日本語 L1",
//       sections: [
//         { id: "l1-vocab", label: "Vocabulary", chars: [
//           { c: "先生", r: ["sensei"], meaning: "teacher" },
//         ]},
//       ],
//     }
//
//   Every entry needs `c` (the Japanese) and `r` (accepted answers). Optional:
//   `meaning`, and the reserved `strokes` / `audio` fields for the stroke-order,
//   draw, and listen modes.

import { entryId, factId } from "@/lib/fact-id";
import type {
  CharInfo,
  CharSection,
  CharSet,
  EntryId,
  FactId,
  FactInfo,
  KanaChar,
} from "@/types";

/** One character's accepted answers: a single romaji or a variant list. */
type Romaji = string | string[];

/** [sectionId, label, kanaStringOrList, romajiList] */
type Row = [string, string, string | string[], Romaji[]];

function sec(
  secId: string,
  label: string,
  kana: string | string[],
  romaji: Romaji[],
): CharSection {
  const kanaList = typeof kana === "string" ? [...kana] : kana;
  const chars: KanaChar[] = kanaList.map((c, i) => {
    const r = romaji[i];
    return { c, r: Array.isArray(r) ? r : [r] };
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

const HIRAGANA_ROWS: Row[] = [
  ["h-vowels", "Vowels あ", "あいうえお", R.vowels],
  ["h-k", "K か", "かきくけこ", R.k],
  ["h-s", "S さ", "さしすせそ", R.s],
  ["h-t", "T た", "たちつてと", R.t],
  ["h-n", "N な", "なにぬねの", R.n],
  ["h-h", "H は", "はひふへほ", R.h],
  ["h-m", "M ま", "まみむめも", R.m],
  ["h-y", "Y や", "やゆよ", R.y],
  ["h-r", "R ら", "らりるれろ", R.r],
  ["h-w", "W わ + ん", "わをん", R.w],
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
  ["k-vowels", "Vowels ア", "アイウエオ", R.vowels],
  ["k-k", "K カ", "カキクケコ", R.k],
  ["k-s", "S サ", "サシスセソ", R.s],
  ["k-t", "T タ", "タチツテト", R.t],
  ["k-n", "N ナ", "ナニヌネノ", R.n],
  ["k-h", "H ハ", "ハヒフヘホ", R.h],
  ["k-m", "M マ", "マミムメモ", R.m],
  ["k-y", "Y ヤ", "ヤユヨ", R.y],
  ["k-r", "R ラ", "ラリルレロ", R.r],
  ["k-w", "W ワ + ン", "ワヲン", R.w],
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

// ---------- the fact view ----------
//
// Kana is one SUBJECT among the several that are coming. This is the whole of
// what it has to publish for the rest of the app to drill it: a flat list of
// facts. Everything above stays kana's private business.
//
// Kana is the degenerate case of the entry/fact split — one entry, one reading,
// so exactly one fact each and the two ids are 1:1. That is precisely why the
// split has to be built now: with only kana in the app, nothing would ever
// notice it was missing until 生 arrived with eleven readings and one slot.

/** This subject's id. Facts carry it so nobody infers a subject from an id. */
export const KANA_SUBJECT = "kana";

/** The entry for a kana character — `kana:し`. */
export function kanaEntry(c: string): EntryId {
  return entryId(KANA_SUBJECT, c);
}

/**
 * The one fact a kana has: its reading.
 *
 * A bare "reading" aspect is honest HERE and nowhere else — し has exactly one
 * reading, so "what does し say" has exactly one gradeable answer. A kanji must
 * use fact-id's `readingAspect(word)` instead.
 */
export function kanaFact(c: string): FactId {
  return factId(kanaEntry(c), "reading");
}

/** Kana's facts, in data order. */
export const KANA_FACTS: FactInfo[] = buildKanaFacts();

function buildKanaFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const set of SETS) {
    for (const section of set.sections) {
      for (const ch of section.chars) {
        facts.push({
          id: kanaFact(ch.c),
          entry: kanaEntry(ch.c),
          glyph: ch.c,
          answers: ch.r,
          subject: KANA_SUBJECT,
          meaning: ch.meaning ?? null,
        });
      }
    }
  }
  return facts;
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

/** Basic vs Extended grouping used by the character picker. */
export function isExtendedSection(label: string): boolean {
  return /^(Dakuten|Handakuten|Combo)/.test(label);
}
