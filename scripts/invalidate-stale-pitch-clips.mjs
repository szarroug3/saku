// SAK-217: delete the Supabase Storage pitch clips that SAK-215's fix left
// behind, silently wrong.
//
// SAK-215 fixed `synthesizeAtDownstep` (src/lib/tts-synth.ts) so a NEW
// synthesis call for one of `CONFIRMED_BAD_READINGS` no longer mis-pronounces
// its は/へ as わ/え. It changed nothing about audio ALREADY sitting in
// Storage from before that fix — and seed-voice-audio.mjs's own cache-skip
// logic (`loadExistingKeys`, see that file) means simply re-running the seed
// after SAK-215 will NOT regenerate those clips: it sees them as "already
// have it" and leaves the wrong audio in place. This script computes exactly
// which Storage objects that stale audio lives at and deletes them, so the
// next seed run is forced to regenerate every one of them correctly.
//
// WHAT COUNTS AS STALE. For each of the 26 (as of this writing —
// CONFIRMED_BAD_READINGS is the actual source of truth, this comment is not)
// confirmed-bad readings: every (reading, downstep) pair `pitchItems()`
// (seed-voice-audio.mjs) would ever enumerate for that reading — its
// CORRECT downstep(s) via `wordPitch`, AND its DISTRACTOR downstep(s) via
// `wrongDownstepFor` (src/lib/pitch.ts, also seeded per SAK-216) — across
// every voice in the roster (`VOICES`, src/lib/voice.ts). This reuses
// `pitchItems()` itself rather than re-deriving that enumeration a second
// time, so there is zero risk of this script's idea of "what got seeded"
// drifting from the seed script's own.
//
// A READING CAN MAP TO MORE THAN ONE DOWNSTEP. It is tempting to assume the
// downstep only depends on the reading (kana), not on which kanji spells it
// — it does NOT: pitch.json / `wordPitch` is keyed on the WRITTEN form
// (`keb`), and different kanji sharing one reading can carry different
// accents. Concretely, in this app's own VOCAB: はち is 八 "eight" (downstep
// 0) AND 鉢/蜂 "bowl"/"bee" (downstep 2) — two genuinely different pitch
// patterns for the same reading. Deduping this script's readings down to one
// downstep each would silently miss half the stale clips. `pitchItems()`
// doesn't make that mistake (it walks every VOCAB row, not every distinct
// reading), and neither does this script, since it just filters that same
// item list rather than re-deriving its own.
//
// DRY RUN BY DEFAULT. No flag ⇒ compute every path and print it, grouped by
// reading, with a total count. No Supabase calls at all if credentials
// aren't configured — this mode has no hard dependency on live Storage. If
// credentials ARE available, it additionally does a READ-ONLY existence
// check (via `loadExistingKeys`, the exact same paginated `.list()` calls
// seed-voice-audio.mjs already uses to decide what's cached) so the report
// distinguishes "computed" (every theoretically-stale path) from "confirmed
// present in Storage right now" — never a `.remove()` call in this mode.
//
// --execute is the only way this touches Storage. Same env vars as
// seed-voice-audio.mjs (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_VOICE_AUDIO_BUCKET,
// SUPABASE_SECRET_KEY) — no new auth pattern invented for this script.
//
// Run:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/invalidate-stale-pitch-clips.mjs
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/invalidate-stale-pitch-clips.mjs --execute
//
// Then re-seed the pitch set to regenerate what this deleted, correctly:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice-audio.mjs --set=pitch

import { appendFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { CONFIRMED_BAD_READINGS } from "@/lib/tts-synth";
import { pitchObjectPath, VOICES } from "@/lib/voice";

import { loadExistingKeys, pitchItems } from "./seed-voice-audio.mjs";

/** Every (reading, downstep) pair `pitchItems()` enumerates for ONE
 * confirmed-bad reading — its correct downstep(s) and distractor
 * downstep(s), deduped exactly as `pitchItems()` itself dedupes them. Returns
 * `[]` for any reading not in `CONFIRMED_BAD_READINGS` — that's the whole
 * point of gating on it, rather than trusting the caller to only ever pass a
 * bad reading in. */
export function stalePitchItemsForReading(reading) {
  if (!CONFIRMED_BAD_READINGS.includes(reading)) return [];
  return pitchItems().filter((item) => item.reading === reading);
}

/** Every Storage object path this script considers stale: one row per
 * (reading, downstep, voice), in `CONFIRMED_BAD_READINGS` order (readings),
 * then `pitchItems()` order (downsteps), then `VOICES` order (voices) — a
 * stable, readable order for both the dry-run report and the delete batches.
 * Pure — no network calls, safe to import and call from a test. */
export function stalePitchClips() {
  return CONFIRMED_BAD_READINGS.flatMap((reading) =>
    stalePitchItemsForReading(reading).flatMap((item) =>
      VOICES.map((voice) => ({
        reading: item.reading,
        downstep: item.downstep,
        voiceId: voice.id,
        path: pitchObjectPath(item.reading, item.downstep, voice.id),
      })),
    ),
  );
}

/** Group a flat clip list into `reading -> downstep -> path[]`, preserving
 * `CONFIRMED_BAD_READINGS` order — the shape the dry-run report and the
 * execute-mode log both print from, so the two modes read identically apart
 * from the header line and whether a delete actually ran. */
function groupByReadingAndDownstep(clips) {
  const byReading = new Map();
  for (const clip of clips) {
    if (!byReading.has(clip.reading)) byReading.set(clip.reading, new Map());
    const byDownstep = byReading.get(clip.reading);
    if (!byDownstep.has(clip.downstep)) byDownstep.set(clip.downstep, []);
    byDownstep.get(clip.downstep).push(clip);
  }
  return byReading;
}

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    }),
  );
  return { execute: !!args.execute };
}

