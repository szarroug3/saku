// What text the app hands VOICEVOX for a word, decided by asking the engine
// (SAK-275).
//
// WHY THIS EXISTS
// ===============
// The app speaks a word from its kana reading (VOCAB.reb and every other
// reading a word is taught under), and that bare kana is exactly the input
// OpenJTalk, VOICEVOX's text analyzer, is worst at. Two failures, both
// confirmed against the live engine:
//
//   1. WRONG CONSONANTS. A は, へ or ひ inside a bare reading gets read as a
//      particle or dropped outright: はちがつ (8月) comes out ワチガツ, しひ
//      (私費) comes out シイ, へいれつ (並列) comes out エイレツ, せんえんさつ
//      (千円札) is cut off at センエンサッ.
//   2. A LONG VOWEL LEFT LITERAL, OR SMOOTHED WHEN IT SHOULD NOT BE. Real
//      Japanese smooths えい and おう (先生 is "sensee", 学校 is "gakkoo").
//      From a bare reading the engine smooths おう but keeps えい, so the
//      shipped clips disagree with each other and with the same words inside
//      the example sentences. The other direction is a bug too: 囲う is
//      "kakou", not "kakoo": that う is the verb's ending.
//
// Earlier passes fixed these one reading at a time, by hand, into
// CONFIRMED_BAD_READINGS: 95 entries over four passes, with two whole clusters
// written off as unfixable. This script does the whole corpus by machine
// instead, and keeps doing it: for every reading it works out what the word
// should sound like, tries a short ladder of things to send, and keeps the
// first one the engine actually says correctly. The answer is written to
// src/data/generated/speech-overrides.json, which src/lib/tts-synth.ts reads.
//
// HOW THE RIGHT SOUNDS ARE WORKED OUT, WITHOUT ANYONE LISTENING
// =============================================================
// POST /audio_query reports the exact moras the engine will say before it
// makes a clip, so a machine can check every word. Nothing here calls
// /synthesis; this script only ever reads.
//
// The expected sounds for a reading start as the reading itself, written in
// katakana, one mora at a time. That is the reading the word is taught under,
// so its consonants are not negotiable. Two kinds of position are then allowed
// to differ, and only those two:
//
//   A LONG-VOWEL SITE, an お-vowel mora followed by ウ, or an え-vowel mora
//   followed by イ. Smoothed (オ / エ) or kept as written, decided per site.
//
//   A REAL PARTICLE, a は or へ that is genuinely said わ or え because the word
//   ends in the fossilized particle (こんにちは, 実は, では, とは).
//
// Who decides each one: the WORD WRITTEN NORMALLY, that is its kanji spelling.
// A kanji spelling anchors OpenJTalk's dictionary lookup, so the engine
// resolves the word rather than guessing at bare kana, the same test
// CONFIRMED_BAD_READINGS was built on. But the normal spelling is only trusted
// as a witness when it agrees with the taught reading BEAT FOR BEAT everywhere
// else: same number of moras, and every other mora identical. That guard is
// what keeps the known liars out. 栄え's spelling resolves to さかえ, a
// different word entirely; 幅広's to はばひろ, without the rendaku the taught
// はばびろ has; 時は金なり's to きんなり. None of those line up, so none of them
// gets a vote, so those readings are decided by hand instead, in HAND_DECIDED
// below, and every one of them is listed there with its reason.
//
// A word with no kanji spelling at all (keb === reb: こんにちは, うとうと,
// エイズ) has no second witness, and needs none: its normal spelling IS the
// reading, so whatever the engine says for it is by definition the word said
// as written. Those are left exactly as they are, which is also why this
// script cannot break こんにちは the way a blanket hiragana-to-katakana swap
// once did (see tts-synth.ts's own long note on that).
//
// THE LADDER
// ==========
// Once the expected moras are known, these are tried in order and the first
// whose engine moras match exactly is kept:
//
//   1. the reading as it is                     せんせい
//   2. the reading in katakana                  ハチガツ   fixes 8月, 私費
//   3. hiragana with ー at each smoothed site    せんせー   says セ|ン|セ|エ
//   4. hiragana with え/お at each smoothed site  せえへき   says セ|エ|ヘ|キ
//   5. katakana with ー at each smoothed site    ガクセー   says ガ|ク|セ|エ
//   6. katakana with エ/オ at each smoothed site
//   7. the word written normally                使う      says ツ|カ|ウ
//
// A candidate also has to keep the word in as few accent phrases as the reading
// or its own spelling does, or it puts a pause inside the word: ホントウ says
// the right moras but comes out ホン + トオ.
//
// None of these is assumed to work, and the engine is not consistent about any
// of them: ガクセー comes back ガクセエ while センセー comes back センセイ.
// Katakana fixes 8月 and 私費 and 千円札 but not 性癖 or 兵役; a spelled-out
// long vowel fixes 性癖, 兵役 and 並列, which the earlier pass had written off
// as unfixable; only the kanji fixes 使う and 襲う. A reading nothing on the
// ladder gets right is reported and left alone rather than half-fixed.
//
// ONE READING, ONE CLIP
// =====================
// The cache path is a hash of the text (voice.ts's voiceObjectPath) and the
// override table is keyed by reading, so two words that share a reading share
// one clip and must want the same sounds. Where they do not, and かこう is both
// 囲う "kakou" and 加工 "kakoo", there is no text that serves both, so the
// reading gets no override and is reported as a clash. Guessing one word's
// sounds at the other's expense is the one thing this script will not do.
//
// RUN IT
// ======
//   node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs \
//     scripts/build-speech-overrides.mjs                 # rebuild the table
//   node ... scripts/build-speech-overrides.mjs --check  # re-ask, fail on any mismatch
//   node ... scripts/build-speech-overrides.mjs --report=out.json   # full detail
//
// Both modes need the local Docker engine (http://localhost:50021). Never
// point this at Cloud Run: it is thousands of requests.

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { legacyUnqualifiedReading, readingUnits, VOCAB } from "@/data/vocab";
import { moraeOf } from "@/lib/pitch";
import { toKatakana } from "@/lib/romaji";

