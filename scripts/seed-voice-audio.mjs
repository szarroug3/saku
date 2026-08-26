// Pre-generate voice clips into Storage for a whole content set, across every
// roster voice, ahead of anyone hitting /api/tts live. Same cache the live
// route writes to (voices/<voiceId>/<key>.opus) — this just warms it in bulk
// so the FIRST real request is already a cache hit, not a synthesis wait.
//
// COMPRESSED (SAK-101-ish, no ticket yet): every clip is encoded WAV→Opus at
// 24kbps via src/lib/audio-compress.ts (shared with the live routes) before
// upload — the full corpus × 6 voices as raw WAV projected to ~11GB, well
// past Supabase's free-tier storage; Opus at this bitrate is ~16x smaller
// with no audible loss for speech, verified by ear across the whole roster
// first. Needs `ffmpeg` on PATH.
//
// GENERIC ON PURPOSE: --set selects which text list to seed (see SETS below).
// Add a new set (e.g. words) by adding one entry — the run/upload/skip/limit
// machinery is shared. --set=all (the default) runs every defined set back to
// back in one process — kick it off once and walk away; it works through the
// whole backlog unattended, no babysitting between sets and no manual "did
// this finish" check against Supabase (the cache-skip below IS the resume
// mechanism: kill it, rerun the same command, and it picks up wherever it
// left off because already-uploaded clips are skipped automatically).
//
// RETRIES. A single flaky request (a dropped connection, a slow cold moment
// in the container) no longer counts as a permanent failure and no longer
// requires a human to notice and restart the whole run — each item gets up to
// RETRY_ATTEMPTS tries with a short backoff before it's logged as truly
// failed and the run moves on. A real failure doesn't stop the batch either;
// it's tallied and the script keeps going through the rest of the set(s), so
// one bad item can't block everything behind it.
//
// Talks to VOICEVOX directly (not through /api/tts), so it needs its own
// engine URL — defaults to the local Docker engine (http://localhost:50021),
// per Sam's standing preference for bulk/local generation over the deployed
// Cloud Run instance (that one exists for live traffic, not batch jobs, and
// batch jobs are exactly what the Cloud Run spend cap is guarding against).
// Override with VOICEVOX_ENGINE_URL if you really want to point elsewhere.
//
// CONCURRENCY. A local VOICEVOX container synthesizes one request at a time
// per worker thread; too much parallelism just queues inside the engine
// without going faster, and hammers Supabase Storage's upload API. --concurrency
// (default 4) caps in-flight (query+synthesis+upload) chains at once — same
// order of magnitude as the Cloud Run service's own concurrency=4 setting, so
// the same script scales to hitting Cloud Run later without changes.
//
// PROGRESS. Everything printed also goes to .logs/seed-voice-audio.log
// (appended, timestamped — survives the process exiting, so `tail -f` works
// from a second terminal even though this is a plain one-shot script, not a
// server). .logs/seed-voice-audio.progress.json is overwritten after every
// item with the current counts, so "how far along is it" is a single `cat`
// away without waiting for the log to scroll or the run to finish.
//
// Run:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice-audio.mjs --set=kana
//   node ... scripts/seed-voice-audio.mjs --set=kana --voices=aoyama,namine --concurrency=6 --dry-run
//
// --set=pitch (SAK-107) seeds the EXACT-pitch cache instead — /api/pitch-tts's
// pitchObjectPath, not the general voiceObjectPath the other sets share. IF
// .env.local's VOICEVOX_ENGINE_URL points at Cloud Run (as it does whenever
// prod's engine is configured there), --env-file=.env.local makes THAT the
// resolved default, not this script's own http://localhost:50021 fallback —
// export an explicit override first to force the local container regardless
// of what .env.local says:
//   export VOICEVOX_ENGINE_URL=http://localhost:50021
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-voice-audio.mjs --set=pitch
//
// Check in on it from another terminal:
//   tail -f .logs/seed-voice-audio.log
//   cat .logs/seed-voice-audio.progress.json

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { CHAR_INDEX } from "@/data/characters";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { RECIPES } from "@/data/grammar/recipes";
import { READINGS } from "@/data/kanji";
import { wordPitch } from "@/data/pitch";
import { VOCAB } from "@/data/vocab";
import { AUDIO_CONTENT_TYPE, encodeOpus } from "@/lib/audio-compress";
import { synthesizeWordWav } from "@/lib/tts-synth";
import { pitchObjectPath, VOICE_PREVIEW, VOICES, voiceObjectPath } from "@/lib/voice";
import grammarCorpus from "@/data/generated/grammar-corpus.json" with { type: "json" };
import wordExamples from "@/data/generated/word-examples.json" with { type: "json" };

