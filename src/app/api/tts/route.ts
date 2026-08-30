// GET /api/tts?v=<voiceId>&t=<text> — on-demand voice audio, general speech
// (SAK-100). Backs every ordinary Hear button, quiz prompt and listening
// exercise in the app — the SAME contract this route has always had
// (?v=&t=), so lib/speech.ts's callers needed no changes; only what
// synthesizes behind it changed, from Azure to VOICEVOX with sentence-level
// pitch correction (src/lib/tts-synth.ts, src/lib/sentence-pitch.ts).
//
// Same two-tier shape as before: check the Storage bucket first (302 to the
// CDN URL on a hit); on a miss, synthesize, cache the clip into the bucket,
// and return the bytes, so the next request for it is a cache hit. Any
// failure answers non-2xx and speech.ts falls back to the browser voice.
//
// COMPRESSED: VOICEVOX's own output is raw WAV; every clip is re-encoded to
// Opus (audio-compress.ts, shared with the bulk seed script) before it's
// cached or returned, same as the pre-seeded corpus — otherwise a live miss
// would write an inconsistent uncompressed clip under the same path scheme
// the pre-seed uses. See audio-compress.ts's header for why (Supabase
// free-tier storage budget) and voice.ts's for the path scheme.
//
// No auth: the audio is public and non-sensitive. Abuse is bounded by
// requiring a REGISTERED roster voice and a short text; anything else is 400.

import { AUDIO_CONTENT_TYPE, encodeOpus } from "@/lib/audio-compress";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const publicUrl = voiceAudioUrl(voiceId, text);
  const supabase = createAdminClient();
  if (!bucket || !supabase || !publicUrl || !ttsConfigured()) {
    return new Response("tts not configured", { status: 503 });
  }

  const path = voiceObjectPath(voiceId, text);

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
    // SAK-285 (L48): a cold serverless container's FIRST ffmpeg spawn is a
    // real, plausible cost (process-launch overhead on top of the encode
    // itself) that local dev — a long-lived, already-warm process — cannot
    // reproduce. This never ran anywhere before; there was no number to look
    // at. Logging the encode's own wall time turns "structurally unmeasurable
    // locally" into "read it off Vercel's function logs" without guessing at
    // a threshold or changing behavior — a genuinely slow cold-start encode
    // shows up as an outlier duration on an early request, same log line
    // every other request also gets.
    const encodeStarted = Date.now();
    const opusBytes = await encodeOpus(bytes);
    console.info(`tts: opus encode took ${Date.now() - encodeStarted}ms for "${text}"`);

    // The cache write is a SEPARATE try: a transient Storage failure here must
    // not throw away a clip we already successfully synthesized and encoded
    // (SAK-255) — that used to fall through to the catch below, discard the
    // good audio, and 502 the request, forcing speech.ts's caller onto the
    // browser's built-in fallback voice for what should have been a normal
    // play. /api/pitch-tts already treats its own cache-write failure this
    // way; this mirrors it. It costs a re-synthesis on the next request until
    // the transient failure clears, but that's a cache-efficiency cost, not a
    // reason to withhold audio already in hand.
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, opusBytes, { contentType: AUDIO_CONTENT_TYPE, upsert: true });
      if (error) throw error;
    } catch (err) {
      console.error(`tts: cache upload failed for "${text}" (voice ${voiceId}), serving uncached`, err);
    }

    return new Response(new Blob([new Uint8Array(opusBytes)], { type: AUDIO_CONTENT_TYPE }), {
      headers: {
        "Content-Type": AUDIO_CONTENT_TYPE,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    // SAK-108: this used to be a bare `catch {}` that swallowed the real
    // error (e.g. VOICEVOX failure vs. the encodeOpus/ffmpeg step failing) —
    // logging it is the only way a future prod failure is diagnosable from
    // Vercel logs without the kind of manual sleuthing SAK-108 needed.
    console.error(`tts: synthesis/encode failed for "${text}" (voice ${voiceId})`, err);
    return new Response("synthesis failed", { status: 502 });
  }
}
