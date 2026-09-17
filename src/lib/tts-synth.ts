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
import {
  correctSentencePitch,
  type AccentPhraseLike,
} from "@/lib/sentence-pitch";
import speechOverrides from "@/data/generated/speech-overrides.json" with { type: "json" };

// WHAT TEXT ACTUALLY REACHES THE ENGINE, AND WHY IT IS NOT ALWAYS THE READING
// ============================================================================
// The app speaks a word from its kana reading, and bare kana is the input
// VOICEVOX's text analyzer (OpenJTalk) is worst at. It reads a は or へ inside
// a reading as a particle (はちがつ comes out ワチガツ), drops a consonant
// outright (しひ comes out シイ), cuts a word short (せんえんさつ comes out
// センエンサッ), and leaves a long vowel literal or smooths one that should
// stay (せんせい comes out センセイ where a speaker says センセエ; かこう comes
// out カコオ where 囲う's う is the verb's own ending).
//
// So the reading is not always what gets sent. `speech-overrides.json` says,
// for each reading that needs one, the text to send instead: a katakana twin,
// a form with the long vowel spelled out, or the word's kanji. It is generated
// by scripts/build-speech-overrides.mjs, which asks the engine what it will say
// before it says it (POST /audio_query reports the exact moras) and keeps only
// a text the engine gets right. That script's own header explains how the
// expected sounds are worked out and what it refuses to guess; this file just
// applies the answer.
//
// THIS IS NOT A BLANKET HIRAGANA-TO-KATAKANA SWAP
// ================================================
// An early version of this fix (SAK-215) tried exactly that, and it was WRONG:
// こんにちは/こんばんは are genuinely, correctly read コンニチワ/コンバンワ by
// OpenJTalk's hiragana-mode analysis (は as a fossilized topic particle really
// is pronounced わ there), and forcing katakana input breaks them (コンニチハ
// literal, verified live). A blanket rule cannot tell "OpenJTalk is wrong"
// (八/はち) apart from "OpenJTalk is right about a real exception" (こんにちは)
// from the mora text alone, because both LOOK like a は→わ mismatch.
//
// The mechanical test that DOES tell them apart, and that the generator is
// built on: does the SAME word, spelled with its real KANJI, still analyze the
// target syllable as わ/え? A kanji spelling anchors OpenJTalk's dictionary
// lookup, so context resolves ordinary words to their correct reading, while a
// genuine lexicalized exception stays わ even with the kanji there (実は →
// ジツワ, verified live) because its わ is a fact about that word. こんにちは
// has no kanji spelling in the corpus at all, so nothing ever overrules the
// engine's own reading of it, and it keeps コンニチワ.
//
// WHAT THE GENERATED TABLE REPLACED
// ==================================
// SAK-215/218/219/243 built this list by hand, one reading at a time, and got
// to 95 entries across four passes: the は/へ misreadings, a word-final mora
// coming out voiceless (さつ), う-ending verbs read with an あ vowel, and 57
// long-vowel merges. Two clusters were written off there as unfixable, and the
// generated table fixes both. The へ+い words (へいえき, へいれつ, せいへき),
// where the old katakana swap dropped the ヘ and only a spelled-out long vowel
// or the kanji keeps it, and the eight う-ending verbs (囲う, 沿う, 問う …),
// where only the kanji spelling keeps the ending. Every one of those 95
// hand-verified readings is still overridden, and tts-synth.test.ts pins them.
//
// Nineteen of the 95 now send a different text than the hand list did, for the
// same sounds: a katakana twin that made the engine break the word into two
// accent phrases (ホントウ comes out ホン + トオ, a pause in the middle of
// 本当) loses to a spelling that keeps the word in one piece.
//
// Exported (SAK-217) so scripts/invalidate-stale-pitch-clips.mjs can compute
// exactly which already-cached Storage clips were synthesized under the old
// pronunciation and need deleting before a re-seed can fix them. Re-typing
// this list a second time in the cleanup script would risk it silently
// drifting from the one this file actually applies.
export const CONFIRMED_BAD_READINGS: readonly string[] = Object.keys(speechOverrides);

