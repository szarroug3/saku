// Every string the Sky can ask a voice for, held against what the seed script
// actually seeds (SAK-402).
//
// WHY THIS EXISTS
// ===============
// scripts/seed-voice-audio.mjs pre-generates a clip for every item of every
// set, so a learner's first tap is a cache hit rather than a synthesis wait.
// Its sets are hand-written lists, and the app keeps growing: SAK-216 and
// SAK-244 were both "a whole shape of string nobody had noticed was live",
// found by hand, months after the button that spoke it shipped. This script
// is the noticing, done by the machine: it walks the Sky's own teaching code
// (src/app/(sky)/teach.ts) and its own hear buttons, collects every string and
// every (reading, downstep) pair those buttons can ask for, and reports what
// the seed script's SETS do not cover. Zero uncovered is the whole point; a
// number here is a set waiting to be added over there.
//
// WHAT IT WALKS, AND WHY THAT IS THE WHOLE SURFACE
// ================================================
// All speech in the Sky goes through ONE button, src/app/(sky)/hear-button.tsx,
// and only two components mount it: LessonCard (the star's card, shown on the
// Atlas, in a lesson, and as a quiz's reveal) and SkyQuiz (the listening card's
// big play button and a pitch card's two clips). So the surface is exactly:
//
//   LessonCard  the head glyph for a kana, word, counter or keigo set; each
//               on'yomi and kun'yomi row; a kana's mnemonic example word; each
//               of a verb pair's or a keigo set's forms; each of a word's
//               other readings. Any of these with a known downstep is an
//               EXACT-pitch clip (/api/pitch-tts), the rest are plain text
//               (/api/tts).
//   SkyQuiz     the listening card plays a kana's glyph or the exact reading a
//               word card asks about, and a pitch card plays the word's
//               reading twice, at its own downstep and at the other one (a
//               homophone partner's, or the invented mispitch).
//
// Every one of those reads its string off `teachFor`, so this calls the same
// function on the same items the app builds (offerPick, over every library
// entry), rather than restating what each card shows. A card that starts
// speaking something new is caught here without anyone editing this file.
//
// Run (the loaders teach Node the `@/` alias and let a script import the
// Sky's server modules, see scripts/lib/server-only-shim.mjs):
//   node --import ./src/lib/conjugate/test-hooks.mjs \
//        --import ./scripts/lib/server-only-shim.mjs scripts/list-speakable.mjs
//
// With Supabase credentials it also says what is actually missing from the
// bucket right now, per set and per voice, using the seed script's own listing
// (loadExistingKeys), so the two can never disagree about what "cached" means:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs \
//        --import ./scripts/lib/server-only-shim.mjs scripts/list-speakable.mjs --storage
//
// And `--list=<set>` prints one set's items, one per line, for eyeballing or
// piping. Read-only from end to end: it synthesizes nothing and uploads
// nothing, so it is safe to run against production credentials at any time.

import { createClient } from "@supabase/supabase-js";

import { emptyHistory } from "@/lib/history-ops";
import { LIB_ENTRIES_BY_KIND } from "@/lib/library/entries";
import { readingUnits, vocabRow, VOCAB } from "@/data/vocab";
import { VOICES } from "@/lib/voice";

import { offerPicker, TSU_RULE } from "../src/app/(sky)/observatory.ts";
import { teachFor } from "../src/app/(sky)/teach.ts";
import { loadExistingKeys, SETS } from "./seed-voice-audio.mjs";

/** A spoken string, with where in the Sky it is spoken. `downstep` set means
 * the EXACT-pitch cache (pitchObjectPath), unset means the general one. */
function collector() {
  const found = new Map();
  return {
    found,
    /** One hear button's arguments, exactly as the component passes them. */
    say(glyph, downstep, source) {
      if (!glyph) return;
      const key = typeof downstep === "number" ? `${glyph}:${downstep}` : glyph;
      const kind = typeof downstep === "number" ? "pitch" : "text";
      const have = found.get(`${kind} ${key}`);
      if (have) have.sources.add(source);
      else found.set(`${kind} ${key}`, { kind, key, sources: new Set([source]) });
    },
  };
}

/** Every hear button one card puts on one item, in the order LessonCard
 * renders them. `scope` is the reading a lesson narrowed the card to (a word
 * read more than one way gets one card per reading). */
function walkCard(item, teach, sink, scoped) {
  const where = scoped ? `${item.kind} card (a reading of its own)` : `${item.kind} card`;
  const reading = teach?.reading ?? item.reading;
  // the head: a kana speaks its glyph, everything else its reading; a pattern
  // with a 〜 in it has nothing to say on its own
  if ((item.kind === "kana" || item.kind === "word" || item.kind === "counter" || item.kind === "keigo") && !item.glyph.includes("〜")) {
    sink.say(item.kind === "kana" ? item.glyph : (reading ?? item.glyph), teach?.pitch ?? undefined, `${where} head`);
  }
  for (const r of teach?.readings ?? []) sink.say(r.reading, undefined, "kanji card reading row");
  if (teach?.exampleWord) sink.say(teach.exampleWord.word, undefined, "mnemonic example word");
  for (const f of teach?.forms ?? []) sink.say(f.reading ?? f.word, f.pitch ?? undefined, `${item.kind} card form`);
  // the other-readings fold only opens when there is more than one
  const pronunciations = teach?.pronunciations ?? [];
  if (pronunciations.length > 1) for (const r of pronunciations) sink.say(r.reading, r.pitch ?? undefined, "word card other reading");
}

