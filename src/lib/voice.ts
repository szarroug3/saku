// THE voice roster + Storage helpers (SAK-100) — one module, replacing the two
// parallel systems this app used to carry: voice-audio.ts's Azure "pack
// voices" (Keita/Nanami, used for all general speech) and pitch-audio.ts's
// VOICEVOX roster (used only for the word-page pitch button, SAK-98/99).
//
// WHY THEY MERGED
// ================
// Azure's neural voices sound natural but speak with THEIR OWN accent, not a
// word's real pitch — VOICEVOX (self-hosted,
// github.com/VOICEVOX/voicevox_engine) is the one engine that exposes a
// per-mora pitch value a caller can hand-edit before synthesis. Once every
// utterance in the app gets sentence-level pitch correction (see
// src/lib/sentence-pitch.ts + src/lib/tts-synth.ts), there is no reason left
// to keep a second, pitch-blind engine around for "ordinary" speech — Azure
// and the whole pack-voice system are gone. One roster, one Settings picker,
// one Storage layout.
//
// STORAGE LAYOUT. All clips — a quiz sentence, a lesson word, a pitch-button
// word — live in the SAME public Supabase Storage bucket, at
// `voices/<voiceId>/<key>.opus`, where `key` is a stable hash of the spoken
// text (voiceKey). Kana were previously pre-seeded under the OLD Azure voice
// ids' paths (voices/keita/…, voices/nanami/…); those are simply orphaned now
// — the app synthesizes and caches fresh clips under the new voice ids on
// first use, same miss-then-cache flow as before. No migration needed.
//
// `.opus` NOT `.wav` — the app's audio used to be raw WAV until the bulk
// pre-seed (kana/yomi/words/sentences/word-examples × every voice) turned out
// to project to ~11GB, well past Supabase's free-tier storage. 24kbps Opus
// cuts that to well under 1GB with no audible loss for speech at this
// bitrate. Every clip in the bucket is Opus now, live-synthesized or
// pre-seeded alike — see src/lib/audio-compress.ts for the shared encode
// step. The ~4,800 WAV clips a first pre-seed run had already written before
// this change were deleted rather than left orphaned: at this budget, ~200MB
// of dead weight actually matters.
//
// No secrets here — NEXT_PUBLIC_SUPABASE_URL and the bucket name are already
// public (readable in the browser).

/** One VOICEVOX voice in the app's curated roster. Sam listened to VOICEVOX's
 * full speaker catalog and picked these six; the display labels are hers
 * verbatim — do not reword them. */
export interface Voice {
  /** Persisted preference key (`cfg.voiceName`), Storage folder, and
   * query-param value — one id, three uses, so a saved config round-trips
   * without translation. */
  readonly id: string;
  /** Settings label — Sam's exact wording, never "No.7". */
  readonly label: string;
  /** The VOICEVOX engine's numeric speaker id. */
  readonly speakerId: number;
}

export const VOICES: readonly Voice[] = [
  { id: "aoyama", label: "Aoyama", speakerId: 13 },
  { id: "namine", label: "Namine", speakerId: 9 },
  { id: "kenzaki", label: "Kenzaki", speakerId: 21 },
  { id: "metan", label: "Metan", speakerId: 2 },
  { id: "kurenai", label: "Kurenai", speakerId: 51 },
  // VOICEVOX ships this one as "No.7 アナウンス"; Sam renamed it "Nana" (the
  // natural Japanese reading of the digit 7) because "No.7" reads awkwardly in
  // a picker. Never show "No.7" in the UI.
  { id: "nana", label: "Nana", speakerId: 30 },
];

/** Sam's chosen default for every learner who hasn't picked a voice yet — a
 * legacy Azure `voiceName` ("keita"/"nanami"), a retired `pitchVoiceId`, or
 * the no-longer-offered "Auto" ("") all migrate here in quiz-config.tsx's
 * normalizeConfig. */
export const DEFAULT_VOICE_ID = "aoyama";

/** The word played to preview a voice on selection in Settings — 先生
 * (せんせい), a real Kanjium pitch entry (downstep 3, see
 * src/data/generated/pitch.json) that reads naturally on its own and
 * demonstrates the pitch correction the voice will carry everywhere. */
export const VOICE_PREVIEW = { reading: "せんせい", downstep: 3 } as const;

export function voice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

export function isVoiceId(id: string): boolean {
  return VOICES.some((v) => v.id === id);
}

/**
 * A stable, filesystem- and URL-safe key for a spoken string: FNV-1a 64-bit
 * over its UTF-8 bytes, 16 lowercase hex. Synchronous and identical in Node
 * (server routes) and the browser, so both address the same Storage object.
 * Not security-sensitive — a non-crypto hash is fine, and 64 bits leaves the
 * corpus with negligible collision risk. Long sentences hash to the same 16
 * chars, sidestepping the 255-byte filename limit that raw text hits.
 */
export function voiceKey(text: string): string {
  const bytes = new TextEncoder().encode(text.trim());
  // Two INDEPENDENT 32-bit hashes (FNV-1a and djb2) concatenated to 16 hex — a
  // 64-bit key without BigInt, so the project's pre-ES2020 tsc target and older
  // runtimes accept it. `Math.imul` does the exact 32-bit multiply. Using two
  // different hash families makes a combined collision require BOTH to collide
  // at once, which is negligible over the vocabulary + sentence corpus.
  let fnv = 0x811c9dc5 | 0;
  let djb = 5381 | 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    fnv = Math.imul(fnv ^ b, 0x01000193);
    djb = (Math.imul(djb, 33) + b) | 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(fnv) + hex(djb);
}

