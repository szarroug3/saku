// Azure Speech REST synthesis — the ONE generator, used by both the seeder
// (scripts/seed-voice.mjs) and the on-demand route (/api/tts). Using the same
// code + endpoint + SSML for both means a pre-seeded clip and one generated on
// demand are identical; there is no second engine to drift.
//
// Server-only (reads AZURE_SPEECH_KEY / AZURE_SPEECH_REGION, does a network
// POST). NEVER import this from client code — speech.ts talks to /api/tts, not
// to this. The free tier (F0) is 500k characters/month of neural TTS, and the
// voice names are the same Azure neural voices the pack registry lists.

import { ttsSsml } from "@/lib/voice-audio";

/** Whether Azure credentials are present. When false, /api/tts answers 503 and
 * the client stays on the CDN clip / browser voice. */
export function azureConfigured(): boolean {
  return !!process.env.AZURE_SPEECH_KEY && !!process.env.AZURE_SPEECH_REGION;
}

/**
 * Synthesize `text` in `voice` with the given prosody to MP3 bytes. Throws if
 * Azure is unconfigured or the request fails, so callers can fall back (the
 * route to 502, the seeder to a logged skip).
 *
 * Output format matches what the seeder and the browser expect: 24 kHz mono MP3.
 * Returns a plain ArrayBuffer — a valid Blob part and Supabase upload body.
 */
export async function synthesizeMp3(
  voice: string,
  rate: string,
  pitch: string,
  text: string,
): Promise<ArrayBuffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error("Azure Speech not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).");
  }
  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "saku",
      },
      body: ttsSsml(voice, rate, pitch, text),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Azure TTS ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return res.arrayBuffer();
}