/** A "text" set: every item is just a string to speak verbatim, cached at
 * `voiceObjectPath`, synthesized with no pitch correction at all (that's
 * `synthesizeSentenceWav`'s job at live-request time, not this bulk seed's —
 * see the header comment). Wraps a bare string-list function into the shape
 * `SETS` needs so every text set doesn't repeat the same four lines. */
function textSet(getTexts) {
  return {
    items: () => [...new Set(getTexts())].map((text) => ({ text })),
    path: (raw, voiceId) => voiceObjectPath(voiceId, raw.text),
    label: (raw) => raw.text,
    synth: (raw, base, speakerId) => synthesizeText(base, speakerId, raw.text),
  };
}

/** Every (reading, downstep) pair the EXACT-pitch cache (`pitchObjectPath`,
 * /api/pitch-tts) can ever be asked for — SAK-107. Two sources:
 *
 *   1. Every VOCAB row with a verified Kanjium accent. pitch.json (and
 *      `wordPitch`) is keyed on the WRITTEN form (`keb`, which may be kanji),
 *      not the kana the app actually speaks — the word page resolves a hit
 *      to its own `reb` before ever calling the pitch route (see
 *      character-entry-view.tsx's `pitchReading` / `HearButton glyph={w.reading}`).
 *      Seeding pitch.json's keys directly would be wrong for any kanji-written
 *      word: VOICEVOX would read the kanji using ITS OWN guessed reading,
 *      which can disagree with the word's taught reb in mora count, so this
 *      walks VOCAB and reproduces that same keb→reb resolution rather than
 *      trusting pitch.json's keys as if they were kana.
 *   2. The settings-page voice-preview reading (VOICE_PREVIEW) — fixed
 *      せんせい/downstep 3, confirmed NOT itself a pitch.json entry.
 *
 * Deduped by (reading, downstep): two different kanji spellings of the same
 * reading and accent (a true homophone pair) synthesize identically and must
 * not be seeded twice. */