/** The Storage object path for a clip of arbitrary text (a word or a full
 * sentence) under a given voice — shared by the runtime cache and playback.
 *
 * `.opus` (Ogg Opus), not `.wav`: at 24kbps this is ~16x smaller than the raw
 * WAV VOICEVOX returns with no audible loss for speech at this bitrate (the
 * same ballpark as Discord/WhatsApp voice), and the difference between "fits
 * the Supabase free tier" and "doesn't" for a corpus this size — see
 * src/lib/audio-compress.ts for the encode step both the live routes and the
 * bulk seed script share. */
export function voiceObjectPath(voiceId: string, text: string): string {
  return `voices/${voiceId}/${voiceKey(text)}.opus`;
}

/** The Storage object path for a word's EXACT pitch-accent clip — a
 * (reading, downstep) pair rather than free text, kept in its own
 * sub-namespace so it never collides with a general-speech clip that happens
 * to hash the same text under fuzzy sentence-level correction (see
 * src/lib/sentence-pitch.ts). `downstep` is part of the key: a caller asking
 * for the same reading under a different accent (a bug, or the Kanjium data
 * changing on a re-ingest) must not collide with an existing clip. */
export function pitchObjectPath(reading: string, downstep: number, voiceId: string): string {
  return `voices/${voiceId}/pitch-${voiceKey(`${reading}:${downstep}`)}.opus`;
}

/** The Storage object path for a word's DELIBERATELY WRONG pitch clip (SAK-
 * 128's "correct vs synthetically wrong" quiz mechanic — see
 * src/lib/tts-synth.ts's synthesizeWrongPitchWordWav and
 * src/lib/pitch-quiz.ts). Keyed on the same (reading, CORRECT downstep,
 * voice) as the real clip's own pitchObjectPath, but in its own
 * `pitchwrong-` sub-namespace, so it can never collide with — or be served
 * in place of — the correct clip. The actual wrong pattern synthesized is a
 * deterministic function of the correct downstep and the reading's mora
 * count (see tts-synth.ts's wrongDownstepFor), so this key is stable without
 * having to name the wrong pattern itself. */
export function pitchWrongObjectPath(
  reading: string,
  downstep: number,
  voiceId: string,
): string {
  return `voices/${voiceId}/pitchwrong-${voiceKey(`${reading}:${downstep}`)}.opus`;
}

function supabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** The configured public bucket name, if any. Empty ⇒ the roster is unusable
 * and every button falls back to the browser voice. */
export function voiceBucket(): string | undefined {
  const b = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  return b && b.length ? b : undefined;
}

/** Whether the roster is usable at all (URL + bucket both set). When false,
 * Settings hides the roster and speech.ts stays on the browser voice. */
export function voicesEnabled(): boolean {
  return !!supabaseUrl() && !!voiceBucket();
}

/**
 * The public CDN URL for a clip, or null when the bucket isn't configured.
 * Public-bucket objects are served at
 * `<project>/storage/v1/object/public/<bucket>/<path>` — no key, cacheable by
 * the CDN. speech.ts plays this and falls back to the browser voice on error.
 */
export function voiceAudioUrl(voiceId: string, text: string): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${voiceObjectPath(voiceId, text)}`;
}

/** The public CDN URL for a word's exact pitch clip. See `pitchObjectPath`. */
export function pitchAudioUrl(reading: string, downstep: number, voiceId: string): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${pitchObjectPath(reading, downstep, voiceId)}`;
}

/** The public CDN URL for a word's deliberately-wrong pitch clip. See
 * `pitchWrongObjectPath`. */
export function pitchWrongAudioUrl(
  reading: string,
  downstep: number,
  voiceId: string,
): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${pitchWrongObjectPath(reading, downstep, voiceId)}`;
}

/** The app's own on-demand route: generate-if-missing, cache, then serve. Used
 * by speech.ts as the second tier when the CDN clip isn't there yet. A
 * relative URL, so it resolves against the app origin in the browser. Same
 * query-param contract the old pack-voice /api/tts used — only what backs it
 * changed. */
export function voiceApiUrl(voiceId: string, text: string): string {
  return `/api/tts?v=${encodeURIComponent(voiceId)}&t=${encodeURIComponent(text)}`;
}

/** The app's on-demand route for a word's EXACT pitch clip (known reading +
 * downstep, not fuzzy-matched). `voiceId` defaults to the roster default so
 * callers that haven't been threaded through Settings yet still work. */
export function pitchApiUrl(
  reading: string,
  downstep: number,
  voiceId: string = DEFAULT_VOICE_ID,
): string {
  return `/api/pitch-tts?r=${encodeURIComponent(reading)}&d=${downstep}&v=${encodeURIComponent(voiceId)}`;
}

/** The app's on-demand route for a word's DELIBERATELY WRONG pitch clip
 * (SAK-128) — same route as `pitchApiUrl`, with `w=1` telling it to
 * synthesize (and cache, under pitchWrongObjectPath) the wrong pattern
 * instead of the real one. `downstep` here is still the word's CORRECT
 * downstep — the route derives the wrong pattern from it, deterministically
 * (see tts-synth.ts's wrongDownstepFor), so the caller never has to know or
 * name the wrong pattern itself. */
export function pitchWrongApiUrl(
  reading: string,
  downstep: number,
  voiceId: string = DEFAULT_VOICE_ID,
): string {
  return `/api/pitch-tts?r=${encodeURIComponent(reading)}&d=${downstep}&v=${encodeURIComponent(voiceId)}&w=1`;
}