const TABLE_FILE = new URL("../src/data/generated/speech-overrides.json", import.meta.url);
const DEFAULT_ENGINE = "http://localhost:50021";
const SPEAKER = 3;
const CONCURRENCY = 8;

// ---------------------------------------------------------------- kana facts

/** The vowel every katakana character carries. Only single characters are
 * listed: a mora's vowel is decided by its LAST character, and a small kana
 * always comes last, so キョ resolves through ョ and needs no row of its own. */
const VOWEL_OF = new Map();
for (const [vowel, chars] of [
  ["ア", "アカサタナハマヤラワガザダバパャァヮ"],
  ["イ", "イキシチニヒミリヰギジヂビピィ"],
  ["ウ", "ウクスツヌフムユルグズヅブプヴュゥ"],
  ["エ", "エケセテネヘメレヱゲゼデベペェ"],
  ["オ", "オコソトノホモヨロヲゴゾドボポョォ"],
]) {
  for (const ch of chars) VOWEL_OF.set(ch, vowel);
}

/** Spellings the engine never prints back, because they are not separate
 * sounds: づ and ぢ are said ず and じ, を is said お, and it reports them that
 * way. Folding them here keeps a word like し続ける, or a phrase carrying を,
 * from looking like a mismatch when nothing is actually wrong. */
const SAME_SOUND = new Map([
  ["ヅ", "ズ"],
  ["ヂ", "ジ"],
  ["ヲ", "オ"],
]);

/** The vowel a whole mora carries. Its last character decides, because a
 * small kana (キョ's ョ) always comes last and always wins. */
function vowelOfMora(mora) {
  return VOWEL_OF.get(mora[mora.length - 1]) ?? null;
}

const KATAKANA_LONG = new Map([
  ["ア", "ア"],
  ["イ", "イ"],
  ["ウ", "ウ"],
  ["エ", "エ"],
  ["オ", "オ"],
]);

/** The reading as the engine would print it: katakana moras, with ー already
 * spelled out as the vowel it lengthens (シーア is シ|イ|ア in the engine's own
 * mora list, never a ー mora). This is the word said exactly as written, which
 * is where every expectation starts. */
