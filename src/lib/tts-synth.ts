// VOICEVOX-backed synthesis — the ONE TTS engine in the app (SAK-100). Used by
// both /api/tts (general speech: quiz prompts, listening exercises, the
// ordinary Hear button, anywhere in the app) and /api/pitch-tts (a word's
// EXACT known pitch-accent clip on the Library word page).
//
// This replaces two things that used to exist separately:
//   - Azure REST synthesis (the old tts-synth.ts), which sounded natural but
//     spoke with its OWN accent, never a word's real pitch.
//   - pitch-tts-synth.ts, which used VOICEVOX but only for a single word with
//     an already-known downstep.
// VOICEVOX (self-hosted, github.com/VOICEVOX/voicevox_engine) exposes the one
// thing Azure never could: a per-mora pitch value a caller can hand-edit
// before synthesis, for ANY input text, one word or a whole sentence.
// POST /audio_query gets the engine's own reading + pitch guess; edit
// `accent_phrases[].moras[].pitch`; POST the edited JSON to /synthesis and get
// WAV bytes back with exactly that contour.
//
// TWO CORRECTION STRATEGIES, ONE SYNTHESIS PATH
// ===============================================
//   synthesizeWordWav   — the caller already knows the EXACT downstep (a
//                          verified Kanjium row, resolved by the word page
//                          against the word's taught reading). Every mora in
//                          the query gets that one pattern; no guessing.
//   synthesizeSentenceWav — arbitrary text (a full sentence, or any word not
//                          already resolved to an exact downstep). Each
//                          VOICEVOX accent phrase is matched independently
//                          against the pitch dataset (src/lib/sentence-pitch.ts)
//                          and corrected where a confident match exists; left
//                          at VOICEVOX's own natural contour where it doesn't.
// Both funnel through the same natural-range measurement and the same
// /synthesis call — there is exactly one degree of freedom between them (how
// the target pattern for each phrase is decided), not two maintained engines.
//
// STAYING INSIDE THE VOICE'S NATURAL RANGE
// =========================================
// A prior research spike (SAK-6) found that hand-set pitch values outside the
// voice's own natural range make the vocoder produce quiet, scratchy audio.
// The fix: measure the voice's actual pitch range from a filler sentence's own
// /audio_query (its non-zero mora pitches), once, and map the desired
// High/Low pattern onto points a small margin IN FROM each end of that
// measured range — never fixed absolute pitches, never the raw extremes.
//
// Server-only: reads VOICEVOX_ENGINE_URL and does network POSTs. Never import
// this from client code (see /api/tts/route.ts and /api/pitch-tts/route.ts,
// the two callers).

import { pitchPatternForLength } from "@/lib/pitch";
import { toKatakana } from "@/lib/romaji";
import {
  correctSentencePitch,
  type AccentPhraseLike,
} from "@/lib/sentence-pitch";

