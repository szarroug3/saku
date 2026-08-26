// SAK-196's cache check, ported to /api/pitch-tts (identical shape to
// /api/tts/route.test.ts — see that file's header for the full rationale on
// why mocking global.fetch is enough to cover hit/miss/throw without a real
// VOICEVOX or Supabase round trip). One extra thing this route has that
// /api/tts doesn't: inFlightSynthesis, keyed by object path — each test below
// uses a distinct (reading, downstep) pair so they can't collide on that map.

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { GET } from "./route.ts";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_VOICE_AUDIO_BUCKET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VOICEVOX_ENGINE_URL",
] as const;

let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET = "tts-voice";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  // Never actually dialed — fetch is mocked in every test below — this only
  // needs to be non-empty so ttsConfigured() lets the request past the 503
  // gate and into the cache check under test.
  process.env.VOICEVOX_ENGINE_URL = "http://fake-voicevox.test";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  mock.restoreAll();
});

const call = (reading: string, downstep: number, v = "nana") =>
  GET(new Request(`http://t/api/pitch-tts?r=${encodeURIComponent(reading)}&d=${downstep}&v=${v}`));

test("cache hit: HEAD 200 redirects to the CDN URL and synthesis never runs", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    return new Response(null, { status: 200 });
  });

  const res = await call("せんせい", 3);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get("location")?.includes("/tts-voice/"));
  assert.equal(calls.length, 1, "only the HEAD check should run on a hit — no synthesis call");
  assert.equal(calls[0].method, "HEAD");
});

test("cache miss: HEAD non-2xx falls through to synthesize, never redirects", async () => {
  mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "HEAD") return new Response(null, { status: 404 });
    // The miss path's synthesize attempt (tts-synth.ts's own fetch to
    // VOICEVOX_ENGINE_URL) — simulated unreachable so this stays offline.
    throw new Error("simulated VOICEVOX unreachable");
  });

  const res = await call("がっこう", 2);
  assert.equal(res.status, 502, "falls through to synthesize, fails there cleanly, never a redirect");
});

test("HEAD request throws (DNS/network failure): treated as a miss, never a 500", async () => {
  mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "HEAD") throw new Error("simulated DNS failure");
    throw new Error("simulated VOICEVOX unreachable");
  });

  const res = await call("ともだち", 0);
  assert.equal(res.status, 502, "a thrown HEAD must fall through exactly like a non-2xx HEAD");
  assert.notEqual(res.status, 500, "a HEAD throw must never surface as an unhandled 500");
});
