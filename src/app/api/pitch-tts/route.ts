// GET /api/pitch-tts?r=<reading>&d=<downstep> — on-demand pitch-accurate word
// audio (SAK-98), the VOICEVOX counterpart to /api/tts.
//
// Same two-tier shape as /api/tts: check the Storage bucket for an
// already-cached clip first (302 to the CDN URL on a hit); on a miss,
// synthesize with VOICEVOX (src/lib/pitch-tts-synth.ts — that's where the
// pitch contour is hand-set), upload the clip into the SAME bucket /api/tts
// uses (under its own `pitch/` prefix — see src/lib/pitch-audio.ts), and
// return the bytes, so the next request for it is a cache hit.
//
// No auth: the audio is public and non-sensitive, same as /api/tts. Abuse is
// bounded by a short reading and a small non-negative downstep; anything else
// is a 400. Any failure (VOICEVOX unconfigured/unreachable, Storage error)
// answers non-2xx — the "Hear it" pitch button just stays silent on a failed
// play() rather than falling back to a different voice, because unlike the
// pack-voice path there is no substitute that would still carry the pitch.

import { createClient } from "@supabase/supabase-js";

import { pitchTtsConfigured, synthesizePitchWav } from "@/lib/pitch-tts-synth";
import { pitchAudioUrl, pitchObjectPath } from "@/lib/pitch-audio";
import { voiceBucket } from "@/lib/voice-audio";

/** Longest reading we'll synthesize — words, not sentences. */
const MAX_READING = 20;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const reading = (searchParams.get("r") ?? "").trim();
  const downstepRaw = searchParams.get("d") ?? "";
  const downstep = Number.parseInt(downstepRaw, 10);

  if (
    !reading ||
    reading.length > MAX_READING ||
    !/^\d+$/.test(downstepRaw) ||
    !Number.isFinite(downstep) ||
    downstep < 0
  ) {
    return new Response("bad request", { status: 400 });
  }

  const bucket = voiceBucket();
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicUrl = pitchAudioUrl(reading, downstep);
  if (!bucket || !supaUrl || !serviceKey || !publicUrl || !pitchTtsConfigured()) {
    return new Response("pitch tts not configured", { status: 503 });
  }

  const path = pitchObjectPath(reading, downstep);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const file = path.slice(path.lastIndexOf("/") + 1);
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Cache hit → hand the browser the CDN URL (cheaper than proxying bytes).
  const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: file });
  if (existing?.some((f) => f.name === file)) {
    return Response.redirect(publicUrl, 302);
  }

  // Miss → synthesize, try to cache, and return the bytes regardless. The
  // upload is a SEPARATE try: a caching failure (e.g. the bucket's allowed
  // MIME types not yet including audio/wav — this bucket was created for the
  // mp3 pack voices, see .env.example) should not stop the learner hearing the
  // word. It costs a re-synthesis on every play until the bucket is updated,
  // but that is a config fix for the bucket owner, not a reason to 502 here.
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesizePitchWav(reading, downstep);
  } catch {
    return new Response("synthesis failed", { status: 502 });
  }
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: "audio/wav", upsert: true });
    if (error) throw error;
  } catch (err) {
    console.error("pitch-tts: cache upload failed, serving uncached", err);
  }
  return new Response(new Blob([bytes], { type: "audio/wav" }), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