/** Everything the Sky can speak, from the Sky's own code. */
export function speakable() {
  const sink = collector();
  const picker = offerPicker(emptyHistory(), 0);
  const ids = [TSU_RULE, ...[...LIB_ENTRIES_BY_KIND.values()].flatMap((entries) => entries.map((e) => e.id))];
  let items = 0;
  for (const id of ids) {
    const item = picker.offerPick(id);
    if (!item) continue;
    items++;
    walkCard(item, teachFor(item), sink, false);
    // a word's lesson card is narrowed to the reading being taught, and the
    // head then speaks THAT reading at the word's own downstep
    if (item.kind === "word") {
      const row = vocabRow(item.glyph);
      for (const unit of row ? readingUnits(row) : []) walkCard(item, teachFor(item, { reading: unit.reb }), sink, true);
    }
  }
  // the quiz's listening card: a kana's glyph (already collected by its card)
  // or the exact reading the word card asks about, which is any reading the
  // word is taught under
  for (const row of VOCAB) {
    sink.say(row.reb, undefined, "quiz listening card");
    for (const unit of readingUnits(row)) sink.say(unit.reb, undefined, "quiz listening card");
  }
  return { items, found: [...sink.found.values()] };
}

/** What one set seeds, as the same keys `speakable` reports. */
function seededKeys() {
  const keys = new Map();
  for (const [name, def] of Object.entries(SETS)) {
    const set = new Set();
    for (const raw of def.items()) set.add(raw.text !== undefined ? `text ${raw.text}` : `pitch ${raw.reading}:${raw.downstep}`);
    keys.set(name, set);
  }
  return keys;
}

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }));
  if (args.list && !SETS[args.list]) {
    console.error(`Unknown set: ${args.list}. Known: ${Object.keys(SETS).join(", ")}`);
    process.exit(1);
  }
  return { list: args.list, storage: !!args.storage };
}

/** What Storage is missing right now, per set and per voice: the seed script's
 * own paths, checked against the seed script's own listing, so this can only
 * ever report what a run of it would actually do. */
async function reportStorage(voiceIds) {
  const bucket = process.env.NEXT_PUBLIC_VOICE_AUDIO_BUCKET;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!bucket || !supaUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_VOICE_AUDIO_BUCKET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  console.info(`\nStorage (${bucket}), listing every voice's folder once:`);
  const existing = await loadExistingKeys(supabase, bucket, voiceIds);
  console.info("\nMissing, per set and per voice:");
  const totals = { total: 0, missing: 0 };
  for (const [name, def] of Object.entries(SETS)) {
    const raws = def.items();
    const perVoice = voiceIds.map((voiceId) => {
      const have = existing.get(voiceId) ?? new Set();
      let missing = 0;
      for (const raw of raws) {
        const path = def.path(raw, voiceId);
        if (!have.has(path.slice(path.lastIndexOf("/") + 1))) missing++;
      }
      totals.total += raws.length;
      totals.missing += missing;
      return `${voiceId} ${missing}`;
    });
    const setMissing = perVoice.reduce((sum, line) => sum + Number(line.split(" ")[1]), 0);
    console.info(`  ${name}: ${setMissing} of ${raws.length * voiceIds.length} (${perVoice.join(", ")})`);
  }
  console.info(`  all sets: ${totals.missing} of ${totals.total} clips missing`);
}

async function main() {
  const { list, storage } = parseArgs();
  const voiceIds = VOICES.map((v) => v.id);

  if (list) {
    for (const raw of SETS[list].items()) console.info(SETS[list].label(raw));
    return;
  }

  console.info(`The seed script's sets, over ${voiceIds.length} voices (${voiceIds.join(", ")}):`);
  let total = 0;
  for (const [name, def] of Object.entries(SETS)) {
    const count = def.items().length;
    total += count;
    console.info(`  ${name}: ${count} items, ${count * voiceIds.length} clips`);
  }
  console.info(`  all sets: ${total} items, ${total * voiceIds.length} clips`);

  const { items, found } = speakable();
  const texts = found.filter((f) => f.kind === "text").length;
  console.info(`\nThe Sky, walked: ${items} items, ${texts} strings and ${found.length - texts} exact-pitch clips it can ask for.`);

  const seeded = seededKeys();
  const covered = new Set([...seeded.values()].flatMap((set) => [...set]));
  const uncovered = found.filter((f) => !covered.has(`${f.kind} ${f.key}`));
  if (uncovered.length) {
    console.info(`\n${uncovered.length} uncovered, by where it is spoken:`);
    const bySource = new Map();
    for (const f of uncovered) for (const source of f.sources) bySource.set(`${f.kind} · ${source}`, [...(bySource.get(`${f.kind} · ${source}`) ?? []), f.key]);
    for (const [source, keys] of [...bySource].sort()) {
      console.info(`  ${source}: ${keys.length}`);
      console.info(`    ${keys.slice(0, 8).join(" ")}${keys.length > 8 ? " ..." : ""}`);
    }
    process.exitCode = 1;
  } else {
    console.info("Everything it can say is in a set. Nothing uncovered.");
  }

  if (storage) await reportStorage(voiceIds);
}

await main();
