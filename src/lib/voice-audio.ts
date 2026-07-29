// PACK VOICES — pre-generated, human-sounding TTS clips served from Supabase
// Storage, an alternative to the browser's built-in Japanese voice.
//
// WHY THIS EXISTS
// ===============
// The Web Speech API voice a learner gets depends entirely on their device, and
// on many machines it is absent or a novelty voice (the "Eddy" problem
// speech.ts fights). A "pack voice" sidesteps that: the audio is generated once
// with a good neural voice (edge-tts / Azure), uploaded to a public Supabase
// Storage bucket, and played back by URL — so every learner hears the same
// soothing voice regardless of what their browser ships.
//
// STORAGE IS THE ONE HOME. There are no audio files in the repo. Kana are SEEDED
// into the bucket up front (scripts/seed-voice.mjs); words and sentences are
// generated on demand and cached into the SAME bucket (the /api/tts route, a
// follow-up). speech.ts always resolves a pack voice to a bucket URL and falls
// back to the browser voice when a clip is missing or the network is down.
//
// The clip PATH is `voices/<voiceId>/<key>.mp3`, where `key` is a stable hash of
// the spoken text (voiceKey), so the seeder, the runtime cache, and speech.ts
// all address the same object without a shared manifest.

/** A pre-generated voice pack the learner can pick in Settings. `id` doubles as
 * the Storage folder and the stored `voiceName`, so a saved config round-trips
 * without translation. */
export interface PackVoice {
  /** Storage folder + persisted voiceName. */
  readonly id: string;
  /** Settings label. */
  readonly label: string;
  /** The edge-tts / Azure voice + prosody the seeder generates it with. Kept
   * here so the seeder and the UI describe the same thing. */
  readonly source: { voice: string; rate: string; pitch: string };
}

/** The packs on offer. One today: Keita, slowed and lowered for a calm,
 * documentary feel (the settings a listening test landed on). */
export const PACK_VOICES: readonly PackVoice[] = [
  {
    id: "keita",
    label: "Keita",
    source: { voice: "ja-JP-KeitaNeural", rate: "-10%", pitch: "-12Hz" },
  },
  {
    id: "nanami",
    label: "Nanami",
    source: { voice: "ja-JP-NanamiNeural", rate: "+0%", pitch: "-8Hz" },
  },
];

/** The phrase the Settings voice picker previews on selection. Seeded for every
 * pack voice (the seeder always includes it), so picking a pack voice plays that
 * voice rather than the browser fallback a missing clip would trigger. */
export const VOICE_PREVIEW = "こんにちは";

export function packVoice(id: string): PackVoice | undefined {
  return PACK_VOICES.find((v) => v.id === id);
}

export function isPackVoice(name: string): boolean {
  return PACK_VOICES.some((v) => v.id === name);
}

/**
 * A stable, filesystem- and URL-safe key for a spoken string: FNV-1a 64-bit over
 * its UTF-8 bytes, 16 lowercase hex. Synchronous and identical in Node (seeder)
 * and the browser (speech.ts), so both address the same Storage object. Not
 * security-sensitive — a non-crypto hash is fine, and 64 bits leaves the
 * ~12.5k-word corpus with negligible collision risk. Long sentences hash to the
 * same 16 chars, sidestepping the 255-byte filename limit that raw text hits.
 */
export function voiceKey(text: string): string {
  const bytes = new TextEncoder().encode(text.trim());
  // Two INDEPENDENT 32-bit hashes (FNV-1a and djb2) concatenated to 16 hex — a
  // 64-bit key without BigInt, so the project's pre-ES2020 tsc target and older
  // runtimes accept it. `Math.imul` does the exact 32-bit multiply. Using two
  // different hash families makes a combined collision require BOTH to collide
  // at once, which is negligible over the ~12.5k-word corpus.
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

/** The Storage object path for a clip, shared by seeder, cache and playback. */
export function voiceObjectPath(voiceId: string, text: string): string {
  return `voices/${voiceId}/${voiceKey(text)}.mp3`;
}

/** The Supabase project URL, if configured. Public (NEXT_PUBLIC_*), so it is
 * readable in the browser. */
function supabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** The configured public bucket name, if any. Empty ⇒ pack voices disabled. */
export function voiceBucket(): string | undefined {
  const b = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  return b && b.length ? b : undefined;
}

/** Whether pack voices are usable at all (URL + bucket both set). When false,
 * Settings hides them and speech.ts stays on the browser voice. */
export function packVoicesEnabled(): boolean {
  return !!supabaseUrl() && !!voiceBucket();
}

/**
 * The public CDN URL for a clip, or null when pack voices are not configured.
 * Public-bucket objects are served at
 * `<project>/storage/v1/object/public/<bucket>/<path>` — no key, cacheable by
 * the CDN. speech.ts plays this and falls back to the browser voice on error.
 */
export function packAudioUrl(voiceId: string, text: string): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${voiceObjectPath(voiceId, text)}`;
}
