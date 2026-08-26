// GET /api/pitch-tts?r=<reading>&d=<downstep>&v=<voiceId> — on-demand EXACT
// pitch-accurate word audio (SAK-98, unified onto the one VOICEVOX engine by
// SAK-100). A thin wrapper around the same synthesis module /api/tts uses
// (src/lib/tts-synth.ts) — there is one VOICEVOX engine and one Storage
// bucket behind both routes now, not two independently-maintained pitch
// pipelines. This route exists separately from /api/tts because the caller
// (the Library word page, or the pitch quiz — src/lib/pitch-quiz.ts) already
// knows the EXACT downstep it wants applied, real or a deliberately
// different quiz distractor, with no fuzzy matching — see synthesizeWordWav's
// doc comment. Pitch audio is a pure function of (reading, downstep, voice)
// with no notion of "correct" baked into the bytes, so a quiz distractor is
// just this same route asked for a different `d` (see src/lib/pitch.ts's
// wrongDownstepFor, and voice.ts's pitchObjectPath) — never a separate
// synthesis path or cache namespace.
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
//
// COMPRESSED, WITH A FALLBACK /api/tts DOESN'T NEED: this route's whole
// reason to exist is "the learner hears the exact pitch, or nothing" (see
// above) — so if the WAV→Opus encode step itself fails (audio-compress.ts;
// most likely `ffmpeg` missing wherever this is deployed), that must NOT cost
// the learner the clip the way a hard failure would. Encoding gets its own
// try, separate from synthesis: on an encode failure this falls back to
// serving the raw WAV uncached rather than 502ing, the same "a caching
// problem must not silence the button" reasoning the upload step below
// already applies.

import { createClient } from "@supabase/supabase-js";

import { AUDIO_CONTENT_TYPE, encodeOpus } from "@/lib/audio-compress";
import { synthesizeWordWav, ttsConfigured } from "@/lib/tts-synth";
import { DEFAULT_VOICE_ID, pitchAudioUrl, pitchObjectPath, voice, voiceBucket } from "@/lib/voice";

/** Longest reading we'll synthesize — words, not sentences. */
const MAX_READING = 20;

/**
 * In-flight synthesis de-duplication, keyed by Storage object path (SAK-132).
 * VOICEVOX synthesis is genuinely slow (multiple seconds), and SAK-133 made
 * it normal for a learner to tap the SAME clip repeatedly (play it again to
 * compare) before it has finished its first upload. Without this, N
 * concurrent requests for a clip that isn't cached YET each independently
 * see a cache miss and each kick off their own multi-second synthesis+upload
 * — observed in practice as four back-to-back 3-9s synthesis calls for the
 * literal same (reading, downstep, voice) query, which was enough to
 * starve the browser's connection pool and stall ordinary page navigation
 * behind them. Concurrent requests for the same path now await the SAME
 * in-flight synthesis instead of starting their own; the entry is removed
 * once settled (success or failure) so a transient failure doesn't cache a
 * permanent one, and so this never grows unbounded across distinct clips. */
const inFlightSynthesis = new Map<string, Promise<Response>>();

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
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Cache hit → hand the browser the CDN URL (cheaper than proxying bytes).
  // A HEAD on the already-computed public URL hits the CDN edge directly, no
  // Postgres round trip (SAK-196 — the old supabase.storage.list(search:)
  // check ran storage.search(), which became 38% of all DB query time as the
  // bucket grew). Unlike that Supabase SDK call, a plain fetch() can THROW
  // (DNS hiccup, CDN blip) rather than just resolve non-2xx — caught here and
  // treated exactly like a miss, since a miss is always a safe fallback (it
  // only costs a synthesis instead of a redirect); nothing here may turn a
  // transient network failure into a 500.
  let cached = false;
  try {
    cached = (await fetch(publicUrl, { method: "HEAD" })).ok;
  } catch {
    // Fall through to synthesize, same as a non-2xx HEAD.
  }
  if (cached) {
    return Response.redirect(publicUrl, 302);
  }

  // Miss → synthesize, try to cache, and return the bytes regardless — but
  // only ONE synthesis in flight per path at a time (see inFlightSynthesis's
  // doc comment). A concurrent request for the same not-yet-cached clip
  // clones this one's eventual response instead of starting its own.
  const already = inFlightSynthesis.get(path);
  if (already) return (await already).clone();

  const run = (async (): Promise<Response> => {
    // The upload is a SEPARATE try: a caching failure should not stop the
    // learner hearing the word. It costs a re-synthesis on every play until
    // fixed, but that is a config fix for the bucket owner, not a reason to
    // 502 here.
    let bytes: ArrayBuffer;
    try {
      bytes = await synthesizeWordWav(reading, downstep, v.speakerId);
    } catch (err) {
      console.error(`pitch-tts: synthesis failed for "${reading}" (downstep ${downstep})`, err);
      return new Response("synthesis failed", { status: 502 });
    }

    let opusBytes: Buffer | null = null;
    try {
      opusBytes = await encodeOpus(bytes);
    } catch (err) {
      console.error("pitch-tts: opus encode failed, serving uncompressed WAV uncached", err);
    }

    if (opusBytes === null) {
      return new Response(new Blob([bytes], { type: "audio/wav" }), {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, opusBytes, { contentType: AUDIO_CONTENT_TYPE, upsert: true });
      if (error) throw error;
    } catch (err) {
      console.error("pitch-tts: cache upload failed, serving uncached", err);
    }
    return new Response(new Blob([new Uint8Array(opusBytes)], { type: AUDIO_CONTENT_TYPE }), {
      headers: {
        "Content-Type": AUDIO_CONTENT_TYPE,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  })();
  inFlightSynthesis.set(path, run);
  try {
    return (await run).clone();
  } finally {
    inFlightSynthesis.delete(path);
  }
}
