// GET /api/pitch-tts?r=<reading>&d=<downstep>&v=<voiceId> — on-demand EXACT
// pitch-accurate word audio (SAK-98, unified onto the one VOICEVOX engine by
// SAK-100). A thin wrapper around the same synthesis module /api/tts uses
// (src/lib/tts-synth.ts) — there is one VOICEVOX engine and one Storage
// bucket behind both routes now, not two independently-maintained pitch
// pipelines. This route exists separately from /api/tts because the caller
// (the Library word page) already knows the EXACT verified downstep for this
// reading and wants it applied with no fuzzy matching — see
// synthesizeWordWav's doc comment.
//
// Same two-tier shape as /api/tts: check the Storage bucket for an
// already-cached clip first (302 to the CDN URL on a hit); on a miss,
// synthesize, upload the clip into the SAME bucket /api/tts uses (under its
// own `pitch-` sub-namespace — see src/lib/voice.ts's pitchObjectPath), and
// return the bytes, so the next request for it is a cache hit.
//
// No auth: the audio is public and non-sensitive, same as /api/tts. Abuse is
// bounded by a short reading and a small non-negative downstep; anything else
// is a 400. Any failure (VOICEVOX unconfigured/unreachable, Storage error)
// answers non-2xx — the "Hear it" pitch button just stays silent on a failed
// play() rather than falling back to a different voice, because unlike the
// general Hear button there is no substitute that would still carry the exact
// pitch.

import { createClient } from "@supabase/supabase-js";

import { synthesizeWordWav, ttsConfigured } from "@/lib/tts-synth";
import {
  DEFAULT_VOICE_ID,
  pitchAudioUrl,
  pitchObjectPath,
  voice,
  voiceBucket,
} from "@/lib/voice";

/** Longest reading we'll synthesize — words, not sentences. */
const MAX_READING = 20;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const reading = (searchParams.get("r") ?? "").trim();
  const downstepRaw = searchParams.get("d") ?? "";
  const downstep = Number.parseInt(downstepRaw, 10);
  // `v` names a roster id (e.g. "nana"), never a raw VOICEVOX speaker number —
  // resolving it here, against the curated list in voice.ts, is what stops a
  // client from synthesizing with a speaker we never intended to expose.
  // Missing param ⇒ the shipped default, so old callers/URLs keep working.
  const voiceIdRaw = searchParams.get("v") ?? DEFAULT_VOICE_ID;
  const v = voice(voiceIdRaw);

  if (
    !reading ||
    reading.length > MAX_READING ||
    !/^\d+$/.test(downstepRaw) ||
    !Number.isFinite(downstep) ||
    downstep < 0 ||
    !v
  ) {
    return new Response("bad request", { status: 400 });
  }

  const bucket = voiceBucket();
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicUrl = pitchAudioUrl(reading, downstep, voiceIdRaw);
  if (!bucket || !supaUrl || !serviceKey || !publicUrl || !ttsConfigured()) {
    return new Response("pitch tts not configured", { status: 503 });
  }

  const path = pitchObjectPath(reading, downstep, voiceIdRaw);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const file = path.slice(path.lastIndexOf("/") + 1);
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Cache hit → hand the browser the CDN URL (cheaper than proxying bytes).
  const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: file });
  if (existing?.some((f) => f.name === file)) {
    return Response.redirect(publicUrl, 302);
  }

  // Miss → synthesize, try to cache, and return the bytes regardless. The
  // upload is a SEPARATE try: a caching failure should not stop the learner
  // hearing the word. It costs a re-synthesis on every play until fixed, but
  // that is a config fix for the bucket owner, not a reason to 502 here.
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesizeWordWav(reading, downstep, v.speakerId);
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