// Individual WORD readings (as opposed to the single bare kana glyph below)
// where VOICEVOX's own text analyzer (OpenJTalk) mis-segments the hiragana
// reading, confirmed live (SAK-215). This is NOT applied blanket to every
// reading that passes through this path — an early version of this fix tried
// exactly that (unconditional hiragana→katakana for every reading) and it
// was WRONG: こんにちは/こんばんは are genuinely, correctly read コンニチワ/
// コンバンワ by OpenJTalk's hiragana-mode analysis (は as a fossilized topic
// particle is really pronounced わ there), and forcing katakana input breaks
// them (コンニチハ literal, verified live). A blanket rule can't tell "OpenJTalk
// is wrong" (八/はち) apart from "OpenJTalk is right about a real exception"
// (こんにちは) from the mora text alone — both LOOK like a は→わ "mismatch."
//
// The mechanical test that DOES tell them apart: does the SAME word, spelled
// with its real KANJI and dropped into a trivial sentence (`{keb}です`), still
// analyze the target syllable as わ/え? A kanji spelling anchors OpenJTalk's
// dictionary lookup, so context reliably resolves ordinary words to their
// correct reading (verified live: これは八です → コレワハチデス, はちです →
// ハチデス — even bare hiragana + a trailing copula is enough once there's
// SOME context) — it's only the fully bare, context-free 2-character reading
// `synthesizeAtDownstep` actually sends that OpenJTalk mis-segments. A
// genuine lexicalized exception stays わ/え even WITH context (実は → verified
// live ジツワイソガシイデス "実は忙しいです"; 願わくは → ネガワクワハレテホシイ
// "願わくは晴れてほしい" — both still わ), because their わ-pronunciation is a
// fact about that word, not an artifact of missing context.
//
// So the actual process for every entry below: pulled every reading in the
// actually-seeded pitch word set (scripts/seed-voice-audio.mjs's
// pitchItems(), ~8,000 distinct readings) where a bare hiragana query and a
// bare katakana query disagree AND the disagreement is specifically a は→わ
// or へ→え swap (the same class of error BARE_KANA_PARTICLE_MISREADING below
// already fixes for a single bare glyph); EXCLUDED anything with no kanji
// spelling (keb === reb — nothing here qualifies, but that's the line a
// legitimate こんにちは-type exception would need to cross to even be
// considered); then ran the `{keb}です` context test on every remaining
// candidate. 実は and 願わくは kept わ under context and were dropped as
// genuine exceptions. 栄え (はえ, a rarer reading of 栄える-family kanji) was
// dropped as UNVERIFIABLE — its context test resolved to a different, more
// common reading of the same kanji (さかえ) entirely, not a confirmation or
// denial of the はえ reading this app actually wants, so there is no honest
// mechanical answer for it either way; it is left unfixed rather than guessed.
// Every reading below held its は/へ under context and is a confirmed bug.
//
// SAK-218 generalized this same mechanical test PAST the は/へ pattern: for
// every distinct reading in the seeded pitch word set with a kanji spelling
// (scripts/seed-voice-audio.mjs's pitchItems(), cross-referenced against
// VOCAB for keb !== reb, same field-level check as above), compared the bare
// reading's own hiragana analysis against BOTH (a) that reading's bare
// KATAKANA analysis (toKatakana(reading) — a literal, no-particle-guessing
// per-character reading, same oracle BARE_KANA_PARTICLE_MISREADING already
// trusts below) and (b) the `{keb}です` context analysis, with no pre-filter
// to any specific character. 7,880 distinct readings tested; 893 showed ANY
// disagreement between bare-hiragana and kanji-context. The overwhelming
// majority of those 893 were noise: 76 were the context template picking a
// different, unintended reading of an ambiguous kanji spelling entirely
// (e.g. この頃 resolving to コノコロデス instead of コノゴロデス — 頃 genuinely
// has both readings; not a bare-reading bug) — unverifiable by this method
// and left alone, same discipline as 栄え below. The rest — roughly 800 —
// were long-vowel realization noise (おう/えい sequences alternating between
// their literal moras and a merged long vowel, e.g. あっとう vs アットオ):
// checked directly against the engine's own vowel-phoneme field (not just
// mora text) and confirmed REAL at the phoneme level for several samples,
// but the merge/no-merge direction flips inconsistently per word — some
// words merge in hiragana bare and not katakana, others the reverse
// (えいきょう vs めんどう, verified live) — with no reliable "hiragana is
// wrong" story the way は/へ has one, and no way to confirm audibility
// without literally listening. Left unfixed as unverified noise, matching
// this ticket's own instruction not to count every disagreement as a bug.
//
// What was left after both filters: exactly 8 new confirmed bugs, all one
// shared failure mode — a word-final bare mora that should carry a real
// vowel comes out either voiceless/dropped (っ with no vowel: さつ-family)
// or with the WRONG vowel quality entirely (う-ending verbs read with an
// あ-vowel: つかう/あらう) — verified via BOTH toKatakana AND `{keb}です`
// agreeing on the correct reading against the broken bare hiragana one,
// same two-witness confirmation は/へ below already relies on:
//   さつ 冊/札 (also 銃殺/毒殺/入札/分冊/競争入札, all share this exact
//     failure): bare "さつ" analyzes as ["サ","ッ"] — a geminate stop with NO
//     vowel, i.e. the word gets truncated/cut off; toKatakana("サツ") and
//     "冊です" both correctly analyze as ["サ","ツ"]. Two different VOCAB
//     words (冊 counter, 札 "bill") share this exact reading+downstep slot
//     (pitchItems() dedup) — no conflict, both want サツ, neither has any
//     reason to want the truncated form.
//   つかう 使う "to use": bare analyzes as ["ツ","カ","ア"] — the dictionary-
//     form verb ending う is read as あ, not う. toKatakana("ツカウ") and
//     "使うです" both correctly give ["ツ","カ","ウ"].
//   あらう 洗う "to wash": same failure as つかう, same fix (アラア → アラウ,
//     confirmed via both toKatakana and "洗うです").
// Every entry below held its bug under BOTH the katakana oracle and kanji
// context — the same double-confirmation は/へ's 26 entries already use.
const CONFIRMED_BAD_READINGS: readonly string[] = [
  "はち", // 八 "eight" (SAK-215's reported bug), also 鉢 "bowl" / 蜂 "bee".
  "は", // 歯 "tooth", also 葉 "leaf".
  "はは", // 母 "mother".
  "はで", // 派手 "flashy".
  "はば", // 幅 "width".
  "はだ", // 肌 "skin".
  "はてる", // 果てる "to come to an end".
  "はやす", // 生やす "to grow (hair/beard)".
  "はやめる", // 早める "to hasten".
  "はきょく", // 破局 "breakup/catastrophe".
  "はいこう", // 廃坑 "abandoned mine".
  "はくがく", // 博学 "erudition".
  "はきもの", // 履物 "footwear".
  "はたいろ", // 旗色 "how the battle is going".
  "はなしごえ", // 話し声 "the sound of talking".
  "はみがき", // 歯磨き "toothbrushing".
  "はブラシ", // 歯ブラシ "toothbrush".
  "はっしょう", // 発症 "onset (of symptoms)".
  "しはい", // 支配 "control/domination".
  "このは", // 木の葉 "leaves of a tree".
  "たいはいてき", // 退廃的 "decadent".
  "へいはつ", // 併発 "co-occurrence (of symptoms)".
  "へいこう", // 平衡 "equilibrium".
  "へいきんてき", // 平均的 "average".
  "いどうへいきん", // 移動平均 "moving average".
  "ふこうへい", // 不公平 "unfairness".
  // SAK-218's new confirmed bugs (see this comment block's header for the
  // broader method):
  "さつ", // 冊 "counter for bound volumes", also 札 "bill/note".
  "つかう", // 使う "to use".
  "じゅうさつ", // 銃殺 "shooting to death" — same さつ-final failure.
  "あらう", // 洗う "to wash".
  "どくさつ", // 毒殺 "poisoning to death" — same さつ-final failure.
  "にゅうさつ", // 入札 "bid/tender" — same さつ-final failure.
  "ぶんさつ", // 分冊 "separate volume" — same さつ-final failure.
  "きょうそうにゅうさつ", // 競争入札 "competitive bidding" — same さつ-final failure.
];