function pitchItems() {
  const seen = new Set();
  const items = [];
  function add(reading, downstep) {
    const key = `${reading}:${downstep}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ reading, downstep });
  }
  for (const row of VOCAB) {
    const downstep = wordPitch(row.keb);
    if (downstep !== null) add(row.reb, downstep);
  }
  add(VOICE_PREVIEW.reading, VOICE_PREVIEW.downstep);
  return items;
}

/** SAK-182: every distinct string a grammar pattern page's DERIVE table (the
 * VERB/FORM/PATTERN build table — e.g. 〜ている showing たべる → たべて →
 * たべている) puts a Hear button on, across every auto-generated recipe page.
 *
 * `deriveRows`/`EXAMPLES.verb` inside auto-page.ts build that table entirely
 * at RENDER time (conjugating live via the conjugation engine) — nothing
 * about the Form or Pattern column is persisted anywhere else this script
 * could enumerate it from, unlike `words` (VOCAB.reb) or `sentences`
 * (grammarCorpus). Rather than re-deriving the conjugation logic a second
 * time here (and risking it drifting from what the page actually renders),
 * this calls the SAME `autoPatternPage` the page component calls and reads
 * the literal strings back off its own output — read-only reuse, no changes
 * to auto-page.ts itself.
 *
 * Walks exactly the two fields phase-intro-view.tsx's `IntroDeriveTable`
 * puts a `<Say>` on (see its `r.form`/`r.result` — `verb` is the dictionary
 * form already covered by the `words` set above, so it's not repeated here):
 *   - `IntroDeriveRow.form` — the FORM column (たべて), when the pattern
 *     attaches to a conjugated form rather than the word unchanged. Present
 *     on both the flat `deriveRules` shape and every `deriveTables[].rules`
 *     section (a pattern that works on more than one host, e.g. verb + い-
 *     adjective, gets one derive table per host).
 *   - `IntroDeriveRow.result` — the finished PATTERN column (たべている),
 *     unconditional whenever a derive row exists at all.
 *
 * Deliberately NOT `buildRules`/`buildTables` (the standalone Ending·Change
 * tables te-form/volitional/potential/passive/causative/ば/たら pages show):
 * out of this ticket's measured scope (111/114 recipes, 23 form + 155
 * pattern words via deriveRules/deriveTables only — matches exactly what
 * this walks). `textSet`'s own `[...new Set(...)]` handles the ~19 strings
 * that turn up as both a Form value in one recipe and a Pattern value in
 * another, same as any other set's internal dedup. */
function grammarDeriveTexts() {
  const texts = [];
  function collect(rows) {
    for (const row of rows) {
      if (row.form) texts.push(row.form);
      texts.push(row.result);
    }
  }
  for (const r of RECIPES) {
    const page = autoPatternPage(r);
    if (page.deriveRules) collect(page.deriveRules);
    for (const table of page.deriveTables ?? []) collect(table.rules);
  }
  return texts;
}

/** Each set describes how to enumerate, cache-path, label, and synthesize its
 * own items — the run/upload/skip/limit machinery below (`runPool`,
 * `seedOneWithRetry`) is generic over all four, so a new set (a new content
 * shape, not just a new text list) is one entry here, not a fork of the
 * script. Order matters only for what shows up first in the log — resume
 * behavior (the cache-skip check) doesn't care what order sets run in. */
const SETS = {
  kana: textSet(() => Object.keys(CHAR_INDEX)),
  // On'yomi/kun'yomi readings — the same `r.base` string HearButton speaks
  // next to a kanji's reading rows on the Library page (character-entry-view).
  yomi: textSet(() => READINGS.map((r) => r.base)),
  // Every word's reading — the same `w.reading`/`v.reb` string HearButton
  // speaks on a word's Library entry page.
  words: textSet(() => VOCAB.map((r) => r.reb)),
  // The full grammar corpus (Tatoeba sentences, CC BY 2.0 FR) — every
  // sentence a grammar pattern page or a quiz can show.
  sentences: textSet(() => grammarCorpus.map((r) => r.jp)),
  // The word-page "in a sentence" examples — a curated subset of the same
  // Tatoeba pool. Overlapping text with `sentences` is normal and harmless:
  // it hashes to the same Storage path, so the second sighting is just a
  // cache hit, not wasted synthesis.
  "word-examples": textSet(() => Object.values(wordExamples).map((row) => row[1])),
  // SAK-182: the grammar pattern pages' derive table — the Form and Pattern
  // columns of the VERB/FORM/PATTERN build table shown on every auto-generated
  // recipe page (111 of 114 in RECIPES), e.g. 〜ている's たべて/たべている. See
  // grammarDeriveTexts' own comment for why this reuses autoPatternPage
  // instead of re-deriving the conjugations.
  "grammar-derive": textSet(grammarDeriveTexts),
  // SAK-107: the EXACT-pitch cache `/api/pitch-tts` reads/writes — the
  // settings voice-picker preview and every Library word's pitch "hear it"
  // button. Different item shape (reading+downstep, not free text), different
  // cache path (pitchObjectPath), different synth (the pitch-locked
  // synthesizeWordWav, not the plain audio_query→synthesis pair `textSet`
  // items use) — that's exactly what `path`/`label`/`synth` exist to isolate.
  pitch: {
    items: pitchItems,
    path: (raw, voiceId) => pitchObjectPath(raw.reading, raw.downstep, voiceId),
    label: (raw) => `${raw.reading}:${raw.downstep}`,
    synth: (raw, base, speakerId) => synthesizeWordWav(raw.reading, raw.downstep, speakerId),
  },
};

/** Failed items get this many total attempts (1 try + retries) before being
 * counted as a real failure. Backoff is linear, not exponential — these are
 * short local requests, not a remote API with real rate limits to respect. */
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    }),
  );
  const setNames = args.set && args.set !== "all" ? [args.set] : Object.keys(SETS);
  const unknownSets = setNames.filter((s) => !SETS[s]);
  if (unknownSets.length) {
    console.error(`Unknown set(s): ${unknownSets.join(", ")}. Known: ${Object.keys(SETS).join(", ")}`);
    process.exit(1);
  }
  const voiceIds = args.voices ? String(args.voices).split(",") : VOICES.map((v) => v.id);
  const unknown = voiceIds.filter((id) => !VOICES.some((v) => v.id === id));
  if (unknown.length) {
    console.error(`Unknown voice id(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  return {
    setNames,
    voiceIds,
    concurrency: Number(args.concurrency ?? 4),
    dryRun: !!args["dry-run"],
    // Caps each set's item list to its first N (pre-dedup order) — not for
    // production runs, but so a slice of a new/changed set can be proven
    // against real Storage (a real synth + upload + list-back) without
    // committing to the full corpus first. Omit for a real run.
    limit: args.limit ? Number(args.limit) : undefined,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LOG_DIR = new URL("../.logs/", import.meta.url);
const LOG_FILE = new URL("seed-voice-audio.log", LOG_DIR);
const PROGRESS_FILE = new URL("seed-voice-audio.progress.json", LOG_DIR);
const STATUS_FILE = new URL("seed-voice-audio.status.txt", LOG_DIR);
mkdirSync(LOG_DIR, { recursive: true });

/** console.info/error AND appends to the log file, so progress survives past
 * whatever terminal/pipe launched this process and can be tailed live. */
function log(message) {
  console.info(message);
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}

function writeProgress(state) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

/** Plain-text snapshot, OVERWRITTEN (not appended) on every update — one
 * "all x/y" line plus one per set, in set order. Built for `watch -n 2 cat
 * .logs/seed-voice-audio.status.txt` (or an equivalent while/sleep loop):
 * every read shows the CURRENT totals, not a scrolling history you'd have to
 * skim to the bottom of. */
function writeStatus(overall, bySet) {
  const lines = [`all ${overall.done}/${overall.total}`];
  for (const [setName, s] of Object.entries(bySet)) lines.push(`${setName} ${s.done}/${s.total}`);
  writeFileSync(STATUS_FILE, lines.join("\n") + "\n");
}

async function audioQuery(base, text, speakerId) {
  const url = `${base}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`audio_query ${res.status} ${res.statusText}`);
  return res.json();
}

async function synthesize(base, speakerId, query) {
  const res = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`synthesis ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}

/** Plain text → WAV, no pitch correction — what every `textSet` item uses.
 * (The pitch set instead calls `synthesizeWordWav` from tts-synth.ts, which
 * hand-edits the query's mora pitches to an exact downstep before synthesis —
 * see that module's header comment for why the two paths don't share this.) */
async function synthesizeText(base, speakerId, text) {
  const query = await audioQuery(base, text, speakerId);
  return synthesize(base, speakerId, query);
}

/** Runs `tasks` with at most `limit` in flight at once — no dependency, just
 * a worker pool over a shared cursor. `onProgress` fires after every item so
 * the caller can log/persist state without runPool knowing about sets. */
async function runPool(items, limit, worker, onProgress) {
  let cursor = 0;
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      const result = await worker(item, i).catch((err) => {
        log(`  ✗ ${item.voiceId}:${item.label}: ${err.message}`);
        return "failed";
      });
      if (result === "ok") ok++;
      else if (result === "skipped") skipped++;
      else failed++;
      onProgress?.({ done: ok + skipped + failed, total: items.length, ok, skipped, failed });
      if ((ok + skipped + failed) % 25 === 0) {
        log(`  ${ok + skipped + failed}/${items.length} (${ok} generated, ${skipped} cached, ${failed} failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return { ok, skipped, failed };
}

/** One Storage `list()` call per PAGE, not per item. Every clip for a voice —
 * kana, words, sentences, everything — lives flat in `voices/<voiceId>/`
 * (see voice.ts), so listing that one folder once up front, fully paginated,
 * tells us every clip already cached across EVERY set in a single pass.
 * Checking existence per item instead (a `.list({ search })` call per clip)
 * is what made a ~160k-item dry run take hours before this even reaches a
 * synthesis call: pure network round-trip cost, no synthesis involved. */
async function loadExistingKeys(supabase, bucket, voiceIds) {
  const PAGE = 1000;
  const byVoice = new Map();
  for (const voiceId of voiceIds) {
    const folder = `voices/${voiceId}`;
    const names = new Set();
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: PAGE, offset });
      if (error) throw new Error(`listing ${folder}: ${error.message}`);
      for (const f of data ?? []) names.add(f.name);
      if (!data || data.length < PAGE) break;
    }
    byVoice.set(voiceId, names);
    log(`  ${voiceId}: ${names.size} clip(s) already cached`);
  }
  return byVoice;
}

/** One item, with retries. Only a real, repeated failure reaches the caller —
 * a transient hiccup on attempt 1 is invisible in the final tally. `setDef`
 * supplies the per-set `path`/`synth` — this function itself knows nothing
 * about text vs. pitch. */
async function seedOneWithRetry(
  { voiceId, raw },
  { setDef, base, bucket, supabase, speakerOf, dryRun, existingKeys },
) {
  const path = setDef.path(raw, voiceId);
  const file = path.slice(path.lastIndexOf("/") + 1);

  if (existingKeys.get(voiceId)?.has(file)) return "skipped";
  if (dryRun) return "ok";

  const speakerId = speakerOf[voiceId];
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const wavBytes = await setDef.synth(raw, base, speakerId);
      const opusBytes = await encodeOpus(wavBytes);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, opusBytes, { contentType: AUDIO_CONTENT_TYPE, upsert: true });
      if (error) throw error;
      // The same item can turn up in more than one set (a grammar-corpus
      // sentence that's also someone's word-example) — record it locally so
      // the second sighting skips instantly instead of re-synthesizing.
      existingKeys.get(voiceId)?.add(file);
      return "ok";
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  const { setNames, voiceIds, concurrency, dryRun, limit } = parseArgs();

  const base = (process.env.VOICEVOX_ENGINE_URL ?? "http://localhost:50021").replace(/\/$/, "");
  // tts-synth.ts (the pitch set's synth path — synthesizeWordWav) reads
  // VOICEVOX_ENGINE_URL from process.env itself rather than taking `base` as
  // a parameter; without this, an unset env var would resolve to this
  // script's "http://localhost:50021" default for the text sets above but
  // throw "VOICEVOX not configured" for the pitch set. Writing the resolved
  // value back keeps both paths pointed at the exact same engine.
  process.env.VOICEVOX_ENGINE_URL = base;
  const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SUPABASE_SECRET_KEY (sb_secret_...) once set, else the legacy
  // service_role key — both work simultaneously during Supabase's
  // publishable/secret key migration, see src/lib/supabase/secret-key.ts.
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!bucket || !supaUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_VOICE_AUDIO_BUCKET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const speakerOf = Object.fromEntries(VOICES.map((v) => [v.id, v.speakerId]));

  // Build every set's item list up front so the overall total (X/Y across
  // EVERYTHING, not just the current set) is known from the first progress
  // line, not guessed at as sets complete.
  const bySet = setNames.map((setName) => {
    const setDef = SETS[setName];
    const rawItems = limit ? setDef.items().slice(0, limit) : setDef.items();
    const items = voiceIds.flatMap((voiceId) =>
      rawItems.map((raw) => ({ voiceId, raw, label: setDef.label(raw) })),
    );
    return { setName, setDef, items };
  });
  const grandTotal = bySet.reduce((sum, s) => sum + s.items.length, 0);

  log(
    `seed-voice-audio: sets=${setNames.join(",")} × ${voiceIds.length} voice(s) = ${grandTotal} clips total, engine=${base}, concurrency=${concurrency}${dryRun ? " [dry run]" : ""}${limit ? ` [limit=${limit}/set]` : ""}`,
  );

  log("Listing existing clips per voice (one pass, not per item)...");
  const existingKeys = await loadExistingKeys(supabase, bucket, voiceIds);

  // Per-set tallies, keyed by name, updated live as each set runs — this is
  // exactly what's persisted to the progress file, so `cat`ing it mid-run
  // shows every set's state, not just the one currently in flight.
  const setState = Object.fromEntries(
    bySet.map(({ setName, items }) => [setName, { done: 0, total: items.length, ok: 0, skipped: 0, failed: 0 }]),
  );
  const overall = { done: 0, total: grandTotal, ok: 0, skipped: 0, failed: 0 };
  writeStatus(overall, setState);

  for (const { setName, setDef, items } of bySet) {
    log(`\n-- ${setName}: ${items.length} clips --`);
    const state = setState[setName];

    const { ok, skipped, failed } = await runPool(
      items,
      concurrency,
      (item) => seedOneWithRetry(item, { setDef, base, bucket, supabase, speakerOf, dryRun, existingKeys }),
      (progress) => {
        state.done = progress.done;
        state.ok = progress.ok;
        state.skipped = progress.skipped;
        state.failed = progress.failed;
        overall.done = Object.values(setState).reduce((sum, s) => sum + s.done, 0);
        overall.ok = Object.values(setState).reduce((sum, s) => sum + s.ok, 0);
        overall.skipped = Object.values(setState).reduce((sum, s) => sum + s.skipped, 0);
        overall.failed = Object.values(setState).reduce((sum, s) => sum + s.failed, 0);
        writeProgress({ currentSet: setName, overall, bySet: setState });
        writeStatus(overall, setState);
      },
    );
    log(`${setName} done: ${ok} generated, ${skipped} already cached, ${failed} failed (after retries).`);
  }

  log(
    `\nAll sets done: ${overall.done}/${overall.total} — ${overall.ok} generated, ${overall.skipped} already cached, ${overall.failed} failed.`,
  );
  writeStatus(overall, setState);
  writeProgress({ currentSet: null, overall, bySet: setState });
  // Non-zero exit only on real (post-retry) failures, so a wrapping cron/loop
  // can tell "clean run" from "needs attention" without parsing the log.
  if (overall.failed > 0) process.exit(1);
}

main();
