// Build the homophone-pair table pitch quiz questions draw from (SAK-128).
//
// WHAT THIS PRODUCES
// ===================
// src/data/generated/pitch-pairs.json — a flat array of
// [kebA, kebB, reading] triples: two DIFFERENT vocabulary words that are read
// exactly the same way but carry different verified pitch (箸/橋 both はし,
// one atamadaka one odaka). src/data/pitch-pairs.ts turns this into a
// keb → partner lookup; src/lib/pitch-quiz.ts is the one place that reads it
// to pick a pitch quiz question's PREFERRED mode ("pair") over the
// synthetic-wrong fallback.
//
// WHY THIS EXISTS SEPARATELY FROM pitch.mjs
// ==========================================
// pitch.mjs already answers "what is this word's downstep"; this answers a
// different question — "does the curriculum contain a genuine minimal pair
// for this word's reading" — which needs the WHOLE vocabulary grouped by
// reading, not a per-word lookup. Built at ingest time, like pitch.json
// itself, rather than scanning all 12,553 words on every quiz card.
//
// THE RULE: only real curriculum words, both with VERIFIED pitch, at
// AUDIBLY DIFFERENT downsteps
// ====================================================================
// A pair is only as good as its data. Two words are paired only when:
//   - they share the TAUGHT reading (mirrors pitch.mjs's own `taughtReading`
//     — the reading a word is actually taught with, which for a handful of
//     words differs from vocab.json's raw `reb`);
//   - BOTH already carry a verified downstep in pitch.json (never guessed —
//     same discipline pitch.mjs documents);
//   - their downsteps render as DIFFERENT high/low sequences IN ISOLATION —
//     not just different downstep NUMBERS. Heiban (0) and odaka (downstep
//     === the word's own mora count) produce the IDENTICAL isolated
//     high/low pattern (see src/lib/pitch.ts's pitchPatternForLength): the
//     drop only lands on a following particle that does not exist when a
//     word is synthesized alone, so the only field that would distinguish
//     them (.drop) is silent, and nothing downstream ever plays a pair with
//     a following particle attached. An ingest pass that only checked
//     "downstep !== downstep" shipped 21 such pairs anyway (橋/端, 花/鼻,
//     ...) — confirmed acoustically IDENTICAL, down to the sample, once
//     synthesized. `isAudiblyDistinct` below (a deliberate, dependency-free
//     duplicate of pitchPatternForLength's own high/low math — ingest
//     scripts import no TS/app modules, see RUN below) is what a learner can
//     actually hear, which is the only test that matters for a pitch quiz.
//
// A reading with three or more qualifying words (箸/橋/端, all はし) yields
// every pairwise combination that clears this bar, not just one — a quiz
// asking about 端 should be able to pair it with 箸 (audibly distinct), just
// not with 橋 (audibly identical to 端 in isolation, per the above).
//
// TWO MORE RULES, FROM A HUMAN LISTENING STUDY (not just the pitch math)
// =======================================================================
// The owner rated all 227 originally-generated pairs by ear (real audio,
// real voice, no hints) and the results revealed two further categories
// that pass isAudiblyDistinct's math but are still unreliable in practice:
//
//   - NO ATAMADAKA INVOLVED: every single heiban-vs-non-atamadaka pair
//     (28/28 — e.g. 先生/専制, 花/鼻, 橋/端) was rated "sounds the same" or
//     "barely different." All of them, without exception, only diverge on
//     the word's OWN LAST MORA (heiban stays high there; nakadaka/odaka has
//     already dropped) — a one-mora difference at the very end, with
//     nothing following it, turns out to be too faint to trust. Atamadaka
//     is the one pattern that instead diverges on mora 1 — the longest,
//     earliest, most durationally prominent syllable — and it held up: 98%
//     of atamadaka pairs at 2+ morae were confidently distinguished.
//   - A SINGLE MORA: even WITH atamadaka involved, a 1-mora reading (か, こ,
//     き, は, ち, ひ, ...) was unreliable 12 times out of 15 — there just
//     isn't enough duration in one mora, alone, for a pitch contrast to
//     register by ear, matching the floor src/lib/pitch.ts's
//     wrongDownstepFor already enforces for the synthetic wrong-mode
//     fallback (`moraCount < 2` → refuse). Pair mode never had that floor;
//     now it does.
//
// So a pair now needs THREE things, not one: differing downsteps, an
// audible (non-collapsing) difference, AND atamadaka (1) as one of the two
// downsteps, at 2+ morae. Everything that fails this still gets a fair
// shot at the synthetic "wrong" fallback, whose own downstep choice is
// already anchored to atamadaka for the same reason.
//
// RUN
// ===
//   node scripts/ingest/pitch-pairs.mjs
// Reads the already-generated vocab.json, word-senses.json and pitch.json —
// run scripts/ingest/pitch.mjs first if pitch.json is stale. No network
// access; pure local computation.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const GENDIR = resolve(REPO, "src/data/generated");