const LOG_DIR = new URL("../.logs/", import.meta.url);
const LOG_FILE = new URL("invalidate-stale-pitch-clips.log", LOG_DIR);
mkdirSync(LOG_DIR, { recursive: true });

/** console.info AND append to the log file, matching seed-voice-audio.mjs's
 * own logging discipline — this is a one-shot script too, and a run against
 * production Storage deserves a durable record of exactly what it did. */
function log(message) {
  console.info(message);
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}

/** Prints the grouped report shared by dry-run and execute mode.
 * `presence` is either null (existence not checked — no credentials, or the
 * caller chose not to check) or a `Map<path, boolean>` saying whether each
 * path is confirmed present in Storage right now. */
function printReport(clips, presence) {
  const byReading = groupByReadingAndDownstep(clips);
  for (const [reading, byDownstep] of byReading) {
    const pathCount = [...byDownstep.values()].reduce((sum, arr) => sum + arr.length, 0);
    log(`${reading} (${byDownstep.size} downstep pair(s), ${pathCount} path(s)):`);
    for (const [downstep, clipsForDownstep] of byDownstep) {
      log(`  downstep ${downstep}:`);
      for (const clip of clipsForDownstep) {
        const mark = presence === null ? "" : presence.get(clip.path) ? " [exists]" : " [not found]";
        log(`    ${clip.path}${mark}`);
      }
    }
  }
}

/** Read-only: builds a `Map<path, boolean>` saying which of `clips`'s paths
 * are confirmed present in Storage right now, via the exact same paginated
 * `.list()` mechanism seed-voice-audio.mjs uses to decide what's cached
 * (`loadExistingKeys`) — never `.remove()`. Returns null (existence unknown,
 * not "nothing exists") on any connection/credential problem, so a dry run
 * degrades to the full computed list instead of misreporting everything as
 * absent. */
async function checkExistence(clips, { bucket, supaUrl, serviceKey }) {
  if (!bucket || !supaUrl || !serviceKey) {
    log(
      "No Supabase credentials configured (NEXT_PUBLIC_VOICE_AUDIO_BUCKET / " +
        "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY) — skipping the live " +
        "existence check. Showing every theoretically-stale path below; run " +
        "again with credentials to see which of these are actually in Storage.",
    );
    return null;
  }
  try {
    const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
    const voiceIds = [...new Set(clips.map((c) => c.voiceId))];
    log("Checking which computed paths actually exist in Storage (read-only .list(), no deletes)...");
    const existingKeys = await loadExistingKeys(supabase, bucket, voiceIds);
    const presence = new Map();
    for (const clip of clips) {
      const file = clip.path.slice(clip.path.lastIndexOf("/") + 1);
      presence.set(clip.path, existingKeys.get(clip.voiceId)?.has(file) ?? false);
    }
    return presence;
  } catch (err) {
    log(`Existence check failed (${err.message}) — showing every theoretically-stale path below instead.`);
    return null;
  }
}

/** Deletes `clips` from Storage in fixed-size batches — one `.remove()` call
 * per batch rather than one call for the whole list (a few hundred paths
 * today, but no reason to assume the request stays small forever) or one
 * call per path (unnecessary round-trips for an API that already accepts a
 * batch). Removing a path that doesn't exist is not an error to Supabase —
 * this doesn't pre-filter by existence, it just deletes every computed path
 * and lets Storage no-op on anything already gone. */
async function deleteClips(clips, { bucket, supabase }) {
  const BATCH = 100;
  let removed = 0;
  let failed = 0;
  for (let i = 0; i < clips.length; i += BATCH) {
    const batch = clips.slice(i, i + BATCH);
    const paths = batch.map((c) => c.path);
    const { data, error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      failed += batch.length;
      log(`  ✗ batch ${i / BATCH + 1} (${batch.length} path(s)): ${error.message}`);
      continue;
    }
    removed += data?.length ?? batch.length;
    log(`  batch ${i / BATCH + 1}: removed ${data?.length ?? batch.length}/${batch.length}`);
  }
  return { removed, failed };
}

async function main() {
  const { execute } = parseArgs();
  const clips = stalePitchClips();
  const readingCount = new Set(clips.map((c) => c.reading)).size;

  log(
    `invalidate-stale-pitch-clips: ${CONFIRMED_BAD_READINGS.length} confirmed-bad reading(s), ` +
      `${readingCount} with at least one cached pair, ${clips.length} path(s) total across ` +
      `${VOICES.length} voice(s)${execute ? " [EXECUTE — will delete from Storage]" : " [dry run]"}`,
  );

  const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!execute) {
    const presence = await checkExistence(clips, { bucket, supaUrl, serviceKey });
    printReport(clips, presence);
    const confirmedCount = presence ? [...presence.values()].filter(Boolean).length : null;
    log(
      confirmedCount === null
        ? `\nDry run: ${clips.length} path(s) computed (existence not checked). Re-run with --execute to delete them.`
        : `\nDry run: ${clips.length} path(s) computed, ${confirmedCount} confirmed present in Storage right now. ` +
            "Re-run with --execute to delete them.",
    );
    return;
  }

  if (!bucket || !supaUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_VOICE_AUDIO_BUCKET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — cannot --execute.",
    );
    process.exit(1);
  }
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  printReport(clips, null);
  log(`\nDeleting ${clips.length} path(s) from Storage...`);
  const { removed, failed } = await deleteClips(clips, { bucket, supabase });
  log(`\nDone: ${removed} removed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

// Import-guarded (same reasoning as seed-voice-audio.mjs): a test imports
// `stalePitchClips`/`stalePitchItemsForReading` without wanting `main()` to
// also run and demand live Supabase env.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
