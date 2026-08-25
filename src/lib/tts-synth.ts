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
  const query = await audioQuery(base, reading, speakerId);
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
  // Only the general (non-exact-pitch) path takes this fix — synthesizeWordWav
  // always gets a caller-supplied dictionary READING (never a bare kana glyph
  // spoken for its own sake), so it has no version of this ambiguity to guard.
  const query = await audioQuery(base, textForBareKanaFix(text), speakerId);
  const { totalPhrases, matchedPhrases } = correctSentencePitch(
    query.accent_phrases as AccentPhraseLike[],
    target,
  );

  const bytes = await synthesize(base, speakerId, query);
  return { bytes, totalPhrases, matchedPhrases };
}
