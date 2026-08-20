import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_VOICE_ID,
  VOICES,
  isVoiceId,
  pitchApiUrl,
  pitchAudioUrl,
  pitchObjectPath,
  voice,
  voiceApiUrl,
  voiceAudioUrl,
  voiceKey,
  voiceObjectPath,
} from "./voice.ts";

test("voiceKey is deterministic 16-hex and text-sensitive", () => {
  assert.equal(voiceKey("あ"), voiceKey("あ"));
  assert.match(voiceKey("あ"), /^[0-9a-f]{16}$/);
  assert.notEqual(voiceKey("あ"), voiceKey("い"));
  // Trimmed, so incidental whitespace maps to the same clip.
  assert.equal(voiceKey(" あ "), voiceKey("あ"));
});

test("voiceObjectPath is voices/<id>/<key>.wav", () => {
  assert.equal(
    voiceObjectPath("nana", "あ"),
    `voices/nana/${voiceKey("あ")}.opus`,
  );
});

test("pitchObjectPath keys on (reading, downstep, voiceId), never colliding with a general clip", () => {
  const p1 = pitchObjectPath("せんせい", 3, "nana");
  const p2 = pitchObjectPath("せんせい", 1, "nana");
  const general = voiceObjectPath("nana", "せんせい");
  assert.notEqual(p1, p2, "a different downstep must not collide");
  assert.notEqual(p1, general, "a pitch clip must not collide with a general-speech clip of the same text");
  assert.match(p1, /^voices\/nana\/pitch-[0-9a-f]{16}\.opus$/);
});

test("isVoiceId matches only registered roster ids", () => {
  assert.ok(isVoiceId("nana"));
  assert.ok(isVoiceId("aoyama"));
  assert.ok(!isVoiceId(""));
  assert.ok(!isVoiceId("keita"));
  assert.ok(!isVoiceId("Kyoko"));
  assert.ok(VOICES.every((v) => voice(v.id) === v));
});

test("VOICES is the curated six, never the raw VOICEVOX 'No.7' label", () => {
  assert.equal(VOICES.length, 6);
  assert.ok(VOICES.every((v) => !/no\.?\s*7/i.test(v.label)));
  assert.equal(DEFAULT_VOICE_ID, "aoyama");
  assert.ok(isVoiceId(DEFAULT_VOICE_ID));
});

test("voiceAudioUrl / pitchAudioUrl are null unconfigured, a public URL when configured", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedBucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const restore = (k: string, v: string | undefined) =>
    v === undefined ? delete process.env[k] : (process.env[k] = v);

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  assert.equal(voiceAudioUrl("nana", "あ"), null);
  assert.equal(pitchAudioUrl("せんせい", 3, "nana"), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET = "tts-voice";
  assert.equal(
    voiceAudioUrl("nana", "あ"),
    `https://proj.supabase.co/storage/v1/object/public/tts-voice/${voiceObjectPath("nana", "あ")}`,
  );
  assert.equal(
    pitchAudioUrl("せんせい", 3, "nana"),
    `https://proj.supabase.co/storage/v1/object/public/tts-voice/${pitchObjectPath("せんせい", 3, "nana")}`,
  );

  restore("NEXT_PUBLIC_SUPABASE_URL", savedUrl);
  restore("NEXT_PUBLIC_VOICE_AUDIO_BUCKET", savedBucket);
});

test("voiceApiUrl / pitchApiUrl point at the on-demand routes with encoded params", () => {
  assert.equal(voiceApiUrl("nana", "うみ"), `/api/tts?v=nana&t=${encodeURIComponent("うみ")}`);
  assert.equal(
    pitchApiUrl("せんせい", 3, "nana"),
    `/api/pitch-tts?r=${encodeURIComponent("せんせい")}&d=3&v=nana`,
  );
  // Default voice when omitted, so old callers/URLs keep working.
  assert.equal(
    pitchApiUrl("せんせい", 3),
    `/api/pitch-tts?r=${encodeURIComponent("せんせい")}&d=3&v=${DEFAULT_VOICE_ID}`,
  );
});
