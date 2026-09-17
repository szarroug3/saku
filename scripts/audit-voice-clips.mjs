// Compares the voice clips in Supabase Storage with the clips the app can ask
// for today, in both directions (SAK-463):
//
//   unwanted: stored, and no seeding set lists it any more. Something that was
//             seeded once and has since left the app (a word dropped from the
//             vocabulary, an example sentence replaced).
//   missing:  listed by a set, and not stored. The voice cache rule says this
//             is always zero; `seed-voice-audio.mjs --dry-run` says the same
//             thing a slower way.
//
// Run (report only, reads the bucket's listing and writes nothing):
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/audit-voice-clips.mjs
//
// The full list of unwanted paths goes to .logs/voice-clips-unwanted.txt.
//
// ONE THING AN "UNWANTED" CLIP CAN BE THAT IS NOT A LEFTOVER. When the app
// speaks a string no set lists, the live route records it on the spot and
// saves it under the same kind of path. From here that clip looks exactly like
// a leftover. It costs nothing to keep and the app may ask for it again, so
// read the count as "at most this many leftovers", and look at why a string is
// spoken without being in a set before deleting anything.
//
// DELETING is a separate step, and only with both flags:
//   ... scripts/audit-voice-clips.mjs --delete-unwanted            (prints what it would remove)
//   ... scripts/audit-voice-clips.mjs --delete-unwanted --execute  (removes them)
// It removes only paths this run found unwanted, never a wanted one.

import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { VOICES } from "@/lib/voice";

import { loadExistingKeys, SETS } from "./seed-voice-audio.mjs";

/** Every file name a set asks for, per voice. */
export function wantedFiles(sets, voiceIds) {
  const wanted = new Map(voiceIds.map((v) => [v, new Set()]));
  for (const def of Object.values(sets)) {
    for (const raw of def.items()) {
      for (const v of voiceIds) {
        const path = def.path(raw, v);
        wanted.get(v).add(path.slice(path.lastIndexOf("/") + 1));
      }
    }
  }
  return wanted;
}

/** The two differences, per voice: what is stored and not wanted, and what is
 * wanted and not stored. Pure, so the test needs no Storage. */
export function compareClips(stored, wanted) {
  const byVoice = new Map();
  for (const voiceId of new Set([...stored.keys(), ...wanted.keys()])) {
    const have = stored.get(voiceId) ?? new Set();
    const want = wanted.get(voiceId) ?? new Set();
    byVoice.set(voiceId, {
      stored: have.size,
      wanted: want.size,
      unwanted: [...have].filter((f) => !want.has(f)).sort(),
      missing: [...want].filter((f) => !have.has(f)).sort(),
    });
  }
  return byVoice;
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!bucket || !supaUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_VOICE_AUDIO_BUCKET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const voiceIds = VOICES.map((v) => v.id);

  const report = compareClips(await loadExistingKeys(supabase, bucket, voiceIds), wantedFiles(SETS, voiceIds));
  const paths = [];
  let stored = 0, wanted = 0, missing = 0;
  for (const [voiceId, r] of report) {
    stored += r.stored;
    wanted += r.wanted;
    missing += r.missing.length;
    for (const f of r.unwanted) paths.push(`voices/${voiceId}/${f}`);
    console.log(`${voiceId}: ${r.stored} stored, ${r.wanted} wanted, ${r.unwanted.length} unwanted, ${r.missing.length} missing`);
  }
  console.log(`\nAll voices: ${stored} stored, ${wanted} wanted, ${paths.length} unwanted, ${missing} missing.`);
  mkdirSync(".logs", { recursive: true });
  writeFileSync(".logs/voice-clips-unwanted.txt", paths.join("\n") + (paths.length ? "\n" : ""));
  console.log("Unwanted paths written to .logs/voice-clips-unwanted.txt");

  if (!flags.has("--delete-unwanted")) return;
  if (!flags.has("--execute")) {
    console.log(`\nWould remove ${paths.length} clip(s). Add --execute to remove them.`);
    return;
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`removing clips: ${error.message}`);
  }
  console.log(`\nRemoved ${paths.length} clip(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
