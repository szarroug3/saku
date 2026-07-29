// GET /api/tts?v=<voiceId>&t=<text> — on-demand pack-voice audio.
//
// speech.ts tries the CDN clip first; this route is the SECOND tier, hit only
// when a clip isn't seeded yet (words and sentences). On a cache hit it 302s to
// the public CDN object; on a miss it synthesizes with Azure (the same code the
// seeder uses), caches the mp3 into the SAME bucket, and returns the bytes — so
// the next request for it is a CDN hit. Any failure answers non-2xx and speech.ts
// falls back to the browser voice.
//
// No auth: the audio is public and non-sensitive. Abuse is bounded by requiring
// a REGISTERED pack voice and a short text; anything else is a 400.

import { createClient } from "@supabase/supabase-js";

import { azureConfigured, synthesizeMp3 } from "@/lib/tts-synth";
import { packAudioUrl, packVoice, voiceBucket, voiceObjectPath } from "@/lib/voice-audio";

/** Longest text we will synthesize on demand — a bound on per-request Azure
 * cost. Kana are seeded; this is for words and short sentences. */
const MAX_TEXT = 120;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("v") ?? "";
  const text = (searchParams.get("t") ?? "").trim();

  const pack = packVoice(voiceId);
  if (!pack || !text || text.length > MAX_TEXT) {
    return new Response("bad request", { status: 400 });
  }

  const bucket = voiceBucket();
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicUrl = packAudioUrl(voiceId, text);
  if (!bucket || !supaUrl || !serviceKey || !publicUrl || !azureConfigured()) {
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

  // Miss → synthesize, cache, and return the bytes (populates the CDN for next time).
  try {
    const bytes = await synthesizeMp3(pack.source.voice, pack.source.rate, pack.source.pitch, text);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    return new Response(new Blob([bytes], { type: "audio/mpeg" }), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("synthesis failed", { status: 502 });
  }
}
