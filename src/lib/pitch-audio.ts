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

/** "No.7 アナウンス" — a neutral announcer voice (SAK-98's brief: VOICEVOX's
 * default, ずんだもん, is a childlike mascot voice, wrong tone for a lesson
 * app). Part of the cache key so a future voice change invalidates old clips
 * rather than serving them under the new voice's name. */
export const PITCH_SPEAKER_ID = 30;

function supabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return u && u.length ? u.replace(/\/$/, "") : undefined;
}

/** The Storage object path for a (reading, downstep) clip. `downstep` is part
 * of the key, not just `reading`, because the same reading can in principle be
 * asked for under a different accent (a caller bug, or Kanjium data changing
 * on a re-ingest) and the two must not collide. */
export function pitchObjectPath(reading: string, downstep: number): string {
  return `pitch/${PITCH_SPEAKER_ID}/${voiceKey(`${reading}:${downstep}`)}.wav`;
}

/** The public CDN URL for a clip, or null when pack-voice storage isn't
 * configured (pitch audio rides the same bucket, so the same gate applies). */
export function pitchAudioUrl(reading: string, downstep: number): string | null {
  const base = supabaseUrl();
  const bucket = voiceBucket();
  if (!base || !bucket) return null;
  return `${base}/storage/v1/object/public/${bucket}/${pitchObjectPath(reading, downstep)}`;
}

/** The app's on-demand route: generate-if-missing, cache, then serve. A
 * relative URL, so it resolves against the app origin in the browser. */
export function pitchApiUrl(reading: string, downstep: number): string {
  return `/api/pitch-tts?r=${encodeURIComponent(reading)}&d=${downstep}`;
}
