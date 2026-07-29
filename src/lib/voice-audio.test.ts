import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PACK_VOICES,
  isPackVoice,
  packAudioUrl,
  packVoice,
  voiceKey,
  voiceObjectPath,
} from "./voice-audio.ts";

test("voiceKey is deterministic 16-hex and text-sensitive", () => {
  assert.equal(voiceKey("あ"), voiceKey("あ"));
  assert.match(voiceKey("あ"), /^[0-9a-f]{16}$/);
  assert.notEqual(voiceKey("あ"), voiceKey("い"));
  // Trimmed, so incidental whitespace maps to the same clip.
  assert.equal(voiceKey(" あ "), voiceKey("あ"));
});

test("voiceObjectPath is voices/<id>/<key>.mp3", () => {
  assert.equal(
    voiceObjectPath("keita-soothing", "あ"),
    `voices/keita-soothing/${voiceKey("あ")}.mp3`,
  );
});

test("isPackVoice matches only registered pack ids", () => {
  assert.ok(isPackVoice("keita-soothing"));
  assert.ok(!isPackVoice(""));
  assert.ok(!isPackVoice("Kyoko"));
  assert.ok(PACK_VOICES.every((v) => packVoice(v.id) === v));
});

test("packAudioUrl is null unconfigured, a public URL when configured", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedBucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const restore = (k: string, v: string | undefined) =>
    v === undefined ? delete process.env[k] : (process.env[k] = v);

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  assert.equal(packAudioUrl("keita-soothing", "あ"), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET = "tts-voice";
  assert.equal(
    packAudioUrl("keita-soothing", "あ"),
    `https://proj.supabase.co/storage/v1/object/public/tts-voice/${voiceObjectPath("keita-soothing", "あ")}`,
  );

  restore("NEXT_PUBLIC_SUPABASE_URL", savedUrl);
  restore("NEXT_PUBLIC_VOICE_AUDIO_BUCKET", savedBucket);
});
