// GET /api/tts?v=<voiceId>&t=<text> — on-demand voice audio, general speech
// (SAK-100). Backs every ordinary Hear button, quiz prompt and listening
// exercise in the app — the SAME contract this route has always had
// (?v=&t=), so lib/speech.ts's callers needed no changes; only what
// synthesizes behind it changed, from Azure to VOICEVOX with sentence-level
// pitch correction (src/lib/tts-synth.ts, src/lib/sentence-pitch.ts).
//
// Same two-tier shape as before: check the Storage bucket first (302 to the
// CDN URL on a hit); on a miss, synthesize, cache the wav into the bucket, and
// return the bytes, so the next request for it is a cache hit. Any failure
// answers non-2xx and speech.ts falls back to the browser voice.
//
// No auth: the audio is public and non-sensitive. Abuse is bounded by
// requiring a REGISTERED roster voice and a short text; anything else is 400.

import { createClient } from "@supabase/supabase-js";

import { synthesizeSentenceWav, ttsConfigured } from "@/lib/tts-synth";
import { voice, voiceAudioUrl, voiceBucket, voiceObjectPath } from "@/lib/voice";

/** Longest text we will synthesize on demand — a bound on per-request engine
 * cost. Kana are effectively instant to (re)synthesize; this guards a long
 * pasted sentence, not ordinary content. */
const MAX_TEXT = 200;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("v") ?? "";
  const text = (searchParams.get("t") ?? "").trim();

  const v = voice(voiceId);
  if (!v || !text || text.length > MAX_TEXT) {
    return new Response("bad request", { status: 400 });
  }

  const bucket = voiceBucket();
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicUrl = voiceAudioUrl(voiceId, text);
  if (!bucket || !supaUrl || !serviceKey || !publicUrl || !ttsConfigured()) {
    return new Response("tts not configured", { status: 503 });
  }

  const path = voiceObjectPath(voiceId, text);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const file = path.slice(path.lastIndexOf("/") + 1);
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Cache hit → hand the browser the CDN URL (cheaper than proxying bytes).
  const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: file });
  if (existing?.some((f) => f.name === file)) {
    return Response.redirect(publicUrl, 302);
  }

  // Miss → synthesize, cache, and return the bytes (populates the CDN for next
  // time). The pitch-match coverage is logged, not surfaced to the client —
  // useful during development/verification without adding response shape the
  // browser has to ignore.
  try {
    const { bytes, totalPhrases, matchedPhrases } = await synthesizeSentenceWav(text, v.speakerId);
    if (totalPhrases > 0) {
      console.info(
        `tts: pitch-matched ${matchedPhrases}/${totalPhrases} accent phrase(s) for "${text}"`,
      );
    }
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: "audio/wav", upsert: true });
    if (error) throw error;
    return new Response(new Blob([bytes], { type: "audio/wav" }), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("synthesis failed", { status: 502 });
  }
}