// Each bad reading's katakana form is DERIVED via toKatakana rather than
// hand-typed a second time, so the fix stays exactly what was verified live
// (feed the SAME reading back in katakana) with no chance of a typo drifting
// the two apart. Adding a newly-confirmed bad reading only ever means adding
// one string to the list above.
const WORD_READING_MISREADING: ReadonlyMap<string, string> = new Map(
  CONFIRMED_BAD_READINGS.map((reading) => [reading, toKatakana(reading)]),
);

/** Swap an EXACT, individually-confirmed-bad word reading for its katakana
 * form before it reaches VOICEVOX. Never a blanket hiragana→katakana
 * conversion (see WORD_READING_MISREADING's comment for why that broke
 * こんにちは-type words) — only the specific readings verified live to be
 * mis-segmented by OpenJTalk get swapped; everything else passes through
 * exactly as VOICEVOX's own hiragana-mode analysis already handles it. */
function readingForMisreadingFix(reading: string): string {
  return WORD_READING_MISREADING.get(reading) ?? reading;
}

// A short, common phrase, guaranteed to carry several voiced moras across a
// real pitch swing, used only to measure the voice's natural pitch range.
const FILLER_TEXT = "おはようございます";

// VOICEVOX's own text analyzer (OpenJTalk) reads a BARE は or へ — no
// sentence around it to disambiguate — as the topic/direction PARTICLE
// (わ/え), not the plain mora (は/へ). Verified live against the engine
// (SAK-178): audio_query on "は" alone comes back with mora text "ワ"; on "ハ"
// (katakana) it comes back "ハ", the reading actually wanted. Same story for
// へ → "エ" vs ヘ → "ヘ". A real word CONTAINING one of these characters
// (はな, へや, ...) is unaffected either way — OpenJTalk already resolves the
// correct mora from the surrounding characters (audio_query on "はな" already
// returns ["ハ","ナ"] whether or not this map is applied) — so this only
// needs to fire for the single-character case a bare kana Hear button (the
// kana teaching card, mnemonic-view.tsx) actually sends. Katakana has no
// particle reading to default to, so substituting it sidesteps the analyzer's
// ambiguity without touching what the learner sees: only the string handed to
// VOICEVOX changes, never the glyph rendered in the UI or matched elsewhere.
const BARE_KANA_PARTICLE_MISREADING: ReadonlyMap<string, string> = new Map([
  ["は", "ハ"],
  ["へ", "ヘ"],
]);