/** The reading a word is TAUGHT with — mirrors pitch.mjs's own helper of the
 * same name exactly, so a pair's reading always matches what the pitch mark
 * and the "Hear it" button render for that word. See pitch.mjs's comment on
 * why this can differ from vocab.json's raw `reb` (面 ships as おもて but is
 * taught めん). */
function taughtReading(row, senses) {
  const s = senses[row.keb];
  return s && s.length ? s[0].reb : row.reb;
}

const SMALL_KANA = new Set([
  "ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ",
  "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ", "ヮ",
]);

/** Mora count of a kana reading — a dependency-free duplicate of
 * src/lib/pitch.ts's moraeOf (see this file's RUN section for why ingest
 * scripts don't import app modules). Keep in sync if that logic ever
 * changes. */
function moraCount(reading) {
  let n = 0;
  for (const ch of reading) {
    if (SMALL_KANA.has(ch) && n > 0) continue;
    n++;
  }
  return n;
}

/** The isolated high/low sequence for `downstep` over `length` morae — a
 * dependency-free duplicate of src/lib/pitch.ts's pitchPatternForLength
 * (high-only; no caller here needs the `.drop` flag). Keep in sync if that
 * logic ever changes. */
function highLowPattern(length, downstep) {
  const out = [];
  for (let index = 0; index < length; index++) {
    const pos = index + 1;
    out.push(pos === 1 ? downstep === 1 : downstep === 0 || pos <= downstep);
  }
  return out;
}

/** Whether two words at the same reading actually SOUND different spoken in
 * isolation — not just whether their downstep numbers differ. See this
 * file's header comment: heiban and true-odaka (downstep === mora count)
 * collapse to the identical high/low sequence, and nothing plays a pair
 * with a following particle attached to reveal the difference. */
function isAudiblyDistinct(reading, downstepA, downstepB) {
  const length = moraCount(reading);
  const a = highLowPattern(length, downstepA);
  const b = highLowPattern(length, downstepB);
  return a.some((high, i) => high !== b[i]);
}

async function main() {
  const vocab = JSON.parse(await readFile(resolve(GENDIR, "vocab.json"), "utf8"));
  const senses = JSON.parse(
    await readFile(resolve(GENDIR, "word-senses.json"), "utf8"),
  );
  const pitch = JSON.parse(await readFile(resolve(GENDIR, "pitch.json"), "utf8"));

  // Group every word that has a VERIFIED pitch by its taught reading.
  const byReading = new Map(); // reading -> [{ keb, downstep }]
  for (const row of vocab) {
    const downstep = pitch[row.keb];
    if (downstep === undefined) continue; // no verified pitch, never guess
    const reading = taughtReading(row, senses);
    let group = byReading.get(reading);
    if (!group) byReading.set(reading, (group = []));
    group.push({ keb: row.keb, downstep });
  }

  const pairs = [];
  let readingsWithGroup = 0;
  let droppedIdentical = 0;
  let droppedNoAtamadaka = 0;
  let droppedOneMora = 0;
  for (const [reading, group] of byReading) {
    if (group.length < 2) continue;
    readingsWithGroup++;
    const length = moraCount(reading);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].downstep === group[j].downstep) continue; // not a minimal pair
        if (!isAudiblyDistinct(reading, group[i].downstep, group[j].downstep)) {
          droppedIdentical++;
          continue; // sounds identical in isolation
        }
        if (group[i].downstep !== 1 && group[j].downstep !== 1) {
          droppedNoAtamadaka++;
          continue; // human-rated: unreliable without atamadaka (see header)
        }
        if (length < 2) {
          droppedOneMora++;
          continue; // human-rated: unreliable at a single mora (see header)
        }
        // Stable, alphabetic order so the output (and any diff) is reproducible
        // regardless of vocab.json's row order.
        const [a, b] =
          group[i].keb <= group[j].keb
            ? [group[i].keb, group[j].keb]
            : [group[j].keb, group[i].keb];
        pairs.push([a, b, reading]);
      }
    }
  }

  pairs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : 1));

  const path = resolve(GENDIR, "pitch-pairs.json");
  await writeFile(path, `${JSON.stringify(pairs)}\n`);

  const wordsCovered = new Set(pairs.flatMap((p) => [p[0], p[1]])).size;
  process.stderr.write(
    [
      `Readings shared by 2+ verified-pitch words: ${readingsWithGroup}`,
      `Dropped for sounding identical in isolation (heiban/true-odaka collapse): ${droppedIdentical}`,
      `Dropped for no atamadaka involved (human-rated unreliable): ${droppedNoAtamadaka}`,
      `Dropped for a single mora (human-rated unreliable): ${droppedOneMora}`,
      `Homophone pitch pairs (differing, audible, atamadaka-anchored, 2+ morae): ${pairs.length}`,
      `Words covered by at least one pair: ${wordsCovered}`,
      `Wrote ${path}`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