export function literalMoras(reading) {
  const moras = moraeOf(toKatakana(reading));
  const out = [];
  for (const mora of moras) {
    if (mora === "ー" && out.length > 0) {
      const vowel = vowelOfMora(out[out.length - 1]);
      out.push(vowel ? KATAKANA_LONG.get(vowel) : mora);
    } else {
      out.push(SAME_SOUND.get(mora) ?? mora);
    }
  }
  return out;
}

/** Every position in `moras` where a long vowel is written out: an お-vowel
 * mora followed by ウ, or an え-vowel mora followed by イ. These are the only
 * positions allowed to come out as something other than what is written. */
export function longVowelSites(moras) {
  const sites = [];
  for (let i = 1; i < moras.length; i++) {
    const before = vowelOfMora(moras[i - 1]);
    if (moras[i] === "ウ" && before === "オ") sites.push({ index: i, smoothTo: "オ" });
    else if (moras[i] === "イ" && before === "エ") sites.push({ index: i, smoothTo: "エ" });
  }
  return sites;
}

/** Where a は or へ could honestly be the fossilized particle instead of the
 * plain mora. Only these two positions are ever allowed to read わ / え. */
const PARTICLE_SOUND = new Map([
  ["ハ", "ワ"],
  ["ヘ", "エ"],
]);

// ------------------------------------------------------------- the engine

function engineBase() {
  return (process.env.VOICEVOX_ENGINE_URL ?? DEFAULT_ENGINE).replace(/\/$/, "");
}

const moraCache = new Map();

/** The exact moras the engine will say for `text`, and how many accent phrases
 * it breaks the text into. The cache holds the promise rather than the answer,
 * so several readings asking about the same spelling at the same moment make
 * one request between them, not one each. */
