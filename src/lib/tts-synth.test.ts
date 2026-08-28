// SAK-215: synthesizeWordWav/synthesizeAtDownstep must swap a hiragana
// reading for katakana ONLY when it's on the confirmed-bad exception list
// (WORD_READING_MISREADING), never blanket — an earlier version of this fix
// converted every reading unconditionally and broke words like こんにちは
// (real, correct コンニチワ reading; forcing katakana renders it literally
// as コンニチハ, wrong). global.fetch is the one seam this module calls
// through (see tts-synth.ts's audioQuery/synthesize), same mocking approach
// as src/app/api/pitch-tts/route.test.ts and src/app/api/tts/route.test.ts.

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { synthesizeWordWav } from "./tts-synth.ts";

let savedEngineUrl: string | undefined;

beforeEach(() => {
  savedEngineUrl = process.env.VOICEVOX_ENGINE_URL;
  process.env.VOICEVOX_ENGINE_URL = "http://fake-voicevox.test";
});

afterEach(() => {
  if (savedEngineUrl === undefined) delete process.env.VOICEVOX_ENGINE_URL;
  else process.env.VOICEVOX_ENGINE_URL = savedEngineUrl;
  mock.restoreAll();
});

/** A minimal fake VOICEVOX: the filler query (natural-range measurement)
 * always answers with a few voiced moras; any other audio_query answers with
 * one mora per character of whatever text it was asked for (pitch 5, voiced)
 * — enough to drive `pitchPatternForLength` without caring about real
 * Japanese phonetics. `/synthesis` just echoes an empty buffer. Every
 * audio_query call's DECODED `text` param is recorded in `queried`, in call
 * order, so a test can assert exactly what string reached VOICEVOX. */
function mockVoicevox(): { queried: string[] } {
  const queried: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/audio_query") {
      const text = decodeURIComponent(url.searchParams.get("text") ?? "");
      queried.push(text);
      // The filler phrase needs several non-zero pitches to seed the voice's
      // natural range; any other query gets one voiced mora per character.
      const isFiller = text === "おはようございます";
      const moras = [...text].map((ch, i) => ({
        text: ch,
        pitch: isFiller ? 3 + (i % 3) : 5,
      }));
      return new Response(JSON.stringify({ accent_phrases: [{ moras }] }), { status: 200 });
    }
    if (url.pathname === "/synthesis") {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url.pathname}`);
  });
  return { queried };
}

test("a CONFIRMED-bad reading (はち, 八's reported bug) is converted to katakana before audio_query", async () => {
  const { queried } = mockVoicevox();
  await synthesizeWordWav("はち", 1, 9001);
  // First call is always the filler (natural-range measurement); the second
  // is the actual word query — and it must be katakana, not the hiragana
  // reading the caller passed in.
  assert.deepEqual(queried, ["おはようございます", "ハチ"]);
});

test("an ORDINARY reading not on the exception list reaches audio_query unchanged, still hiragana", async () => {
  const { queried } = mockVoicevox();
  await synthesizeWordWav("せんせい", 3, 9002);
  assert.deepEqual(queried, ["おはようございます", "せんせい"]);
});

test("another CONFIRMED-bad reading (はは, 母) is also converted; a merely SIMILAR reading (はな) is not", async () => {
  const { queried: q1 } = mockVoicevox();
  await synthesizeWordWav("はは", 0, 9003);
  assert.deepEqual(q1, ["おはようございます", "ハハ"]);

  mock.restoreAll();
  const { queried: q2 } = mockVoicevox();
  await synthesizeWordWav("はな", 0, 9004);
  assert.deepEqual(q2, ["おはようございます", "はな"], "はな is not on the exception list — must stay hiragana");
});

test("SAK-218: a newly-confirmed bad reading (さつ, 冊/札's shared word-final drop) is converted to katakana", async () => {
  const { queried } = mockVoicevox();
  await synthesizeWordWav("さつ", 0, 9006);
  assert.deepEqual(queried, ["おはようございます", "サツ"]);
});

test("SAK-218: another newly-confirmed bad reading (つかう, 使う's dictionary-form verb ending misread as あ) is converted; a merely SIMILAR reading (つかれる) is not", async () => {
  const { queried: q1 } = mockVoicevox();
  await synthesizeWordWav("つかう", 0, 9007);
  assert.deepEqual(q1, ["おはようございます", "ツカウ"]);

  mock.restoreAll();
  const { queried: q2 } = mockVoicevox();
  await synthesizeWordWav("つかれる", 0, 9008);
  assert.deepEqual(q2, ["おはようございます", "つかれる"], "つかれる is not on the exception list — must stay hiragana");
});

test("mora COUNT and pitch pattern are unaffected by the katakana swap", async () => {
  mockVoicevox();
  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/audio_query") {
      const text = decodeURIComponent(url.searchParams.get("text") ?? "");
      const isFiller = text === "おはようございます";
      const moras = [...text].map((ch, i) => ({ text: ch, pitch: isFiller ? 3 + (i % 3) : 5 }));
      return new Response(JSON.stringify({ accent_phrases: [{ moras }] }), { status: 200 });
    }
    if (url.pathname === "/synthesis") {
      calls.push(String(await init?.body));
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url.pathname}`);
  });

  // はち (2 morae) at downstep 1 (atamadaka): mora 1 high, mora 2 low.
  await synthesizeWordWav("はち", 1, 9005);
  const body = JSON.parse(calls[0]);
  const moras = body.accent_phrases[0].moras;
  assert.equal(moras.length, 2, "katakana ハチ must still parse to 2 morae, same as はち would");
  assert.notEqual(moras[0].pitch, moras[1].pitch, "downstep 1 must render as a high/low contrast, not flat");
});