/** Swap only an EXACT, standalone は/へ for its katakana twin before it
 * reaches VOICEVOX — never a substring match, so a real word or sentence that
 * merely contains one of these characters passes through untouched. */
function textForBareKanaFix(text: string): string {
  return BARE_KANA_PARTICLE_MISREADING.get(text) ?? text;
}

// How far in from each end of the measured natural range a High/Low target
// sits. 0 would use the extremes themselves (the scratchy-audio failure mode
// SAK-6 hit); this is the margin that spike's listening tests landed on.
const RANGE_MARGIN_FRACTION = 0.15;

function engineUrl(): string | undefined {
  const u = process.env.VOICEVOX_ENGINE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** Whether VOICEVOX is configured at all. When false, both routes answer a
 * clean 503. */
export function ttsConfigured(): boolean {
  return !!engineUrl();
}

interface VoicevoxMora {
  pitch: number;
  text: string;
  [key: string]: unknown;
}
interface VoicevoxAccentPhrase {
  moras: VoicevoxMora[];
  [key: string]: unknown;
}
interface VoicevoxAudioQuery {
  accent_phrases: VoicevoxAccentPhrase[];
  [key: string]: unknown;
}

async function audioQuery(
  base: string,
  text: string,
  speakerId: number,
): Promise<VoicevoxAudioQuery> {
  const url = `${base}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`VOICEVOX audio_query ${res.status} ${res.statusText}`);
  return (await res.json()) as VoicevoxAudioQuery;
}

function flatMoras(query: VoicevoxAudioQuery): VoicevoxMora[] {
  return query.accent_phrases.flatMap((p) => p.moras);
}

// Each voice's own natural pitch range, measured once per server instance (a
// running server's VOICEVOX voices do not change between requests) and reused
// for every synthesis after the first. Keyed by speaker id — a range measured
// for one voice is meaningless applied to another's pitch values.
const cachedRanges = new Map<number, { min: number; max: number }>();

async function naturalRange(base: string, speakerId: number): Promise<{ min: number; max: number }> {
  const cached = cachedRanges.get(speakerId);
  if (cached) return cached;
  const query = await audioQuery(base, FILLER_TEXT, speakerId);
  const pitches = flatMoras(query)
    .map((m) => m.pitch)
    .filter((p) => p > 0); // 0 marks a silent/devoiced mora, not a real pitch
  if (pitches.length === 0) throw new Error("VOICEVOX filler query returned no voiced moras");
  const range = { min: Math.min(...pitches), max: Math.max(...pitches) };
  cachedRanges.set(speakerId, range);
  return range;
}

async function targetRange(base: string, speakerId: number): Promise<{ low: number; high: number }> {
  const { min, max } = await naturalRange(base, speakerId);
  const margin = (max - min) * RANGE_MARGIN_FRACTION;
  return { low: min + margin, high: max - margin };
}

async function synthesize(base: string, speakerId: number, query: VoicevoxAudioQuery): Promise<ArrayBuffer> {
  const res = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`VOICEVOX synthesis ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}

/**
 * Synthesize `reading` (kana) at its own EXACT, already-known pitch-accent
 * pattern (`downstep`, the mora position of the drop — see src/lib/pitch.ts)
 * to WAV bytes. The caller (the word page, via /api/pitch-tts) has already
 * resolved and validated `downstep` against a verified Kanjium row, so every
 * mora in the query gets that one pattern — no fuzzy matching, unlike
 * `synthesizeSentenceWav`.
 *
 * Throws on any failure (unconfigured engine, unreachable, bad response) so
 * the route can turn that into a clean 503/502 rather than an unhandled error.
 */
/** Render `query`'s moras to `downstep`'s H/L pattern, in place, and
 * synthesize. `downstep` is just a number here — the caller (a real word's
 * verified pitch, or a quiz distractor's deliberately different one, see
 * src/lib/pitch.ts's wrongDownstepFor) already decided which one it wants;
 * this has no notion of "correct" or "wrong" pitch, only "this pattern." */
async function synthesizeAtDownstep(
  base: string,
  speakerId: number,
  reading: string,
  downstep: number,
): Promise<ArrayBuffer> {
  const { low, high } = await targetRange(base, speakerId);
  const query = await audioQuery(base, readingForMisreadingFix(reading), speakerId);
  const moras = flatMoras(query);
  const pattern = pitchPatternForLength(moras.length, downstep);
  for (let i = 0; i < moras.length; i++) {
    if (moras[i].pitch <= 0) continue;
    moras[i].pitch = pattern[i].high ? high : low;
  }
  return synthesize(base, speakerId, query);
}

/**
 * Synthesize `reading` (kana) at its own EXACT, already-known pitch-accent
 * pattern (`downstep`, the mora position of the drop — see src/lib/pitch.ts)
 * to WAV bytes. The caller (the word page, via /api/pitch-tts) has already
 * resolved and validated `downstep` against a verified Kanjium row, so every
 * mora in the query gets that one pattern — no fuzzy matching, unlike
 * `synthesizeSentenceWav`.
 *
 * Throws on any failure (unconfigured engine, unreachable, bad response) so
 * the route can turn that into a clean 503/502 rather than an unhandled error.
 */
export async function synthesizeWordWav(
  reading: string,
  downstep: number,
  speakerId: number,
): Promise<ArrayBuffer> {
  const base = engineUrl();
  if (!base) throw new Error("VOICEVOX not configured (VOICEVOX_ENGINE_URL).");
  return synthesizeAtDownstep(base, speakerId, reading, downstep);
}

export interface SentenceSynthResult {
  bytes: ArrayBuffer;
  /** Sentence-level pitch match coverage for this one synthesis — how many of
   * VOICEVOX's own accent phrases got a confident dictionary match and were
   * corrected, out of the total. Reported by /api/tts callers that want it;
   * not persisted anywhere. */
  totalPhrases: number;
  matchedPhrases: number;
}

/**
 * Synthesize arbitrary `text` — a full sentence or a single word — to WAV
 * bytes, applying pitch correction PER ACCENT PHRASE wherever the phrase's
 * own reading confidently matches the pitch dataset (see
 * src/lib/sentence-pitch.ts), and leaving VOICEVOX's own natural contour
 * everywhere it doesn't. This is the general path: every ordinary Hear
 * button, quiz prompt and listening exercise in the app goes through this.
 *
 * Throws on any failure, same discipline as `synthesizeWordWav`.
 */
export async function synthesizeSentenceWav(
  text: string,
  speakerId: number,
): Promise<SentenceSynthResult> {
  const base = engineUrl();
  if (!base) throw new Error("VOICEVOX not configured (VOICEVOX_ENGINE_URL).");

  const target = await targetRange(base, speakerId);
  // This bare-single-character fix stays narrow to this path, and stays
  // SEPARATE from synthesizeAtDownstep's own WORD_READING_MISREADING map
  // (SAK-215) rather than merging into one map or one blanket rule. `text`
  // here is arbitrary — a full sentence, mixed kanji and kana, or a word not
  // yet resolved to an exact downstep — and OpenJTalk's hiragana-mode
  // analysis is frequently RIGHT about things a blanket katakana conversion
  // would get wrong (こんにちは → コンニチワ is a real, correct, lexicalized
  // は→わ exception; forcing katakana input renders it コンニチハ, verified
  // live). Only the single bare-glyph case this map covers (a Hear button
  // with no surrounding sentence to disambiguate は/へ) is unambiguous enough
  // to fix blindly; everything else here is left for OpenJTalk's own
  // judgment, same as before.
  const query = await audioQuery(base, textForBareKanaFix(text), speakerId);
  const { totalPhrases, matchedPhrases } = correctSentencePitch(
    query.accent_phrases as AccentPhraseLike[],
    target,
  );

  const bytes = await synthesize(base, speakerId, query);
  return { bytes, totalPhrases, matchedPhrases };
}