function askEngine(base, text) {
  const hit = moraCache.get(text);
  if (hit) return hit;
  const pending = (async () => {
    const url = `${base}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(text)}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`audio_query ${res.status} ${res.statusText} for ${JSON.stringify(text)}`);
    const query = await res.json();
    return {
      moras: query.accent_phrases.flatMap((phrase) => phrase.moras.map((m) => m.text)),
      phrases: query.accent_phrases.length,
    };
  })();
  moraCache.set(text, pending);
  return pending;
}

/** Runs `worker` over `items` with a few in flight at once. The engine answers
 * a query in about two milliseconds, so the whole corpus is a minute or so, but
 * one at a time would still be twenty. */
async function inParallel(items, worker) {
  let cursor = 0;
  const out = new Array(items.length);
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
  return out;
}

// --------------------------------------------------------- the population

/** Every reading the app can ask a voice for, with the words that ask for it.
 *
 * Three sources, which together are exactly what seed-voice-audio.mjs's
 * `words`, `word-readings`, `pitch` and `lesson-pitch` sets speak: a row's own
 * preferred reading, every reading unit the row is taught under (人 → ひと,
 * じん, にん), and the frozen taught reading the pitch quiz resolves a word to
 * (`legacyUnqualifiedReading`, which for 七 is しち where `reb` has moved on to
 * なな). */
export function speechPopulation() {
  const byReading = new Map();
  function add(reading, keb) {
    if (!reading) return;
    let kebs = byReading.get(reading);
    if (!kebs) byReading.set(reading, (kebs = new Set()));
    kebs.add(keb);
  }
  for (const row of VOCAB) {
    add(row.reb, row.keb);
    for (const unit of readingUnits(row)) add(unit.reb, row.keb);
    add(legacyUnqualifiedReading(row.keb), row.keb);
  }
  return new Map([...byReading].map(([reading, kebs]) => [reading, [...kebs].sort()]));
}

// ------------------------------------------------------- expected sounds

/** Readings whose normal spelling does not line up with the taught reading, so
 * the engine gets no vote and a person decided instead. Each entry gives the
 * sounds the word should have, written out in full.
 *
 * Nothing here is free-hand: the script checks every one of these against the
 * reading's own moras and refuses any that changes a mora it is not allowed to
 * (see `checkHandDecision`), so a typo here cannot quietly give a word the
 * wrong consonants.
 *
 * The rule used throughout: a long vowel inside a word is smoothed, because
 * that is how the word is really said and that is the decision on this card. It
 * is kept only where the two vowels belong to different parts of the word.
 *
 * Why these words and not others: the normal spelling has to fail one of two
 * ways to end up here. Either it resolves to a different word (荘厳's spelling
 * reads しょうごん, 正義's reads まさよし, a name), or the word is one the
 * engine's dictionary does not hold, so it reads the kanji one at a time and
 * never applies the long-vowel rule across the join (高峰 comes out コウホウ,
 * 表計算 comes out オモテケエサン). Either way the answer it gives is about
 * some other word, not this one. */
export const HAND_DECIDED = new Map([
  // Spellings that resolve to a different word or a different reading.
  ["はえ", ["ハエ", "栄え's spelling reads さかえ, a different word; the taught reading keeps は"]],
  ["はばびろ", ["ハバビロ", "幅広's spelling reads はばひろ, without the taught rendaku"]],
  ["ときはかねなり", ["トキワカネナリ", "時は金なり's spelling reads きんなり; the は is the real particle"]],
  ["うほう", ["ウホオ", "右方's spelling reads みぎかた"]],
  ["きょうじ", ["キョオジ", "教示's spelling ends on a different reading of 示"]],
  ["こうじょ", ["コオジョ", "皇女's spelling reads おうじょ"]],
  ["ぎょう", ["ギョオ", "行's spelling reads くだり"]],
  ["こうけつ", ["コオケツ", "高潔's spelling reads こうきよし"]],
  ["こっけいせつ", ["コッケエセツ", "国慶節's spelling ends on a different reading of 節"]],
  ["しょうたく", ["ショオタク", "沼沢's spelling reads ぬまさわ"]],
  ["しょうろう", ["ショオロオ", "鐘楼's spelling reads しゅろう"]],
  ["せいぎ", ["セエギ", "正義's spelling reads まさよし, a name"]],
  ["せきどう", ["セキドオ", "赤道's spelling reads あかみち"]],
  ["そうごん", ["ソオゴン", "荘厳's spelling reads しょうごん"]],
  ["ちょうめ", ["チョオメ", "丁目's spelling reads ひのとめ"]],
  ["ちょうきゅう", ["チョオキュウ", "長久's spelling reads ながひさ, a name"]],
  ["ていない", ["テエナイ", "邸内's spelling reads やしきない"]],
  ["はくちょう", ["ハクチョオ", "白鳥's spelling reads しらとり"]],
  ["もくちょう", ["モクチョオ", "木彫's spelling reads きぼり"]],
  ["ようにく", ["ヨオニク", "羊肉's spelling reads ひつじにく"]],
  ["りょうがん", ["リョオガン", "両眼's spelling reads りょうめ"]],
  ["わえい", ["ワエエ", "和英's spelling reads かずひで, a name; the えい is 英, smoothed as in 英語"]],
  ["あっこう", ["アッコオ", "悪口's spelling reads わるぐち"]],
  ["こうや", ["コオヤ", "紺屋's spelling reads こんや and 荒野's reads あらの"]],
  ["ちょうふく", ["チョオフク", "重複's spelling reads じゅうふく"]],
  ["じょうぶ", ["ジョオブ", "丈夫's spelling keeps the vowel literal, alone among its family"]],
  ["おうぎがた", ["オオギガタ", "扇形's spelling reads せんけい"]],
  ["らんけい", ["ランケエ", "卵形's spelling reads たまごがた"]],
  ["りょうふう", ["リョオフウ", "涼風's spelling reads すずかぜ"]],
  ["ほうきょう", ["ホオキョオ", "豊胸's spelling reads ゆたかむね"]],
  ["ぜい", ["ゼエ", "勢's spelling reads いきおい"]],
  ["だいとう", ["ダイトオ", "大刀's spelling reads たち"]],
  ["ほうぼう", ["ホオボオ", "方々's spelling reads かたがた"]],
  ["むぞうさ", ["ムゾオサ", "無造作's spelling adds a mora (むぞうさく)"]],
  ["こうほう", ["コオホオ", "後方 smooths both; 高峰 is read one kanji at a time and smooths neither"]],
  // Words the engine reads one kanji at a time, so it never smooths across the
  // join, and compounds whose spelling picks a fuller reading of a part.
  ["うんどうぶそく", ["ウンドオブソク", "運動不足's spelling reads ふそく without the rendaku"]],
  ["かんみりょう", ["カンミリョオ", "甘味料's spelling reads あまみりょう"]],
  ["おおそうじ", ["オオソオジ", "大掃除's spelling reads だいそうじ"]],
  ["てんのうせい", ["テンノオセエ", "天王星's spelling reads てんおうせい"]],
  ["にほんせい", ["ニホンセエ", "日本製's spelling reads にっぽんせい"]],
  ["にほんけいざい", ["ニホンケエザイ", "日本経済's spelling reads にっぽんけいざい"]],
  ["にほんせいふ", ["ニホンセエフ", "日本政府's spelling reads にっぽんせいふ"]],
  ["にほんりょうり", ["ニホンリョオリ", "日本料理's spelling reads にっぽんりょうり"]],
  ["にほんきぎょう", ["ニホンキギョオ", "日本企業's spelling reads にっぽんきぎょう"]],
  ["さんかくけい", ["サンカクケエ", "三角形's spelling reads さんかっけい"]],
  ["めざましどけい", ["メザマシドケエ", "目覚まし時計's spelling reads とけい without the rendaku"]],
  ["ほようじょ", ["ホヨオジョ", "保養所's spelling reads しょ without the rendaku"]],
  ["りょうようじょ", ["リョオヨオジョ", "療養所's spelling reads しょ without the rendaku"]],
  ["しんりょうじょ", ["シンリョオジョ", "診療所's spelling reads しょ without the rendaku"]],
  ["かくちょうし", ["カクチョオシ", "拡張子's spelling reads こ for 子"]],
  ["きょうこのごろ", ["キョオコノゴロ", "今日この頃's spelling reads ころ without the rendaku"]],
  ["ひょうけいさん", ["ヒョオケエサン", "表計算's spelling reads おもてけいさん"]],
  ["ほうがいい", ["ホオガイイ", "方がいい's spelling reads かたがいい"]],
  // The two vowels belong to different parts of the word, so they stay apart.
  ["そのうえ", ["ソノウエ", "その + うえ: the う starts 上, it does not lengthen その"]],
  ["うれい", ["ウレイ", "憂い: the い is the ending on 憂, not a long vowel"]],
  // Words VOCAB writes in kana, so nothing in the corpus holds the kanji that
  // would tell the engine which word this is. Their kanji spellings were asked
  // by hand, and all five smooth: 梟 フクロオ, 玉蜀黍 トオモロコシ, 到底 トオテエ,
  // 煎餅 センベエ, 銘々 メエメエ. 精々 answers セエ, too short to trust as a
  // witness, but its first half smooths the same way and せいぜい is said
  // "seezee".
  ["ふくろう", ["フクロオ", "written in kana here; 梟 smooths"]],
  ["とうもろこし", ["トオモロコシ", "written in kana here; 玉蜀黍 smooths"]],
  ["とうてい", ["トオテエ", "written in kana here; 到底 smooths both"]],
  ["せんべい", ["センベエ", "written in kana here; 煎餅 smooths"]],
  ["めいめい", ["メエメエ", "written in kana here; 銘々 smooths both"]],
  ["せいぜい", ["セエゼエ", "written in kana here; 精々 answers too short to line up"]],
  // The engine reads 致死量 one kanji at a time and never smooths the 量, while
  // it smooths the same 量 in 甘味料's family. The bare reading smooths it.
  ["ちしりょう", ["チシリョオ", "致死量 is read one kanji at a time and smooths nothing"]],
  // Two readings where a word written in kana shares the reading with kanji
  // words and the two would otherwise clash.
  ["は", ["ハ", "刃 歯 派 葉 all say ハ; the particle は is spoken alone as the kana card's ハ too"]],
  ["せい", ["セエ", "姓 性 製 all smooth; the kana せい (所為) is the same sound, and bare えい never smooths on its own"]],
]);

/** Hold a hand-written answer against the reading it claims to be about: same
 * number of beats, and every mora it changes has to be one of the two a word is
 * ever allowed to change: a long-vowel site, or a real particle. Returns the
 * complaint, or null when the entry is sound. */
export function checkHandDecision(reading, wanted) {
  const literal = literalMoras(reading);
  const expected = moraeOf(wanted);
  if (expected.length !== literal.length) {
    return `${reading}: hand answer ${wanted} has ${expected.length} beat(s), the reading has ${literal.length}`;
  }
  const siteAt = new Map(longVowelSites(literal).map((s) => [s.index, s]));
  for (let i = 0; i < literal.length; i++) {
    if (expected[i] === literal[i]) continue;
    const site = siteAt.get(i);
    if (site && expected[i] === site.smoothTo) continue;
    if (PARTICLE_SOUND.get(literal[i]) === expected[i]) continue;
    return `${reading}: hand answer ${wanted} changes beat ${i + 1} from ${literal[i]} to ${expected[i]}, which is not a long vowel or a particle`;
  }
  return null;
}

/**
 * What a reading should sound like, and how sure we are.
 *
 * `witness` is the engine's reading of the word written normally, or null when
 * the word has no separate normal spelling. It is only believed when it lines
 * up with `literal` beat for beat: same length, and every mora either identical
 * or one of the two allowed differences (a long-vowel site, a real particle).
 */
export function expectedFor({ literal, sites, witness }) {
  const expected = [...literal];
  if (!witness) return { expected, lined: false };
  if (witness.length !== literal.length) return { expected, lined: false };
  const siteAt = new Map(sites.map((s) => [s.index, s]));
  for (let i = 0; i < literal.length; i++) {
    if (witness[i] === literal[i]) continue;
    const site = siteAt.get(i);
    if (site && witness[i] === site.smoothTo) {
      expected[i] = site.smoothTo;
      continue;
    }
    if (PARTICLE_SOUND.get(literal[i]) === witness[i]) {
      expected[i] = witness[i];
      continue;
    }
    return { expected: [...literal], lined: false };
  }
  return { expected, lined: true };
}

// ----------------------------------------------------------- the ladder

const HIRAGANA_LONG = new Map([
  ["オ", "お"],
  ["エ", "え"],
]);
const KATAKANA_VOWEL = new Map([
  ["オ", "オ"],
  ["エ", "エ"],
]);

/** Rewrite `reading` with the smoothed sites spelled out, in one of the three
 * ways the engine understands: ー, the plain vowel kana, or neither. */
function respell(reading, smoothedSites, { katakana, mark }) {
  const moras = moraeOf(katakana ? toKatakana(reading) : reading);
  for (const site of smoothedSites) {
    if (site.index >= moras.length) continue;
    moras[site.index] = mark
      ? "ー"
      : katakana
        ? KATAKANA_VOWEL.get(site.smoothTo)
        : HIRAGANA_LONG.get(site.smoothTo);
  }
  return moras.join("");
}

/** The texts to try for one reading, in the order they are tried. Deduped, so a
 * reading with nothing to smooth does not ask the engine the same question six
 * times.
 *
 * Plain katakana comes second, ahead of the ー-marked forms, for two reasons.
 * It is the swap this codebase already ships and has already verified by ear
 * for ninety-odd readings, so a reading that was already right keeps the exact
 * text it had. And it changes the spelling least: ー and え/お are spellings the
 * word does not have, and the engine's guess at where the voice drops is
 * noticeably more jumpy for them. */
export function candidateTexts(reading, smoothedSites, kebs) {
  const out = [
    reading,
    toKatakana(reading),
    respell(reading, smoothedSites, { katakana: false, mark: true }),
    respell(reading, smoothedSites, { katakana: false, mark: false }),
    respell(reading, smoothedSites, { katakana: true, mark: true }),
    respell(reading, smoothedSites, { katakana: true, mark: false }),
    ...kebs.filter((keb) => keb !== reading),
  ];
  return [...new Set(out.filter(Boolean))];
}

// ------------------------------------------------------------ the work

/** Decide one reading: what it should sound like, what to send, and why.
 *
 * `sounds` is a cache-backed lookup so the caller controls how the engine is
 * reached (the two modes ask slightly different questions). */
async function decideReading(reading, kebs, sounds) {
  const literal = literalMoras(reading);
  const sites = longVowelSites(literal);
  const spellings = kebs.filter((keb) => keb !== reading);

  const hand = HAND_DECIDED.get(reading);
  let expected;
  let lined;
  let witnesses = [];
  if (hand) {
    expected = moraeOf(hand[0]);
    lined = true;
  } else if (spellings.length === 0) {
    // No second witness and none needed: the word's normal spelling IS the
    // reading, so the engine's own answer for it is the word said as written.
    expected = (await sounds(reading)).moras;
    lined = true;
  } else {
    const voters = [...spellings];
    witnesses = (await Promise.all(spellings.map((keb) => sounds(keb)))).map((a) => a.moras);
    const votes = witnesses.map((witness) => expectedFor({ literal, sites, witness }));
    if (kebs.length !== spellings.length) {
      // One of the words sharing this reading is written in kana, so for THAT
      // word the reading already is the normal spelling and the engine's own
      // answer is its vote, counted here so a kana word cannot be quietly
      // overruled by a kanji one that wants different sounds (こう is both the
      // plain adverb, said コオ, and 乞う, said コウ).
      const own = (await sounds(reading)).moras;
      voters.push(reading);
      witnesses.push(own);
      votes.push({ expected: own, lined: true });
    }
    const linedVotes = votes.filter((v) => v.lined);
    const unresolved = (status, why) => ({
      reading,
      kebs,
      literal,
      sites,
      status,
      why,
      before: null,
      witnesses: voters.map((keb, i) => ({ keb, moras: witnesses[i] })),
    });
    if (linedVotes.length === 0) {
      const out = unresolved("undecided", "no normal spelling lines up with the taught reading");
      out.before = (await sounds(reading)).moras;
      return out;
    }
    const first = linedVotes[0].expected.join("|");
    if (linedVotes.some((v) => v.expected.join("|") !== first)) {
      const out = unresolved("clash", "two words share this reading and want different sounds");
      out.before = (await sounds(reading)).moras;
      return out;
    }
    expected = linedVotes[0].expected;
    lined = true;
  }

  const smoothedSites = sites.filter((s) => expected[s.index] === s.smoothTo);
  const plain = await sounds(reading);
  const before = plain.moras;
  // How many pieces the engine may break the sent text into. The reading on its
  // own sets the floor; the word written normally is allowed to raise it,
  // because a compound that really is two words (休憩時間) is said in two
  // pieces and there is nothing wrong with that.
  const phraseBudget = Math.max(
    plain.phrases,
    ...(await Promise.all(spellings.map((keb) => sounds(keb)))).map((said) => said.phrases),
  );
  if (before.join("|") === expected.join("|")) {
    return { reading, kebs, literal, expected, before, status: "already-right", lined };
  }

  const tried = [];
  for (const text of candidateTexts(reading, smoothedSites, kebs)) {
    const said = await sounds(text);
    tried.push({ text, moras: said.moras, phrases: said.phrases });
    // A spelling that makes the engine break the word into more pieces than the
    // budget allows puts a pause inside the word: ホントウ comes out
    // ホン + トオ, two phrases, where ほんとう and 本当 are both one. Right
    // sounds, wrong delivery, so it does not count as a fix.
    if (said.moras.join("|") === expected.join("|") && said.phrases <= phraseBudget) {
      return { reading, kebs, literal, expected, before, text, tried, status: "fixed", lined };
    }
  }
  return { reading, kebs, literal, expected, before, tried, status: "unfixable", lined };
}

/** Why a fixed reading needed fixing, for the report's tally. */
function reasonFor(result) {
  const { literal, expected, before } = result;
  const wrongConsonant = before.length !== literal.length || literal.some((m, i) => {
    const wasLongVowelChange = expected[i] !== literal[i];
    return !wasLongVowelChange && before[i] !== m;
  });
  const vowelChanged = expected.some((m, i) => m !== literal[i]);
  if (wrongConsonant && vowelChanged) return "consonant and long vowel";
  if (wrongConsonant) return "wrong consonant";
  return "long vowel";
}

async function run({ check, reportFile }) {
  const base = engineBase();
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) {
    console.error(`Refusing to run against a non-local engine (${base}). This makes thousands of requests.`);
    process.exit(1);
  }
  const sounds = (text) => askEngine(base, text);
  const population = speechPopulation();
  const readings = [...population.keys()];

  const handProblems = [];
  for (const [reading, [wanted]] of HAND_DECIDED) {
    if (!population.has(reading)) handProblems.push(`${reading}: hand-decided but no word is taught under it`);
    else {
      const complaint = checkHandDecision(reading, wanted);
      if (complaint) handProblems.push(complaint);
    }
  }
  if (handProblems.length) {
    console.error("HAND_DECIDED has problems:");
    for (const p of handProblems) console.error(`  ${p}`);
    process.exit(1);
  }

  console.info(`${readings.length} reading(s) across ${VOCAB.length} word(s), engine=${base}`);

  const results = await inParallel(readings, (reading) => decideReading(reading, population.get(reading), sounds));

  const tally = {};
  for (const r of results) tally[r.status] = (tally[r.status] ?? 0) + 1;
  const fixed = results.filter((r) => r.status === "fixed");
  const byReason = {};
  for (const r of fixed) {
    const reason = reasonFor(r);
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  // The pitch clips overlay a High/Low pattern mora by mora, so a text that
  // says the word in a different number of beats would put the drop in the
  // wrong place. Expected is built from the reading's own moras and the sent
  // text is only kept when the engine matches expected exactly, so this can
  // only fail if one of those two invariants broke.
  const beatDrift = fixed.filter((r) => r.expected.length !== moraeOf(r.reading).length);

  const table = Object.fromEntries(fixed.map((r) => [r.reading, r.text]).sort((a, b) => (a[0] < b[0] ? -1 : 1)));

  console.info(
    [
      "",
      `already right   ${tally["already-right"] ?? 0}`,
      `fixed           ${fixed.length}   ${Object.entries(byReason).map(([k, v]) => `${k} ${v}`).join(", ")}`,
      `nothing works   ${tally.unfixable ?? 0}`,
      `clashing words  ${tally.clash ?? 0}`,
      `no witness      ${tally.undecided ?? 0}`,
      `beat drift      ${beatDrift.length}`,
      "",
    ].join("\n"),
  );

  if (reportFile) {
    writeFileSync(reportFile, JSON.stringify(results, null, 1));
    console.info(`detail written to ${reportFile}`);
  }

  if (check) {
    const current = (await import("../src/data/generated/speech-overrides.json", { with: { type: "json" } })).default;
    const problems = [];
    for (const [reading, text] of Object.entries(current)) {
      if (table[reading] !== text) {
        problems.push(`${reading}: table says ${text}, the engine now wants ${table[reading] ?? "no override"}`);
      }
    }
    for (const reading of Object.keys(table)) {
      if (!(reading in current)) problems.push(`${reading}: needs ${table[reading]} but the table has no entry`);
    }
    for (const r of beatDrift) problems.push(`${r.reading}: ${r.expected.length} beats, the reading has ${moraeOf(r.reading).length}`);
    if (problems.length) {
      console.error(`--check FAILED, ${problems.length} problem(s):`);
      for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
      process.exit(1);
    }
    console.info(`--check passed: ${Object.keys(current).length} override(s) all still say the expected sounds.`);
    return;
  }

  writeFileSync(TABLE_FILE, JSON.stringify(table, null, 1) + "\n");
  console.info(`wrote ${Object.keys(table).length} override(s) to ${TABLE_FILE.pathname}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const report = args.find((a) => a.startsWith("--report="));
  run({ check: args.includes("--check"), reportFile: report?.slice("--report=".length) });
}
