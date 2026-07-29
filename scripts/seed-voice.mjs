// Seed a pack voice into Supabase Storage (or generate clips locally to hear).
//
// Synthesizes each clip with Azure Speech — the SAME code /api/tts uses — so a
// pre-seeded clip and an on-demand one are byte-for-byte identical (one engine,
// no drift). Uploads to the public bucket at voices/<voiceId>/<key>.mp3, the path
// speech.ts reads. Idempotent: a clip already in the bucket is skipped (unless
// --force), so it is safe to re-run and to resume after an interruption.
//
// PREREQUISITES (all in .env.local; the same ones /api/tts uses)
//   - AZURE_SPEECH_KEY / AZURE_SPEECH_REGION — an Azure Speech resource (free F0).
//   - NEXT_PUBLIC_SUPABASE_URL + a PUBLIC bucket named in NEXT_PUBLIC_VOICE_AUDIO_BUCKET.
//   - SUPABASE_SERVICE_ROLE_KEY (upload bypasses RLS).
//   (--local needs ONLY the Azure vars — it writes files, no upload.)
//
// RUN:
//   pnpm run voice:seed                          # keita (default)
//   pnpm run voice:seed -- --id nanami           # another registered voice
//   pnpm run voice:seed -- --force               # overwrite existing clips
//   pnpm run voice:seed -- --local ./tmp-voice   # write the set locally, no upload
//   pnpm run voice:seed -- --local ./tmp-voice --text "こんにちは"   # just one clip, to hear it
//
// OPTIONS
//   --id <folder>   storage folder + voiceName, e.g. keita (default), nanami.
//   --voice <name>  Azure voice, e.g. ja-JP-KeitaNeural, en-GB-ThomasNeural.
//   --rate <r>      prosody rate, e.g. -10% (default +0%).
//   --pitch <p>     prosody pitch, e.g. -12Hz (default +0Hz).
//   --set <name>    which strings to seed (default: kana; only kana today).
//   --text <s>      synthesize just this ONE string (verbatim, no held padding);
//                   overrides --set. Handy with --local to audition a word/voice.
//   --local <dir>   write mp3s to <dir> instead of uploading (skips Supabase
//                   entirely); files are named by the text (あ.mp3, こんにちは.mp3).
//   --force         regenerate + re-upload every clip (use after a prosody change).
//
// If --id names a voice registered in PACK_VOICES, --voice/--rate/--pitch default
// to that entry's settings, so `--id keita` alone works.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { CHAR_INDEX } from "../src/data/characters.ts";
import { synthesizeMp3 } from "../src/lib/tts-synth.ts";
import { VOICE_PREVIEW, packVoice, voiceObjectPath } from "../src/lib/voice-audio.ts";

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const voiceId = arg("id", "keita");
const set = arg("set", "kana");
const force = args.includes("--force");
const local = arg("local", null); // dir to write to instead of uploading
const oneText = arg("text", null); // synthesize just this string (verbatim)

// --voice/--rate/--pitch are explicit; a registered --id fills any that were
// omitted, so `--id keita` alone works.
const registered = packVoice(voiceId);
const voice = arg("voice", registered?.source.voice);
const rate = arg("rate", registered?.source.rate ?? "+0%");
const pitch = arg("pitch", registered?.source.pitch ?? "+0Hz");
if (!voice) {
  console.error(
    `No voice for id "${voiceId}". Pass --voice <Azure voice> (e.g. ja-JP-KeitaNeural), ` +
      `or use an --id registered in PACK_VOICES (src/lib/voice-audio.ts).`,
  );
  process.exit(1);
}

if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
  console.error("Missing AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Run with: pnpm run voice:seed");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
if (!local && (!url || !key || !bucket)) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and " +
      "NEXT_PUBLIC_VOICE_AUDIO_BUCKET to upload (or pass --local <dir> to write files instead).",
  );
  process.exit(1);
}

/** The strings to seed for a named set. Only kana today; words/sentences are
 * generated on demand by /api/tts, not seeded. */
function speakables(name) {
  if (name === "kana") return Object.keys(CHAR_INDEX);
  console.error(`Unknown set "${name}". Only "kana" is seedable today.`);
  process.exit(1);
}

// Pair each string with the text to SYNTHESIZE. A bare single mora renders too
// short/quiet, so for the kana set we synthesize a HELD "<kana>ー" while keying
// the clip on the ORIGINAL kana — speech.ts looks up "か" and gets "かー". The
// preview (multi-mora) is never padded. --text is taken verbatim. Entries are
// [keyText, ttsText].
const held = (k) => (set === "kana" && k !== "っ" && k !== "ッ" ? `${k}ー` : k);
const seen = new Set();
const items = oneText
  ? [[oneText, oneText]]
  : [
      [VOICE_PREVIEW, VOICE_PREVIEW],
      ...speakables(set).map((t) => [t, held(t)]),
    ].filter(([k]) => !seen.has(k) && !!seen.add(k));

const supabase = local ? null : createClient(url, key, { auth: { persistSession: false } });
if (local) mkdirSync(local, { recursive: true });

console.log(
  `${local ? "Writing" : "Seeding"} ${items.length} "${oneText ? "text" : set}" clip(s) for voice ` +
    `"${voiceId}" (${voice} ${rate}/${pitch})${local ? ` to ${local}` : ` into bucket "${bucket}"`}.`,
);

let made = 0;
let skipped = 0;
let failed = 0;
for (const [text, tts] of items) {
  if (!local && !force) {
    const path = voiceObjectPath(voiceId, text);
    const folder = path.slice(0, path.lastIndexOf("/"));
    const file = path.slice(path.lastIndexOf("/") + 1);
    const { data: existing } = await supabase.storage.from(bucket).list(folder, { search: file });
    if (existing?.some((f) => f.name === file)) {
      skipped++;
      continue;
    }
  }

  let bytes;
  try {
    bytes = await synthesizeMp3(voice, rate, pitch, tts);
  } catch (e) {
    console.error(`  synth failed for "${text}": ${e.message}`);
    failed++;
    continue;
  }

  if (local) {
    writeFileSync(join(local, `${text.replace(/[/\\]/g, "_")}.mp3`), Buffer.from(bytes));
    made++;
    continue;
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(voiceObjectPath(voiceId, text), Buffer.from(bytes), {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (error) {
    console.error(`  upload failed for "${text}": ${error.message}`);
    failed++;
    continue;
  }
  made++;
  if (made % 20 === 0) console.log(`  ${made} uploaded...`);
}

console.log(
  `Done. ${local ? "wrote" : "uploaded"} ${made}, skipped ${skipped}, failed ${failed}.`,
);
if (failed) process.exit(1);
