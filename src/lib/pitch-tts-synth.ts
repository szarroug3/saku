// VOICEVOX-backed synthesis of pitch-accurate word audio (SAK-98) — a SECOND
// TTS engine alongside Azure (tts-synth.ts), used only by /api/pitch-tts.
//
// WHY A SECOND ENGINE
// ====================
// Azure's neural voices sound natural but speak with their OWN accent, not the
// word's real one (see data/phase-intros.ts's "intro-pitch" card). VOICEVOX
// (self-hosted, github.com/VOICEVOX/voicevox_engine) exposes the one thing
// Azure doesn't: a per-mora pitch value a caller can hand-edit before
// synthesis. POST /audio_query gets the engine's own reading + pitch guess for
// some text; edit `accent_phrases[].moras[].pitch`; POST the edited JSON to
// /synthesis and get WAV bytes back with exactly that contour.
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
// this from client code (see /api/pitch-tts/route.ts, the one caller).

import { pitchPattern } from "@/lib/pitch";

/** "No.7 アナウンス" — kept in sync with pitch-audio.ts's cache-key constant. */
export const PITCH_SPEAKER_ID = 30;

// A short, common phrase, guaranteed to carry several voiced moras across a
// real pitch swing, used only to measure the voice's natural pitch range.
const FILLER_TEXT = "おはようございます";

// How far in from each end of the measured natural range a High/Low target
// sits. 0 would use the extremes themselves (the scratchy-audio failure mode
// SAK-6 hit); this is the margin that spike's listening tests landed on.
const RANGE_MARGIN_FRACTION = 0.15;

function engineUrl(): string | undefined {
  const u = process.env.VOICEVOX_ENGINE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** Whether VOICEVOX is configured at all. When false, the route answers a
 * clean 503, the same shape /api/tts uses when Azure is unconfigured. */
export function pitchTtsConfigured(): boolean {
  return !!engineUrl();
}

interface VoicevoxMora {
  pitch: number;
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

async function audioQuery(base: string, text: string): Promise<VoicevoxAudioQuery> {
  const url = `${base}/audio_query?speaker=${PITCH_SPEAKER_ID}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`VOICEVOX audio_query ${res.status} ${res.statusText}`);
  return (await res.json()) as VoicevoxAudioQuery;
}

/** Every mora across a query's accent phrases, in reading order — the same
 * flat sequence `pitchPattern(reading, downstep)` produces for a reading, so
 * the two can be walked side by side by index. */
function flatMoras(query: VoicevoxAudioQuery): VoicevoxMora[] {
  return query.accent_phrases.flatMap((p) => p.moras);
}

// The voice's own natural pitch range, measured once per server instance (a
// running server's VOICEVOX voice does not change between requests) and
// reused for every synthesis after the first.
let cachedRange: { min: number; max: number } | null = null;

async function naturalRange(base: string): Promise<{ min: number; max: number }> {
  if (cachedRange) return cachedRange;
  const query = await audioQuery(base, FILLER_TEXT);
  const pitches = flatMoras(query)
    .map((m) => m.pitch)
    .filter((p) => p > 0); // 0 marks a silent/devoiced mora, not a real pitch
  if (pitches.length === 0) throw new Error("VOICEVOX filler query returned no voiced moras");
  const range = { min: Math.min(...pitches), max: Math.max(...pitches) };
  cachedRange = range;
  return range;
}

/**
 * Synthesize `reading` (kana) at its own pitch-accent pattern (`downstep`, the
 * mora position of the drop — see src/lib/pitch.ts) to WAV bytes.
 *
 * Throws on any failure (unconfigured engine, unreachable, bad response) so
 * the route can turn that into a clean 503/502 rather than an unhandled
 * error — never let a raw exception escape to the caller.
 */
export async function synthesizePitchWav(reading: string, downstep: number): Promise<ArrayBuffer> {
  const base = engineUrl();
  if (!base) throw new Error("VOICEVOX not configured (VOICEVOX_ENGINE_URL).");

  const { min, max } = await naturalRange(base);
  const margin = (max - min) * RANGE_MARGIN_FRACTION;
  const lowTarget = min + margin;
  const highTarget = max - margin;

  const query = await audioQuery(base, reading);
  const moras = flatMoras(query);
  const pattern = pitchPattern(reading, downstep);
  const n = Math.min(moras.length, pattern.length);
  for (let i = 0; i < n; i++) {
    // Leave an already-silent/devoiced mora alone — editing those is exactly
    // what produced scratchy audio in the research spike.
    if (moras[i].pitch <= 0) continue;
    moras[i].pitch = pattern[i].high ? highTarget : lowTarget;
  }

  const res = await fetch(`${base}/synthesis?speaker=${PITCH_SPEAKER_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`VOICEVOX synthesis ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}
