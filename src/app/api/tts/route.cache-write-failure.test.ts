// SAK-255: a transient Storage cache-write failure, AFTER synthesis already
// succeeded, must still serve the good clip it already has in hand — not
// discard it and 502 speech.ts's caller onto the browser's fallback voice.
// /api/pitch-tts already handled this correctly; this is /api/tts catching up.
//
// This is a separate file (not an addition to route.test.ts) because it needs
// tts-synth.ts's synthesizeSentenceWav and audio-compress.ts's encodeOpus
// mocked OUT entirely — real VOICEVOX/ffmpeg calls are out of scope here, only
// the cache-write step is under test — and node:test's mock.module must be
// registered before route.ts is imported (hence the dynamic import below,
// same pattern as src/lib/store/supabase-store.test.ts).

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

mock.module("@/lib/tts-synth", {
  namedExports: {
    ttsConfigured: () => true,
    synthesizeSentenceWav: async () => ({
      bytes: new ArrayBuffer(8),
      totalPhrases: 0,
      matchedPhrases: 0,
    }),
  },
});

mock.module("@/lib/audio-compress", {
  namedExports: {
    AUDIO_CONTENT_TYPE: "audio/ogg",
    encodeOpus: async () => Buffer.from([1, 2, 3, 4]),
  },
});

// Imported dynamically, AFTER the mocks above are registered, so route.ts's
// own imports of tts-synth/audio-compress resolve to the fakes.
const { GET } = await import("./route.ts");

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_VOICE_AUDIO_BUCKET",
  "SUPABASE_SECRET_KEY",
  "VOICEVOX_ENGINE_URL",
] as const;

let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET = "tts-voice";
  process.env.SUPABASE_SECRET_KEY = "fake-secret-key";
  process.env.VOICEVOX_ENGINE_URL = "http://fake-voicevox.test";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const call = (v: string, text: string) =>
  GET(new Request(`http://t/api/tts?v=${v}&t=${encodeURIComponent(text)}`));

test("cache-write failure after successful synthesis still serves the clip, not a 502", async () => {
  const fetchMock = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "HEAD") return new Response(null, { status: 404 }); // cache miss
    // Everything else here is the Storage upload call (synthesis itself is
    // mocked out above, never touches fetch) — simulate a transient write
    // failure (e.g. a Storage 500) on it.
    return new Response(JSON.stringify({ message: "simulated transient Storage failure" }), {
      status: 500,
    });
  });
  mock.method(globalThis, "fetch", fetchMock);

  const res = await call("nana", "え");

  assert.equal(
    res.status,
    200,
    "a cache-write failure must not discard the already-synthesized clip",
  );
  assert.equal(res.headers.get("Content-Type"), "audio/ogg");
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), [1, 2, 3, 4], "the actual synthesized bytes must be served");

  mock.restoreAll();
});

test("cache-write throwing outright (network blip on the upload call) also still serves the clip", async () => {
  mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "HEAD") return new Response(null, { status: 404 });
    throw new Error("simulated network blip on Storage upload");
  });

  const res = await call("nana", "お");

  assert.equal(res.status, 200);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);

  mock.restoreAll();
});