const WORD_READING_MISREADING: ReadonlyMap<string, string> = new Map(
  Object.entries(speechOverrides),
);

/** Swap an EXACT word reading for the text that makes VOICEVOX say it right.
 * Never a blanket hiragana→katakana conversion (see the comment above for why
 * that broke こんにちは-type words). Only the readings the generator proved
 * against the live engine get swapped, each for whatever spelling that reading
 * needs; everything else passes through exactly as VOICEVOX's own hiragana-mode
 * analysis already handles it.
 *
 * Exported (SAK-219) so every OTHER synthesis path that can send one of these
 * confirmed-bad readings bare and standalone — scripts/seed-voice-audio.mjs's general
 * text sets (words/sentences/kana/yomi/word-examples/grammar-derive, via its
 * own `synthesizeText`) and `synthesizeSentenceWav` below (the live /api/tts
 * fallback, gated there to an exact whole-string match only — see that
 * function's own comment) — reuses this SAME map, rather than a second copy
 * that could silently drift from it. */
export function readingForMisreadingFix(reading: string): string {
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

/** SAK-219: extends `synthesizeSentenceWav`'s bare-glyph fix above to the
 * OTHER exact-match exception list `synthesizeAtDownstep` already uses for
 * the pitch path (`WORD_READING_MISREADING`/`CONFIRMED_BAD_READINGS`,
 * SAK-215/218) — reusing that SAME map via `readingForMisreadingFix`, not a
 * second copy of it. Composing the two here (rather than merging them into
 * one map) keeps each fix's own scope exactly as narrow as it always was:
 * `textForBareKanaFix` only ever matches a single bare は/へ, and
 * `readingForMisreadingFix` is a plain `Map.get` — an EXACT, whole-string
 * match against one of the overridden readings only, NEVER a substring
 * match inside a longer sentence. That distinction matters here specifically:
 * `synthesizeSentenceWav` receives arbitrary text — a full sentence, mixed
 * kanji and kana, or a bare single word — and a real sentence merely
 * CONTAINING one of these readings mid-sentence (e.g. 鉢を買いに行った) is a
 * different context than the word spoken bare and standalone (a Hear button
 * on just はち): it already carries the same kind of surrounding context that
 * resolves は/へ correctly for real words (see `WORD_READING_MISREADING`'s own
 * header comment on why context is the mechanical test), and has NOT been
 * verified to share the bare-word bug — so this must only fire on a full,
 * exact match of the whole string, never a partial one. */
function textForExactMisreadingFix(text: string): string {
  return readingForMisreadingFix(textForBareKanaFix(text));
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
  // Two independent EXACT-match fixes composed here (see
  // `textForExactMisreadingFix`'s own comment) — never a blanket
  // hiragana→katakana conversion. `text` here is arbitrary — a full
  // sentence, mixed kanji and kana, or a bare single word — and OpenJTalk's
  // hiragana-mode analysis is frequently RIGHT about things a blanket
  // katakana conversion would get wrong (こんにちは → コンニチワ is a real,
  // correct, lexicalized は→わ exception; forcing katakana input renders it
  // コンニチハ, verified live). Only the bare-glyph case (a Hear button on a
  // single は/へ) and the overridden readings matched WHOLE-STRING (a
  // Hear button on exactly one of them, standalone) are unambiguous enough to
  // fix blindly; everything else here is left for OpenJTalk's own judgment,
  // same as before.
  const query = await audioQuery(base, textForExactMisreadingFix(text), speakerId);
  const { totalPhrases, matchedPhrases } = correctSentencePitch(
    query.accent_phrases as AccentPhraseLike[],
    target,
  );

  const bytes = await synthesize(base, speakerId, query);
  return { bytes, totalPhrases, matchedPhrases };
}
