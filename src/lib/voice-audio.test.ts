import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PACK_VOICES,
  isPackVoice,
  packApiUrl,
  packAudioUrl,
  packVoice,
  ttsSsml,
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
    voiceObjectPath("keita", "あ"),
    `voices/keita/${voiceKey("あ")}.mp3`,
  );
});

test("isPackVoice matches only registered pack ids", () => {
  assert.ok(isPackVoice("keita"));
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
  assert.equal(packAudioUrl("keita", "あ"), null);

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET = "tts-voice";
  assert.equal(
    packAudioUrl("keita", "あ"),
    `https://proj.supabase.co/storage/v1/object/public/tts-voice/${voiceObjectPath("keita", "あ")}`,
  );

  restore("NEXT_PUBLIC_SUPABASE_URL", savedUrl);
  restore("NEXT_PUBLIC_VOICE_AUDIO_BUCKET", savedBucket);
});

test("packApiUrl points at the on-demand route with encoded params", () => {
  assert.equal(packApiUrl("keita", "うみ"), `/api/tts?v=keita&t=${encodeURIComponent("うみ")}`);
});

test("ttsSsml embeds the voice + prosody, derives lang, and escapes text", () => {
  const ssml = ttsSsml("ja-JP-KeitaNeural", "-10%", "-12Hz", "海");
  assert.match(ssml, /xml:lang="ja-JP"/);
  assert.match(ssml, /<voice name="ja-JP-KeitaNeural">/);
  assert.match(ssml, /<prosody rate="-10%" pitch="-12Hz">海<\/prosody>/);
  // Locale comes from the voice prefix.
  assert.match(ttsSsml("en-GB-ThomasNeural", "+0%", "+0Hz", "hi"), /xml:lang="en-GB"/);
  // XML-escaped so a stray metacharacter can't break the document.
  assert.match(ttsSsml("ja-JP-KeitaNeural", "+0%", "+0Hz", `a<b>&"'`), /a&lt;b&gt;&amp;&quot;&apos;/);
});
