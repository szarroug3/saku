// Client-safe URL/path helpers for pitch-accurate word audio (SAK-98) — the
// VOICEVOX counterpart to voice-audio.ts's pack-voice helpers, kept separate
// because this is a SECOND, independent audio source: a pack voice (Keita,
// Nanami) sounds natural but does not carry a word's real pitch-accent
// contour (see data/phase-intros.ts's "intro-pitch" card, which tells a
// learner to trust the LINE over the sound for exactly that reason). This
// clip exists to give the line a matching sound.
//
// Same SHAPE as voice-audio.ts on purpose — a Storage object path, a public
// CDN URL for a cache hit, and the app's own on-demand route for a miss — so
// the "Hear it" pitch button and /api/pitch-tts agree on where a clip lives
// without a shared manifest. Lives in the SAME Supabase Storage bucket as pack
// voices, under its own `pitch/` prefix, rather than a second bucket: one
// bucket to configure, and the prefix alone keeps the two kinds of clip apart.
//
// No secrets here — NEXT_PUBLIC_SUPABASE_URL and the bucket name are already
// public (readable in the browser), same as voice-audio.ts.

import { voiceBucket, voiceKey } from "@/lib/voice-audio";

/**
 * The curated roster of VOICEVOX voices offered for pitch-accent "Hear it"
 * audio (SAK-99). Sam listened to VOICEVOX's full speaker catalog and picked
 * these six; the display labels are hers verbatim — do not reword them.
 *
 * `id` is the stable, lowercase, URL-safe preference/storage key (what gets
 * persisted as `cfg.pitchVoiceId` and passed on the wire), kept separate from
 * the raw numeric VOICEVOX `speakerId` the same way voice-audio.ts's
 * `PackVoice.id` ("keita") is kept separate from `.source.voice`
 * ("ja-JP-KeitaNeural") — a stored id should never break if a speaker's
 * numeric id ever changed upstream.
 *
 * ONE source of truth: the API route and the Settings picker both import this
 * list rather than each keeping their own copy.
 */
export interface PitchVoice {
  /** Persisted preference key + query-param value. */
  readonly id: string;
  /** Settings label — Sam's exact wording, never "No.7". */
  readonly label: string;
  /** The VOICEVOX engine's numeric speaker id. */
  readonly speakerId: number;
}

export const PITCH_VOICES: readonly PitchVoice[] = [
  { id: "aoyama", label: "Aoyama", speakerId: 13 },
  { id: "namine", label: "Namine", speakerId: 9 },
  { id: "kenzaki", label: "Kenzaki", speakerId: 21 },
  { id: "metan", label: "Metan", speakerId: 2 },
  { id: "kurenai", label: "Kurenai", speakerId: 51 },
  // VOICEVOX ships this one as "No.7 アナウンス"; Sam renamed it "Nana" (the
  // natural Japanese reading of the digit 7) because "No.7" reads awkwardly
  // in a picker, and "Nana" matches the single-given-name style Keita/Nanami
  // already use elsewhere in this app. Never show "No.7" in the UI.
  { id: "nana", label: "Nana", speakerId: 30 },
];

/** Speaker id 30 ("Nana") was the sole hardcoded voice under SAK-98, and its
 * cache path (`pitch/30/...`) already has real clips in Storage. Keeping it
 * the default means a learner who used the feature before this ticket sees no
 * change in behaviour, and no cache is orphaned, until they pick differently
 * in Settings. */
export const DEFAULT_PITCH_VOICE_ID = "nana";

/** The preview word played when a learner picks a pitch voice in Settings —
 * 先生 (せんせい), a real Kanjium pitch entry (downstep 3, see
 * src/data/generated/pitch.json) that reads naturally on its own. One
 * constant, reused everywhere a preview is needed rather than re-picked. */
export const PITCH_VOICE_PREVIEW = { reading: "せんせい", downstep: 3 } as const;

export function pitchVoice(id: string): PitchVoice | undefined {
  return PITCH_VOICES.find((v) => v.id === id);
}

export function isPitchVoiceId(id: string): boolean {
  return PITCH_VOICES.some((v) => v.id === id);
}

function supabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** The Storage object path for a (reading, downstep) clip under a given
 * VOICEVOX speaker id. `downstep` is part of the key, not just `reading`,
 * because the same reading can in principle be asked for under a different
 * accent (a caller bug, or Kanjium data changing on a re-ingest) and the two
 * must not collide. `speakerId` is ALSO part of the path (an existing SAK-98
 * design choice, kept as-is) so different voices land in separate cache
 * entries with no other cache-key changes needed. */
export function pitchObjectPath(reading: string, downstep: number, speakerId: number): string {
  return `pitch/${speakerId}/${voiceKey(`${reading}:${downstep}`)}.wav`;
}

/** The public CDN URL for a clip, or null when pack-voice storage isn't
 * configured (pitch audio rides the same bucket, so the same gate applies). */
export function pitchAudioUrl(
  reading: string,
  downstep: number,
  speakerId: number,
): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${pitchObjectPath(reading, downstep, speakerId)}`;
}

/** The app's on-demand route: generate-if-missing, cache, then serve. A
 * relative URL, so it resolves against the app origin in the browser.
 * `voiceId` is the roster's string id (never a raw VOICEVOX speaker number —
 * the route is the one place that resolves and validates it), defaulting to
 * the shipped voice when a caller doesn't have one yet. */
export function pitchApiUrl(
  reading: string,
  downstep: number,
  voiceId: string = DEFAULT_PITCH_VOICE_ID,
): string {
  return `/api/pitch-tts?r=${encodeURIComponent(reading)}&d=${downstep}&v=${encodeURIComponent(voiceId)}`;
}
