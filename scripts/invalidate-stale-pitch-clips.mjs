// Delete the Supabase Storage pitch clips that a fix elsewhere in the app
// left behind, silently wrong or silently orphaned.
//
// WHY THIS SCRIPT EXISTS AT ALL. seed-voice-audio.mjs's cache-skip logic
// (`loadExistingKeys`, see that file) means re-running the seed after a fix
// will NOT touch audio that is already in Storage: it sees an object at the
// expected path and leaves whatever is there in place. Whenever a fix changes
// what a given Storage object SHOULD contain — or makes an object nothing
// asks for any more — the only way to act on it is to delete the object
// first. That is all this script does: compute exactly which Storage objects
// a given fix invalidated, print them, and (with --execute) delete them so
// the next seed run regenerates whatever is still wanted.
//
// TARGETS. Each ticket that invalidates clips gets a TARGET (see `TARGETS`
// below): a named list of readings plus the exact (reading, downstep) pairs
// that ticket made stale. `--target=<id>` picks one; the default is
// `sak-217`, the original target this script was written for, so the SAK-217
// invocation keeps working verbatim.
//
//   sak-217 — SAK-215 fixed `synthesizeAtDownstep` (src/lib/tts-synth.ts) so
//     a NEW synthesis call for one of `CONFIRMED_BAD_READINGS` no longer
//     mis-pronounces its は/へ as わ/え. The audio already in Storage for
//     those readings is wrong AT ITS OWN PATH — same reading, same downstep,
//     wrong pronunciation — so every (reading, downstep) pair `pitchItems()`
//     enumerates for a confirmed-bad reading is stale: its CORRECT
//     downstep(s) via `wordPitch` AND its DISTRACTOR downstep(s) via
//     `wrongDownstepFor` (src/lib/pitch.ts, seeded per SAK-216), across every
//     voice in the roster (`VOICES`, src/lib/voice.ts). This target reuses
//     `pitchItems()` itself rather than re-deriving that enumeration, so
//     there is zero risk of its idea of "what got seeded" drifting from the
//     seed script's own.
//
//     A READING CAN MAP TO MORE THAN ONE DOWNSTEP. It is tempting to assume
//     the downstep only depends on the reading (kana), not on which kanji
//     spells it — it does NOT: pitch.json / `wordPitch` is keyed on the
//     WRITTEN form (`keb`), and different kanji sharing one reading can carry
//     different accents. Concretely, in this app's own VOCAB: はち is 八
//     "eight" (downstep 0) AND 鉢/蜂 "bowl"/"bee" (downstep 2). Deduping down
//     to one downstep per reading would silently miss half the stale clips.
//
//   sak-221 — SAK-221 (SAK-290 is this run) fixed scripts/ingest/pitch.mjs,
//     which had been looking a word up in Kanjium under vocab.json's raw
//     `reb` instead of the reading the word is actually taught with. That
//     shipped a WRONG DOWNSTEP VALUE in pitch.json for eleven words: eight
//     were corrected to a different value, three (仏/悪口/背) now hold no
//     value at all.
//
//     WHAT "STALE" MEANS WHEN A VALUE, NOT A SYNTHESIS, WAS WRONG. A pitch
//     clip's content is a pure function of (reading, downstep, voice): the
//     seed's `pitch` set synthesizes `synthesizeWordWav(raw.reading,
//     raw.downstep, speakerId)` and stores it at `pitchObjectPath(raw.reading,
//     raw.downstep, voiceId)`, and /api/pitch-tts does the same for its own
//     r/d/v query params. So — unlike SAK-215 — nothing in Storage holds
//     audio that is wrong FOR ITS OWN PATH. What the bad values did was make
//     the APP ask for the wrong path (the learner heard ひと at downstep 1
//     because pitch.json said 1), and that is fixed by the data change alone.
//     The Storage residue is the clips at the OLD values' paths: objects
//     `pitchItems()` no longer enumerates for any word, sitting in the bucket
//     with nothing to serve them to. Those are what this target deletes —
//     each word's previously-shipped downstep AND the distractor
//     `wrongDownstepFor` derived from that previously-shipped downstep, per
//     `SAK_221_PREVIOUS_PITCH`.
//
//     A word that transitioned from "had a value" to "no value" (仏/悪口/背)
//     is still covered: it had real clips seeded under its old value, and now
//     that pitch.json holds nothing for it, `pitchItems()` enumerates nothing
//     for it either — so those clips are orphaned outright, and no
//     replacement will be (or should be) generated for them. Deleting them is
//     the whole fix for those three.
//
//     SAFETY: this target never proposes a pair that `pitchItems()` still
//     enumerates today. Several of these words' old and new values happen to
//     swap correct/distractor (人 ひと was 1 correct + 0 distractor, is now 0
//     correct + 1 distractor — the same two paths, both still live and both
//     already holding correct audio for their own downstep). Deleting those
//     would throw away good clips to regenerate byte-identical ones. Any
//     old-value pair that is still enumerated is skipped and reported as
//     "retained" instead.
//
//   sak-219 — SAK-219 extended SAK-215/218's exact-match katakana fix past
//     the pitch-only path (`synthesizeAtDownstep`) to the GENERAL synthesis
//     paths: seed-voice-audio.mjs's `words`/`sentences`/`kana`/`yomi`/
//     `word-examples`/`grammar-derive` sets (its `synthesizeText`, seeded at
//     `voiceObjectPath`) AND `synthesizeSentenceWav` (src/lib/tts-synth.ts,
//     the live /api/tts fallback on a cache miss, gated there to an EXACT
//     whole-string match only). Same "audio wrong at its own path" shape
//     SAK-217 already solved for the pitch cache — every `voiceObjectPath`
//     clip for a `CONFIRMED_BAD_READINGS` entry, across every voice, whether
//     it got there via a bulk seed run or a live learner's cache-miss
//     request, was synthesized under the old, broken pronunciation and needs
//     deleting before a re-seed/re-request can fix it. Unlike sak-217/221,
//     there is no downstep dimension to enumerate — `voiceObjectPath` hashes
//     the raw text alone (see `sak219Items()`) — so this is the simplest of
//     the three targets: one clip per reading per voice, full stop.
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
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/invalidate-stale-pitch-clips.mjs --target=sak-221
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/invalidate-stale-pitch-clips.mjs --target=sak-219
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/invalidate-stale-pitch-clips.mjs --target=sak-219 --execute
//
// Then re-seed to regenerate what this deleted, correctly — the pitch set for
// sak-217/sak-221, or every general text set for sak-219 (the cache-skip
// logic these already rely on means a clip this script did NOT delete is
// left untouched, so a full re-run of `--set=all` is safe and correct here,
// not wasteful — see this file's own header on why cache-skip is exactly the
// reason a delete has to happen first):
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice-audio.mjs --set=pitch
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice-audio.mjs --set=all

import { appendFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { VOCAB } from "@/data/vocab";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { CONFIRMED_BAD_READINGS } from "@/lib/tts-synth";
import { pitchObjectPath, VOICES, voiceObjectPath } from "@/lib/voice";

import { loadExistingKeys, pitchItems } from "./seed-voice-audio.mjs";

/** The downstep pitch.json shipped for each SAK-221 word BEFORE that fix —
 * i.e. the value the already-seeded clips were generated under. Read straight
 * off the pre-fix pitch.json (git 349f0041, the commit SAK-221 landed on top
 * of); it is deliberately a frozen literal rather than something re-derived
 * from history at runtime, because the point of this map is to name a past
 * state of the data that no longer exists in the working tree. Every one of
 * these words now holds a DIFFERENT value (eight of them) or NO value at all
 * (仏/悪口/背) in src/data/generated/pitch.json. */
export const SAK_221_PREVIOUS_PITCH = Object.freeze({
  人: 1,
  入る: 0,
  開く: 2,
  下手: 0,
  空: 2,
  上下: 2,
  印: 1,
  節: 1,
  仏: 1,
  悪口: 2,
  背: 1,
});

const key = (reading, downstep) => `${reading}:${downstep}`;

/** SAK-217: every (reading, downstep) pair `pitchItems()` enumerates for a
 * confirmed-bad reading — the clips whose AUDIO is wrong at their own path. */
function sak217Items() {
  const bad = new Set(CONFIRMED_BAD_READINGS);
  return pitchItems().filter((item) => bad.has(item.reading));
}

/** SAK-219: one item per `CONFIRMED_BAD_READINGS` entry, no downstep — the
 * GENERAL (non-pitch) audio clips seed-voice-audio.mjs's `words`/`sentences`/
 * `kana`/`yomi`/`word-examples`/`grammar-derive` sets seed at `voiceObjectPath`
 * (a pure function of voiceId + raw text, no reading/downstep pair involved —
 * see voice.ts). Unlike `sak217Items()`, there is no "which downstep(s)" to
 * enumerate here: `voiceObjectPath` hashes the reading STRING alone, so each
 * confirmed-bad reading has exactly one general-path clip per voice,
 * regardless of how many VOCAB rows/kanji spellings share that reading. */
function sak219Items() {
  return CONFIRMED_BAD_READINGS.map((reading) => ({ reading }));
}

/** SAK-221: every (reading, downstep) pair that was seeded under a word's
 * PREVIOUS (wrong) pitch.json value and is no longer enumerated today — the
 * word's own old downstep plus the distractor `wrongDownstepFor` derived from
 * that old downstep, exactly as `pitchItems()` derived it at seed time.
 * Resolves each written form to its taught reading through VOCAB (`reb`), the
 * same keb→reb resolution `pitchItems()` performs, so the path this computes
 * is the path the seed actually wrote.
 *
 * Returns `{ items, retained }`: `retained` is the old-value pairs that are
 * STILL enumerated today (a word whose correct and distractor downsteps
 * merely swapped keeps both paths live), reported but never deleted. */
function sak221Partition() {
  const live = new Set(pitchItems().map((item) => key(item.reading, item.downstep)));
  const items = [];
  const retained = [];
  const seen = new Set();
  for (const [written, previousDownstep] of Object.entries(SAK_221_PREVIOUS_PITCH)) {
    for (const row of VOCAB) {
      if (row.keb !== written) continue;
      const distractor = wrongDownstepFor(previousDownstep, moraeOf(row.reb).length);
      const downsteps = distractor === null ? [previousDownstep] : [previousDownstep, distractor];
      for (const downstep of downsteps) {
        const pairKey = key(row.reb, downstep);
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        (live.has(pairKey) ? retained : items).push({ written, reading: row.reb, downstep });
      }
    }
  }
  return { items, retained };
}

/** SAK-221's pairs that this script deliberately leaves alone: old-value
 * paths that `pitchItems()` still enumerates, so the object there is a live,
 * correct clip. Exported for the report and for the test that pins the
 * "never delete a live path" guarantee. */
export function sak221RetainedItems() {
  return sak221Partition().retained;
}

/** A TARGET is one ticket's invalidation: `readings` fixes the report/delete
 * order and doubles as the gate (`stalePitchItemsForReading` returns nothing
 * for a reading outside it), `items()` yields the exact (reading, downstep)
 * pairs that ticket made stale, and `explain()` adds any target-specific
 * lines the run should print before the path list. */
export const SAK_217_TARGET = Object.freeze({
  id: "sak-217",
  summary: "SAK-215's mis-pronounced は/へ readings (CONFIRMED_BAD_READINGS)",
  readings: () => [...CONFIRMED_BAD_READINGS],
  items: sak217Items,
  explain: () => [`${CONFIRMED_BAD_READINGS.length} confirmed-bad reading(s) in CONFIRMED_BAD_READINGS.`],
  objectPath: (item, voiceId) => pitchObjectPath(item.reading, item.downstep, voiceId),
});

// SAK-219 extended SAK-215/218's exact-match katakana fix past the pitch-only
// path to seed-voice-audio.mjs's general `synthesizeText` AND
// synthesizeSentenceWav's live /api/tts fallback (src/lib/tts-synth.ts) — so
// any of the 34 CONFIRMED_BAD_READINGS already bulk-seeded under the general
// `words`/`sentences`/`kana`/`yomi`/`word-examples`/`grammar-derive` sets (or
// ever lazily synthesized live through /api/tts's cache-miss fallback) were
// seeded/cached under the OLD, broken pronunciation — the exact same
// "audio wrong at its own path" shape SAK-217 already solved for the pitch
// cache, just at `voiceObjectPath` instead of `pitchObjectPath`.
export const SAK_219_TARGET = Object.freeze({
  id: "sak-219",
  summary:
    "SAK-219's confirmed-bad readings, general (non-pitch) audio clips " +
    "(CONFIRMED_BAD_READINGS via voiceObjectPath — words/sentences/kana/yomi/word-examples/grammar-derive " +
    "sets, and any live /api/tts fallback clip cached under the same bare text)",
  readings: () => [...CONFIRMED_BAD_READINGS],
  items: sak219Items,
  explain: () => [
    `${CONFIRMED_BAD_READINGS.length} confirmed-bad reading(s) in CONFIRMED_BAD_READINGS.`,
    "One general voiceObjectPath clip per reading per voice (no downstep dimension — " +
      "voiceObjectPath hashes the raw text alone).",
  ],
  objectPath: (item, voiceId) => voiceObjectPath(voiceId, item.reading),
});

export const SAK_221_TARGET = Object.freeze({
  id: "sak-221",
  summary: "SAK-221's corrected/removed pitch.json values (clips seeded under the old value)",
  readings: () => {
    const { items } = sak221Partition();
    return [...new Set(items.map((item) => item.reading))];
  },
  items: () => sak221Partition().items,
  explain: () => {
    const { items, retained } = sak221Partition();
    const lines = [
      `${Object.keys(SAK_221_PREVIOUS_PITCH).length} word(s) whose pitch.json value SAK-221 corrected or removed.`,
      `${items.length} old-value (reading, downstep) pair(s) now orphaned — nothing enumerates them today.`,
    ];
    if (retained.length > 0) {
      lines.push(
        `${retained.length} old-value pair(s) RETAINED (still enumerated today, clip is correct for its own ` +
          `downstep, deleting it would only regenerate an identical file): ` +
          retained.map((item) => `${item.written} ${item.reading}:${item.downstep}`).join(", "),
      );
    }
    return lines;
  },
  objectPath: (item, voiceId) => pitchObjectPath(item.reading, item.downstep, voiceId),
});

export const TARGETS = Object.freeze({
  [SAK_217_TARGET.id]: SAK_217_TARGET,
  [SAK_221_TARGET.id]: SAK_221_TARGET,
  [SAK_219_TARGET.id]: SAK_219_TARGET,
});

/** `target.items()` / `target.readings()` walk all of VOCAB and pitchItems();
 * `stalePitchClips` asks for them once per reading. Memoized per target so a
 * 26-reading run doesn't rebuild the same static enumeration 26 times. */
const itemCache = new Map();
function targetItems(target) {
  if (!itemCache.has(target)) itemCache.set(target, target.items());
  return itemCache.get(target);
}
const readingCache = new Map();
function targetReadings(target) {
  if (!readingCache.has(target)) readingCache.set(target, target.readings());
  return readingCache.get(target);
}

/** Every (reading, downstep) pair `target` considers stale for ONE reading.
 * Returns `[]` for any reading the target doesn't cover — that's the whole
 * point of gating on the target's own reading list, rather than trusting the
 * caller to only ever pass an affected reading in. Defaults to SAK-217's
 * target so the original call shape keeps its original meaning. */
export function stalePitchItemsForReading(reading, target = SAK_217_TARGET) {
  if (!targetReadings(target).includes(reading)) return [];
  return targetItems(target).filter((item) => item.reading === reading);
}

/** Every Storage object path `target` considers stale: one row per (reading,
 * downstep, voice) for a pitch-shaped target, or one row per (reading, voice)
 * for a general-audio-shaped target (`downstep` is `null` there — see
 * `SAK_219_TARGET`'s own comment on why `voiceObjectPath` has no downstep
 * dimension) — in the target's reading order, then its item order, then
 * `VOICES` order — a stable, readable order for both the dry-run report and
 * the delete batches. Each target supplies its OWN `objectPath(item, voiceId)`
 * (pitchObjectPath vs. voiceObjectPath) rather than this function hard-coding
 * one path builder, so a general-audio target's clips land at the path the
 * general seed/live-fallback path actually reads/writes. Pure — no network
 * calls, safe to import and call from a test. */
export function stalePitchClips(target = SAK_217_TARGET) {
  return targetReadings(target).flatMap((reading) =>
    stalePitchItemsForReading(reading, target).flatMap((item) =>
      VOICES.map((voice) => ({
        reading: item.reading,
        downstep: item.downstep ?? null,
        voiceId: voice.id,
        path: target.objectPath(item, voice.id),
      })),
    ),
  );
}

/** Group a flat clip list into `reading -> downstep -> path[]`, preserving the
 * target's reading order — the shape the dry-run report and the execute-mode
 * log both print from, so the two modes read identically apart from the header
 * line and whether a delete actually ran. A general-audio target's clips all
 * carry `downstep: null` (see `stalePitchClips`), collapsing to one group per
 * reading — `printReport` below only prints a "downstep N:" sub-line when
 * there is a real downstep to show. */
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
  const targetId = typeof args.target === "string" ? args.target : SAK_217_TARGET.id;
  const target = TARGETS[targetId];
  if (!target) {
    console.error(`Unknown --target=${targetId}. Known targets: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }
  return { execute: !!args.execute, target };
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
    // A general-audio target (SAK-219) has no downstep dimension — every clip
    // in `byDownstep` groups under the single `null` key — so the header and
    // per-group line both drop the "downstep" language rather than printing
    // a meaningless "downstep null".
    const pitchShaped = [...byDownstep.keys()].some((d) => d !== null);
    log(
      pitchShaped
        ? `${reading} (${byDownstep.size} downstep pair(s), ${pathCount} path(s)):`
        : `${reading} (${pathCount} path(s)):`,
    );
    for (const [downstep, clipsForDownstep] of byDownstep) {
      if (downstep !== null) log(`  downstep ${downstep}:`);
      const indent = downstep !== null ? "    " : "  ";
      for (const clip of clipsForDownstep) {
        const mark = presence === null ? "" : presence.get(clip.path) ? " [exists]" : " [not found]";
        log(`${indent}${clip.path}${mark}`);
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
  const { execute, target } = parseArgs();
  const clips = stalePitchClips(target);
  const readingCount = new Set(clips.map((c) => c.reading)).size;

  log(
    `invalidate-stale-pitch-clips --target=${target.id}: ${target.summary}` +
      `${execute ? " [EXECUTE — will delete from Storage]" : " [dry run]"}`,
  );
  for (const line of target.explain()) log(`  ${line}`);
  log(
    `${readingCount} reading(s) with at least one stale pair, ${clips.length} path(s) total across ` +
      `${VOICES.length} voice(s).`,
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
