// Seed a pack voice into Supabase Storage.
//
// Generates each clip LOCALLY with edge-tts (free, no key) and uploads it to the
// public bucket at voices/<voiceId>/<key>.mp3 — the same path speech.ts reads.
// Idempotent: a clip already in the bucket is skipped, so it is safe to re-run
// and to resume after an interruption.
//
// PREREQUISITES
//   - uv installed (brew install uv, or https://astral.sh/uv). edge-tts is run
//     THROUGH uv, which installs it (pinned in scripts/requirements.txt) into a
//     cached env on first use — no venv to manage, nothing to remember on a fresh
//     clone. Or set EDGE_TTS_BIN=/path/to/edge-tts to use a binary directly.
//   - a PUBLIC Storage bucket created in the Supabase Dashboard, its name in
//     NEXT_PUBLIC_VOICE_AUDIO_BUCKET
//   - SUPABASE_SERVICE_ROLE_KEY set (upload bypasses RLS)
//
// RUN (loads .env.local for the keys, and the TS loader so it can import the
// app's data + the shared voice-audio helpers):
//   corepack pnpm exec node --env-file=.env.local \
//     --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice.mjs
//
// OPTIONS
//   --id <folder>   storage folder + voiceName, e.g. keita-soothing (default),
//                   thomas-calm. This is what Settings persists and speech.ts reads.
//   --voice <name>  edge-tts voice, e.g. ja-JP-KeitaNeural, en-GB-ThomasNeural.
//   --rate <r>      prosody rate, e.g. -10% (default +0%).
//   --pitch <p>     prosody pitch, e.g. -12Hz (default +0Hz).
//   --set <name>    which strings to seed (default: kana; only kana today).
//
// If --id names a voice already registered in PACK_VOICES, --voice/--rate/--pitch
// default to that entry's settings, so `--id keita-soothing` alone works. To seed
// a brand-new voice, pass them explicitly:
//   ... scripts/seed-voice.mjs --id thomas-calm --voice en-GB-ThomasNeural --rate=-12% --pitch=-15Hz

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { CHAR_INDEX } from "../src/data/characters.ts";
import { VOICE_PREVIEW, packVoice, voiceObjectPath } from "../src/lib/voice-audio.ts";

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const voiceId = arg("id", "keita-soothing");
const set = arg("set", "kana");
const reqPath = fileURLToPath(new URL("./requirements.txt", import.meta.url));

// Run edge-tts through uv (installs the pinned package into a cached env on
// first use), unless EDGE_TTS_BIN points at a binary directly.
const edgeArgs = (out, text) => [
  "--voice", voice,
  `--rate=${rate}`,
  `--pitch=${pitch}`,
  "--text", text,
  "--write-media", out,
];
const runEdge = (out, text) =>
  process.env.EDGE_TTS_BIN
    ? execFileSync(process.env.EDGE_TTS_BIN, edgeArgs(out, text), { stdio: "ignore" })
    : execFileSync(
        "uv",
        ["run", "--with-requirements", reqPath, "edge-tts", ...edgeArgs(out, text)],
        { stdio: "ignore" },
      );

// --voice/--rate/--pitch are explicit; if the id is a registered pack, its
// settings fill any that were omitted, so `--id keita-soothing` alone works.
const registered = packVoice(voiceId);
const voice = arg("voice", registered?.source.voice);
const rate = arg("rate", registered?.source.rate ?? "+0%");
const pitch = arg("pitch", registered?.source.pitch ?? "+0Hz");
if (!voice) {
  console.error(
    `No voice for id "${voiceId}". Pass --voice <edge-tts voice> (e.g. ja-JP-KeitaNeural), ` +
      `or use an --id registered in PACK_VOICES (src/lib/voice-audio.ts).`,
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
if (!url || !key || !bucket) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and " +
      "NEXT_PUBLIC_VOICE_AUDIO_BUCKET.\nRun with:  corepack pnpm exec node --env-file=.env.local " +
      "--import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice.mjs",
  );
  process.exit(1);
}

/** The strings to seed for a named set. Only kana today; words/sentences are
 * generated on demand by the runtime cache, not seeded. */
function speakables(name) {
  if (name === "kana") return Object.keys(CHAR_INDEX);
  console.error(`Unknown set "${name}". Only "kana" is seedable today.`);
  process.exit(1);
}

// Always seed the Settings preview phrase so picking the voice previews IT, not
// the browser fallback. Dedup in case the set already contains it.
const texts = [...new Set([VOICE_PREVIEW, ...speakables(set)])];
const supabase = createClient(url, key, { auth: { persistSession: false } });
// Fail early with a clear message if uv is missing (unless a direct binary is set).
if (!process.env.EDGE_TTS_BIN) {
  try {
    execFileSync("uv", ["--version"], { stdio: "ignore" });
  } catch {
    console.error(
      "uv not found. Install it (brew install uv, or https://astral.sh/uv/), " +
        "or set EDGE_TTS_BIN to an edge-tts binary.",
    );
    process.exit(1);
  }
}

const tmp = mkdtempSync(join(tmpdir(), "seed-voice-"));

console.log(
  `Seeding ${texts.length} "${set}" clip(s) for voice "${voiceId}" ` +
    `(${voice} ${rate}/${pitch}) into bucket "${bucket}".`,
);

let made = 0;
let skipped = 0;
let failed = 0;
try {
  for (const text of texts) {
    const path = voiceObjectPath(voiceId, text);
    const folder = path.slice(0, path.lastIndexOf("/"));
    const file = path.slice(path.lastIndexOf("/") + 1);

    const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: file });
    if (existing?.some((f) => f.name === file)) {
      skipped++;
      continue;
    }

    const out = join(tmp, "clip.mp3");
    try {
      runEdge(out, text);
    } catch (e) {
      console.error(`  edge-tts failed for "${text}": ${e.message}`);
      failed++;
      continue;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, readFileSync(out), { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.error(`  upload failed for "${text}": ${error.message}`);
      failed++;
      continue;
    }
    made++;
    if (made % 20 === 0) console.log(`  ${made} uploaded...`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Done. uploaded ${made}, skipped ${skipped} (already present), failed ${failed}.`);
if (failed) process.exit(1);
