// BUILD THE CURATED ENGLISH SYNONYM POOL — src/data/generated/en-synonyms.json.
//
// WHY (SAK-53)
// ============
// English meaning-matching (src/lib/engine/en-match.ts) is deliberately
// exact-plus-typo-tolerant, never a general synonym/embedding model — a
// benchmark run for this ticket's spike showed a phrase-level fuzzy matcher
// accepts ANTONYMS, which is worse than the status quo of rejecting a valid
// paraphrase. But the status quo has real false negatives: ない's own gloss is
// "nonexistent, not being (there)", and typing "doesn't exist" was marked
// wrong.
//
// The approved fix is an ADDITIONAL exact-match-only pool: a curated map from
// a single gloss word to alternate phrasings that mean the same thing, checked
// by en-match.ts's `synonymCandidates` and NEVER run through its typo layer —
// so one bad entry degrades to "this one wrong string is also accepted",
// never compounds into a worse false positive. Hand-curating that map for
// thousands of glosses is not practical, so this script generates the bulk of
// it from the Datamuse API (https://api.datamuse.com, free, no auth key) and
// applies precision-first filtering; a human (or in this case, an agent) then
// spot-checks a sample rather than reviewing every entry — see the ticket for
// that review pass. It is NOT run as part of `prebuild`: it is a slow, network
// dependent, occasionally-rerun data refresh, the same category as
// scripts/ingest/*.mjs.
//
// WHAT GETS QUERIED
// ==================
// Every fact in the app (`ALL_FACTS`/`factInfo` from src/lib/facts.ts — vocab,
// kanji, radicals, grammar, keigo, counters, everything `matchesEnglish` ever
// compares against) contributes its `.answers`. Each English answer is sliced
// into the SAME fragments en-match.ts's layer 2 already trusts — the whole
// gloss, its paren-stripped form, and each comma-separated piece — and each
// fragment is reduced to a query key with `synonymKeyOf` (imported from
// en-match.ts, not reimplemented, so the two can never drift about what
// reduces cleanly). A gloss that is already a bare word ("teacher") or a bare
// infinitive ("to eat") keys straight in; anything left with a space, a digit,
// or other punctuation is skipped rather than guessed at — Datamuse's
// `ml=<phrase>` on a MULTI-WORD QUERY was verified (by hand, see the ticket)
// to be mostly co-occurrence noise, not real synonymy: `ml=doesn't+exist`
// puts one real hit ("nonexistent") at rank 0, tags a SECOND result
// `results_type:backfill_gloss` (Datamuse's own "ran out of real data"
// marker), and everything after that is a flat, indistinguishable noise
// floor. A DELIBERATE JUDGMENT CALL, revisited once already: now that
// candidate SYNONYMS may themselves be short phrases (see `isSane` in
// scripts/build-en-synonyms.mjs — "turn off" for "abhor" passed review),
// `synonymKeyOf` still only reduces QUERY KEYS from single words, not
// multi-word gloss pieces. The two are not symmetric risks: a multi-word
// CANDIDATE was already vetted by gap-detection/backfill-exclusion against a
// query Datamuse could answer well; a multi-word QUERY reopens exactly the
// phrase-noise failure mode above at the query itself, before any of that
// filtering gets a chance to run. Flagged for Sam rather than resolved
// silently — see the ticket write-up's open questions.
//
// THE DATAMUSE QUERY STRATEGY (verified by hand against the live API,
// REVISED once already — see below)
// =====================================================================
// BOTH `rel_syn=<word>` and `ml=<word>` are always queried and UNION'd, never
// rel_syn-first-fallback-to-ml. That was the original design and it was
// wrong: `rel_syn=abhor` returns only 3 words (loathe, execrate, abominate —
// all fairly formal/obscure), because WordNet's synset for "abhor" is
// genuinely narrow. But `ml=abhor` surfaces "hate" and "detest" — obviously
// excellent everyday synonyms rel_syn simply does not have — a few ranks
// below the same 3 `rel_syn` words (which `ml` also returns, tagged `"syn"`).
// Treating rel_syn as sufficient whenever it was non-empty (the original
// design) silently threw "hate"/"detest" away for every word where WordNet's
// synset happens to exist but is incomplete, which turned out to be common,
// not rare.
//
// WHAT `ml` CANDIDATES ARE KEPT, AND WHY IT IS GAP-DETECTION NOW, NOT A TIER
// OR A FIXED COUNT (revised a second time, against more evidence)
// =====================================================================
// Two more things were checked by hand before landing on the final rule:
//
//   - `results_type:backfill_gloss` (and any sibling `results_type:backfill_*`
//     tag) is Datamuse's OWN explicit low-confidence marker: once it runs out
//     of real relational data for a query, it pads the rest of the response
//     with dictionary-gloss-text co-occurrence and tags it as such. Verified
//     on `ml=doesn't+exist`: position 0 is genuinely `nonexistent` (tagged
//     `syn`+`primary_external`); position 1, `come`, is tagged
//     `backfill_gloss`; every position after that carries NO `results_type`
//     tag at all and the scores flatten into a near-identical noise floor
//     (10009977–10011404, a ~0.01% spread) mixing real hits ("absent",
//     "missing") indistinguishably with pure noise ("fitted", "bruise",
//     "lame") at literally the same score. ANY `backfill_*`-tagged result is
//     excluded outright, and it marks the point past which the untagged
//     results below are no longer a reliable relational signal at all.
//   - The real discriminator for the untagged results ABOVE that point is
//     SCORE-GAP structure, not their absolute score or a fixed rank. Verified
//     on `ml=abhor`: detest/hate/dislike/reject/rob sit within ~0.1–3% of
//     each other in score (a tight, genuine cluster) before a HARD ~33% drop
//     into repel/despise/disgust/…/kill/doubt/recoil (real synonyms mixed
//     indistinguishably with words that have nothing to do with "abhor").
//     So: walk the untagged, non-backfill results in score order, keeping
//     each one whose score is within `GAP_RATIO` of the PREVIOUS accepted
//     score, and stop at the first step that drops further than that — a
//     real semantic-tier boundary, not noise-floor jitter.
//   - That gap rule alone is not sufficient: some words (`yes`; concrete
//     nouns like `persimmon`, whose embedding neighbors are OTHER FRUIT —
//     "papaya", "orange", "pomegranate" — not synonyms of persimmon at all)
//     never show a real gap for a long stretch; the whole tail decays in
//     smooth ~0.01%–2% steps with nothing to trigger on. `UNTAGGED_SAFETY_CAP`
//     is the backstop for exactly this case, hand-tuned against "yes": the
//     top 7 (yup/yep/yea/affirmative/affirmation/affirmatively/admittedly)
//     are genuinely synonymous and never trip the gap rule; "sake" at rank 8
//     is not a synonym of "yes" by any reading and also never trips it — so
//     the cap, not the gap, is what has to stop it there.
//   - Concrete-noun/cultural-term glosses (persimmon-style) remain a real
//     residual risk NEITHER signal fully solves — Datamuse's embedding
//     genuinely cannot distinguish "true synonym" from "closely associated
//     but different thing" for these. This is flagged explicitly for the
//     self-review pass below rather than claimed solved by tuning.
//
// A NOTE ON WHAT "rel_syn IS CLEAN" ACTUALLY MEANS. It has no embedding blend
// (no co-occurrence drift like `ml` on a phrase), but it is NOT sense-aware:
// WordNet returns synonyms across EVERY sense of the headword, unseparated.
// Manually checked against the live API for this ticket's cap-tuning pass —
// `rel_syn=big` includes "bad" (a slang sense, "my bad"); `rel_syn=fast`
// includes "immoral", "dissolute", "loyal" (the "fast living" / "fast friend"
// senses, nothing to do with speed); `rel_syn=close` includes "stingy",
// "ungenerous" (the "close-fisted" sense); `rel_syn=run` includes "melt",
// "bleed", "hunt", "force", "guide", "consort" (colors run, stockings run,
// run a business, run game, run with a crowd). Critically, this noise is NOT
// a tail phenomenon — "bad" sits at rank ~19 of 89 for "big" by SCORE, and
// "good" is the single HIGHEST-scored result for "close". So a low count cap
// does not meaningfully protect against it, and a high cap does not
// meaningfully worsen it: the entries most likely to be wrong-sense are
// already reachable near the top for a polysemous headword, cap or no cap.
// What actually filters this is CROSS_SENSE_NOISE below plus the self-review
// pass — see the ticket's review notes for what was caught and removed.
// This only shows up for common short adjectives/verbs; single-sense JMdict
// glosses (nouns like "beautiful", "empty", "nonexistent") stayed clean at
// every rank checked. Given that, the cap is set generously (Sam: "more
// synonyms is better, there are a lot of ways to say some things") rather
// than defensively, because count was never the safety mechanism here.
//
// CACHING AND RESUMABILITY
// =========================
// Two separate layers of "already done", intentionally not conflated:
//
//   - The Datamuse RESPONSE CACHE (scripts/.cache/datamuse/*.json, one file
//     per exact query string). This is "have I asked the API this question".
//     It survives everything except a `--refresh` run explicitly asking for
//     fresh answers, because Datamuse's data for a given word does not change
//     under us and re-fetching it is wasteful (and is what drew a CloudFront
//     403 the first time this script was run at higher concurrency).
//   - The DERIVED-RESULT LEDGER (scripts/.cache/en-synonyms.progress.json).
//     This is "have I already filtered/capped this key into a final pool
//     entry (or a confirmed no-hit)". It is what makes a crash mid-run cheap
//     to resume: the output file only stores keys that HAD at least one
//     accepted synonym, so without a separate ledger there is no way to tell
//     "not processed yet" apart from "processed, zero survived filtering" —
//     that key would be re-queried (harmlessly, since the response cache
//     still short-circuits the network call, but it would still redo the
//     filtering work and mask a real bug if filtering itself were the thing
//     that crashed).
//
// PLAIN RUN (no flags): loads any existing en-synonyms.json + progress ledger,
// skips every key already in the ledger, and for the rest reuses a cached
// Datamuse response when one exists or fetches fresh otherwise. This is both
// "continue a crashed run" and "top up after new glosses were added to the
// app's data" in one behavior — new keys get queried, old ones don't.
//
// --refresh (or --force): ignores the progress ledger and the existing
// en-synonyms.json entirely and RE-DERIVES every key from scratch — this is
// for when MAX_REL_SYN/the filters/CROSS_SENSE_NOISE change and old capped or
// filtered results need to be redone. It still prefers the on-disk Datamuse
// RESPONSE cache over the network (Datamuse's synonym data for a word is not
// expected to change day to day, so there is nothing to gain from re-fetching
// it just to re-run local filtering logic) — it only re-fetches a query whose
// cached response is missing. To force fresh network answers too (e.g. if
// Datamuse's data itself is suspected stale), delete scripts/.cache/datamuse/
// by hand before running with --refresh.
//
// The output file itself is written incrementally — every BATCH_SIZE keys,
// and once more at the end — via a write-to-temp-then-rename, so a hard crash
// leaves the last flushed batch intact on disk rather than nothing at all.
//
// RUN
// ===
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-en-synonyms.mjs
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-en-synonyms.mjs --refresh
// Network access required unless everything needed is already response-cached.

import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

import { ALL_FACTS, factInfo } from "@/lib/facts";
import { isEnglishGloss, stripParentheticals, synonymKeyOf } from "@/lib/engine/en-match";

const REFRESH = process.argv.includes("--refresh") || process.argv.includes("--force");

const CACHE_DIR = new URL("./.cache/datamuse/", import.meta.url);
const PROGRESS_PATH = fileURLToPath(
  new URL("./.cache/en-synonyms.progress.json", import.meta.url),
);
const OUT_PATH = fileURLToPath(
  new URL("../src/data/generated/en-synonyms.json", import.meta.url),
);

mkdirSync(CACHE_DIR, { recursive: true });

/** Write `data` to `path` atomically: to a sibling temp file, then rename over
 * the target. A crash mid-write leaves the OLD file intact rather than a
 * truncated/corrupt one — `rename` is a single filesystem operation. */
function writeJsonAtomic(path, data) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    // A previous run crashed mid-write of a NON-atomic path, or the file was
    // hand-edited into invalid JSON. Treat as absent rather than throwing —
    // resuming from nothing is safe; refusing to run is not helpful here.
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Collect every distinct queryable key from the app's real gloss data.
// ---------------------------------------------------------------------------

function collectKeys() {
  const keys = new Set();
  for (const id of ALL_FACTS) {
    const info = factInfo(id);
    if (!info) continue;
    for (const a of info.answers) {
      if (!isEnglishGloss(a)) continue;
      const stripped = stripParentheticals(a);
      for (const piece of [a, stripped, ...stripped.split(",")]) {
        const key = synonymKeyOf(piece);
        if (key) keys.add(key);
      }
    }
  }
  return [...keys].sort();
}

// ---------------------------------------------------------------------------
// 2. Datamuse, cached: rel_syn UNION ml's high-confidence cluster.
// ---------------------------------------------------------------------------

function cachePathFor(query) {
  // Query strings are already URL-safe words/keys (see synonymKeyOf), so they
  // are safe filenames as-is.
  return new URL(`${encodeURIComponent(query)}.json`, CACHE_DIR);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with cache-first (see the header's CACHING section for what
 * --refresh does and does not bypass) and a small retry/backoff for
 * transient failures — Datamuse returned 403s under this script's earlier,
 * higher concurrency, almost certainly a soft rate-limit rather than a hard
 * block (its docs publish no hard cap, just a "be reasonable" guideline).
 * Backs off and retries rather than aborting the whole run over one flaky
 * response. */
async function datamuseFetch(query) {
  const cachePath = cachePathFor(query);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  }
  const url = `https://api.datamuse.com/words?${query}`;
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        writeFileSync(cachePath, JSON.stringify(json));
        return json;
      }
      lastErr = new Error(`Datamuse ${res.status} for ${url}`);
    } catch (err) {
      lastErr = err;
    }
    // Exponential backoff: 500ms, 1s, 2s, 4s, 8s.
    await sleep(500 * 2 ** attempt);
  }
  throw lastErr;
}

// Caps, one per trust tier, all raised from the original conservative pass
// per Sam's direction ("more synonyms is better") — see the header comment's
// "A NOTE ON WHAT rel_syn IS CLEAN ACTUALLY MEANS" and "THE DATAMUSE QUERY
// STRATEGY" for why the cap itself is not the primary thing doing the safety
// work for the polysemous-headword / wrong-sense risk; that is CROSS_SENSE_NOISE
// and the self-review pass. These caps bound how much of each source is even
// considered.
//
//   rel_syn — no embedding blend, WordNet-direct. Raised far (25): checked by
//   hand against ~20 words including the app's shortest/most common
//   adjectives and verbs, and result quality does not correlate with rank —
//   a bad (wrong-sense) entry is as likely at rank 2 as rank 20. A tight cap
//   here was only ever protecting against a tail that isn't where the actual
//   risk lives, so raising it adds real coverage (rarer words legitimately
//   have long clean synonym lists — see "beautiful", 32 results, clean
//   throughout) without a corresponding rise in the specific risk this
//   module cares about.
const MAX_REL_SYN = 25;
//   ml, "syn"-tagged — same WordNet backing as rel_syn (so the same
//   cross-sense caveat applies), now ALWAYS unioned in (not gated behind
//   rel_syn being empty — see the strategy note for why that was wrong).
//   Raised to 25, matching rel_syn: hand-checking "abhor" and "big" showed
//   this is frequently the SAME underlying WordNet set as rel_syn, just
//   reachable through the `ml` endpoint's tagging, so it gets the same trust
//   and the same cap. `results_type:backfill_*`-tagged entries are excluded
//   even here, in case a "syn" tag and a backfill tag were ever both present.
const MAX_SYN_TAGGED = 25;
//   ml, UNTAGGED, non-backfill — walked in score order and kept while each
//   step stays within GAP_RATIO of the PREVIOUS accepted score; the first
//   step that drops further ends the walk (see the header's "WHAT ml
//   CANDIDATES ARE KEPT" for the "abhor" evidence this is tuned against: the
//   real ~33% drop from "rob" into "repel" trips it, the ~0.1–3% steps within
//   detest/hate/dislike/reject/rob do not).
const GAP_RATIO = 0.9;
//   Backstop for words with no real gap at all across a long stretch ("yes";
//   concrete nouns whose embedding neighbors are OTHER, DIFFERENT things —
//   "persimmon" → "papaya", "orange" — see the header). Hand-tuned against
//   "yes": 7 keeps the genuinely-synonymous top cluster
//   (yup/yep/yea/affirmative/affirmation/affirmatively/admittedly) and stops
//   one short of "sake" at rank 8, which the gap rule alone never catches
//   because "yes"'s whole list decays too smoothly to trip it.
const UNTAGGED_SAFETY_CAP = 7;

/** True for any Datamuse `results_type:backfill_*` tag — Datamuse's own
 * explicit "I ran out of real relational data, this is gloss-text
 * co-occurrence filler" marker. See the header's backfill-exclusion note. */
function isBackfillTagged(tags) {
  return (tags ?? []).some((t) => t.startsWith("results_type:backfill"));
}

/** One key's raw candidate words from Datamuse: rel_syn UNION ml's
 * high-confidence cluster (syn-tagged, plus the untagged run that survives
 * gap-detection), pre-sanity-filtering. Both sources are always queried —
 * see the header's "THE DATAMUSE QUERY STRATEGY" for why rel_syn-first
 * fallback silently dropped good synonyms like "hate"/"detest" for "abhor". */
async function candidatesFor(key) {
  const [relSynRaw, mlRaw] = await Promise.all([
    datamuseFetch(`rel_syn=${encodeURIComponent(key)}`),
    datamuseFetch(`ml=${encodeURIComponent(key)}`),
  ]);

  const relSyn = relSynRaw.slice(0, MAX_REL_SYN).map((r) => r.word);

  const scored = mlRaw.filter(
    (r) => typeof r.score === "number" && !isBackfillTagged(r.tags),
  );

  const tagged = scored
    .filter((r) => r.tags?.includes("syn"))
    .slice(0, MAX_SYN_TAGGED)
    .map((r) => r.word);

  const untagged = [];
  let prevScore = null;
  for (const r of scored) {
    if (r.tags?.includes("syn")) continue;
    if (untagged.length >= UNTAGGED_SAFETY_CAP) break;
    if (prevScore !== null && r.score / prevScore < GAP_RATIO) break;
    untagged.push(r.word);
    prevScore = r.score;
  }

  return [...relSyn, ...tagged, ...untagged];
}

// ---------------------------------------------------------------------------
// 3. Sanity filtering beyond the score/tag rules above.
// ---------------------------------------------------------------------------

/** Very common, highly polysemous words that showed up as embedding-drift
 * noise across multiple unrelated `ml` queries during manual verification for
 * this ticket (e.g. "come", "fitted", "hold", "bruise", "fit", "know", "lame",
 * "mind" all appeared for `ml=doesn't+exist`; "sake", "good", "true", "will"
 * for `ml=yes`). A word this generic is more likely to be riding co-occurrence
 * than carrying the query word's specific sense, so it is rejected outright
 * rather than trusted because it scored in the top few. */
const TOO_GENERIC = new Set([
  "come", "go", "get", "make", "put", "run", "set", "take", "give", "hold",
  "fit", "fitted", "know", "knows", "lame", "mind", "sake", "good", "true",
  "will", "right", "way", "thing", "stuff", "kind", "sort", "case", "point",
  "matter", "turn", "keep", "let", "look", "see", "find", "back", "just",
]);

/** Specific (key → candidate) pairs manually confirmed, while raising the
 * caps above, to be a DIFFERENT sense of the headword than the one carrying
 * the wrong-sense risk — WordNet's synonym relation is not sense-disambiguated
 * (see the header's note), so a cross-sense collision is not something a
 * generic word list can catch; each of these was found by hand-checking a
 * specific headword's full result list. Keyed exactly like SYNONYM_POOL so a
 * pair can be looked up and dropped regardless of which tier produced it. */
const CROSS_SENSE_NOISE = {
  big: new Set(["bad"]), // "my bad" slang sense, nothing to do with size
  fast: new Set(["immoral", "dissolute", "riotous", "loyal", "profligate", "libertine", "degenerate", "debauched", "dissipated", "degraded"]), // "fast living" / "a fast friend" senses
  close: new Set(["stingy", "ungenerous", "good", "hot"]), // "close-fisted" sense; "hot" is the children's hot/cold proximity game leaking into the embedding, not a real synonym
  run: new Set(["melt", "bleed", "hunt", "force", "guide", "consort", "lean", "endure", "prevail", "persist", "ram", "bunk", "tally", "streak", "tend"]), // colors run / stockings run / run a business / run with a crowd
  hot: new Set(["unpleasant", "illegal", "popular", "lucky", "sensual", "sexy", "cool"]), // slang/idiom senses, and "cool" is a literal ANTONYM on the temperature sense this app actually uses
  sorry: new Set(["bad", "worthless", "no-account", "no-count", "good-for-nothing", "no-good", "deplorable"]), // "a sorry excuse" sense, not the apology sense
  no: new Set(["nobelium", "atomic number 102", "rtecs"]), // WordNet conflates "No" the element symbol (and its chemical-registry acronym) with the word "no"
  open: new Set(["give", "afford", "lawless", "unlawful"]),
  abhor: new Set(["rob"]), // slipped into "abhor"'s ml untagged tier despite no real relation

  // The remaining entries below were caught by a second, broader self-review
  // pass specifically sampling directionally/emotionally-loaded adjective
  // pairs (hot/cold, big/small, before/after, male/female, buy/sell …) for
  // the exact antonym-smuggling failure mode this ticket exists to prevent.
  // Several distinct noise patterns showed up, worth naming so a future
  // re-run's reviewer knows what to look for again:
  //   - The children's "hot/cold" proximity GAME leaking into embeddings:
  //     "hot" mapped near "near"/"close", "cold" mapped near "far"/"old"/
  //     "low" — none of these are synonyms in the senses this app teaches.
  //   - Grammatical-term co-occurrence: "strong"/"irregular" both describe
  //     verb classes and co-occur in text about GRAMMAR, not each other.
  //   - True antonym pairs slipping through on words with no real score gap
  //     (push/pull, buy/sell, male/female) — the single most important
  //     category to catch, since this is the literal failure mode the
  //     spike's synonym-model approach was shelved for.
  //   - Acronym/proper-noun contamination ("in" → CBS/NIH/NSIS, all from
  //     WordNet abbreviation entries for unrelated organizations).
  wet: new Set(["cool"]), // same hot/cold-game contamination, wrong sense
  old: new Set(["cold", "early", "genuine", "honest-to-god", "sure-enough", "honest-to-goodness"]), // "cold" via the game; the rest are a stretchy "authentic" sense this app doesn't use
  low: new Set(["cold"]),
  far: new Set(["cold"]),
  near: new Set(["hot", "unreal", "artificial", "left", "moral", "dear"]), // "hot" via the game; "unreal"/"artificial" is the obscure "near beer"-style prefix sense
  push: new Set(["pull"]), // true antonym
  pull: new Set(["push"]), // true antonym
  buy: new Set(["sell"]), // true antonym
  sell: new Set(["buy"]), // true antonym
  male: new Set(["female"]), // true antonym
  female: new Set(["male"]), // true antonym
  in: new Set(["without", "cbs", "nsis", "nih", "nsi", "establishment", "immigration"]), // acronym contamination + "without" is backwards
  yeah: new Set(["great", "super", "fine", "baby", "dude", "kinda", "nice"]), // casual-speech co-occurrence, not synonyms of the affirmation itself
  right: new Set(["flop", "outside"]), // unrelated noise
  new: new Set(["late"]), // not a synonym, borderline-opposite in some contexts
  strong: new Set(["irregular"]), // grammatical-term co-occurrence ("strong"/"irregular" verbs), not synonymous as plain adjectives
  light: new Set(["sick", "perch"]), // unrelated noise
  dark: new Set(["shred", "bedtime"]), // unrelated noise
  weak: new Set(["regular"]), // unrelated noise
  heavy: new Set(["sound"]), // unrelated noise

  // Found on a further random-sample pass (see the ticket's review notes for
  // the full sample) rather than the directional/antonym-targeted one above.
  ungrateful: new Set(["grateful", "crappy", "dirty", "filthy", "stinking", "smelly"]), // "grateful" is a literal ANTONYM; the rest is unrelated slang noise
  silver: new Set(["metal", "granite", "mercury", "bronze", "gold"]), // different, specific OTHER metals/minerals — wrong if taken as "silver" itself, not just "metallic-toned"
};

/** Same word, different surface form only — not a useful "equivalent
 * phrasing". Covers plain case/plural (already handled by lower-casing
 * upstream, kept here for defense-in-depth) and simple stem collisions like
 * "exist"/"existing" or "happy"/"happier". */
function isSameWordForm(key, candidate) {
  if (key === candidate) return true;
  const stem = (w) => w.replace(/(ing|ers|est|er|ies|ied|ed|es|s)$/, "");
  const sk = stem(key);
  const sc = stem(candidate);
  return sk.length >= 3 && sk === sc;
}

// Spelled number words — reject ANY of these as a synonym-pool candidate,
// regardless of key. Found by a test regression: WordNet's `rel_syn=one`
// genuinely includes "two" and "three" (numbers share a taxonomic "cardinal
// number" synset relation in WordNet, which is not the same thing as being
// interchangeable answers) — accepting that would let a wrong NUMBER pass as
// though it were a paraphrase, exactly the antonym-shaped failure mode this
// whole module exists to prevent. en-match.ts's own digit-variant layer
// already handles legitimate number equivalences ("four" ↔ "4")
// deterministically; numbers have no business in the fuzzy-adjacent synonym
// pool at all. Duplicated as a plain word list rather than importing
// en-match.ts's private UNITS/TENS/SCALES maps — small, closed, and not
// worth exporting internals for.
const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty",
  "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand",
  "million", "billion", "digit", "number", "cardinal", "numeral",
]);

function isSane(key, candidate) {
  const c = candidate.trim().toLowerCase();
  if (c.length <= 1) return false; // single-character, malformed
  // Keeps hyphenated compounds and short (<=2 word) phrasal candidates —
  // Datamuse legitimately returns these ("turn off" for "abhor", "non-
  // existent" for "nonexistent") and the gap-detection pass above is what
  // vets them, not their shape. Anything longer/punctuated is still dropped
  // rather than guessed at.
  if (!/^[a-z]+(-[a-z]+)*( [a-z]+(-[a-z]+)*)?$/.test(c)) return false;
  if (isSameWordForm(key, c)) return false;
  if (TOO_GENERIC.has(c)) return false;
  if (CROSS_SENSE_NOISE[key]?.has(c)) return false;
  if (NUMBER_WORDS.has(c)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 4. A small, explicitly hand-curated supplement Datamuse structurally cannot
//    produce: multi-word negation paraphrases, and informal/slang variants of
//    the app's highest-frequency interjection glosses.
//
//    WHY THIS EXISTS SEPARATELY. Datamuse's synonym relations return single
//    WORDS, never phrases — `rel_syn=nonexistent` gives "absent", "missing",
//    "lacking" … but can never give "doesn't exist", because that is a
//    negated-verb PARAPHRASE of a different word ("exist"), not a synonym of
//    "nonexistent" itself. That is exactly SAK-53's motivating bug. Likewise,
//    internet-register slang ("yas" for an enthusiastic yes) is not in
//    WordNet at all, so no Datamuse relation will ever surface it — Sam hit
//    this directly typing "yas" for うん ("yeah") and being marked wrong,
//    which is not a typo (typoBudget is deliberately 0 at this length; see
//    en-match.ts) but a genuine register variant.
//
//    Kept intentionally SMALL: this is the "small, hand-curated" list the
//    ticket describes, layered on top of (not instead of) the Datamuse bulk.
//    It covers only the reported case plus the small cluster of very-early,
//    very-high-frequency interjections the ticket specifically flagged as a
//    `rel_syn` coverage gap (はい/うん "yes", いいえ "no", and their neighbors).
//    It is NOT an attempt at a general slang dictionary — anything not listed
//    here still falls through to Datamuse or, failing that, no pool entry at
//    all, which is the safe default (a valid paraphrase staying unmatched,
//    same as before this ticket).
// ---------------------------------------------------------------------------
const MANUAL_SEEDS = {
  // The ticket's own motivating example: negated-verb paraphrase of an
  // adjective gloss that Datamuse's word-level synonym relations cannot
  // reach.
  nonexistent: ["doesn't exist", "does not exist", "not existing"],

  // High-frequency "yes" glosses (はい, うん, ええ) — rel_syn=yes is verified
  // empty; ml=yes surfaces yup/yep/yea acceptably (kept from the automated
  // pass) but not further slang. "yas" is the reported case.
  yes: ["yas", "yeah", "yah"],

  // うん's own gloss is "yeah" in this app's data — same slang cluster from
  // the other direction, so it needs its own entry (this pool is keyed
  // per-gloss-word, not merged across synonyms).
  yeah: ["yas", "yes", "yah", "yup", "yep"],

  // いいえ/いや-family "no" glosses.
  no: ["nah", "nope"],
};

// ---------------------------------------------------------------------------
// 5. Run.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 200; // flush the output + progress ledger every N processed keys

async function main() {
  const keys = collectKeys();
  console.log(
    `en-synonyms: ${keys.length} distinct queryable gloss keys` +
      (REFRESH ? " (--refresh: re-deriving everything)" : ""),
  );

  // Resume state: an existing pool and the ledger of keys already derived in
  // a prior run. --refresh discards both and starts clean.
  const pool = REFRESH ? {} : (readJsonIfExists(OUT_PATH) ?? {});
  const progressArr = REFRESH ? [] : (readJsonIfExists(PROGRESS_PATH) ?? []);
  const done = new Set(progressArr);

  const todo = keys.filter((k) => !done.has(k));
  if (todo.length < keys.length) {
    console.log(
      `  resuming: ${keys.length - todo.length} keys already derived, ` +
        `${todo.length} left`,
    );
  }

  let queried = 0;
  let withHits = 0;
  let fromCache = 0;
  let sinceFlush = 0;

  function flush() {
    const sortedPool = Object.fromEntries(
      Object.keys(pool)
        .sort()
        .map((k) => [k, pool[k]]),
    );
    writeJsonAtomic(OUT_PATH, sortedPool);
    writeJsonAtomic(PROGRESS_PATH, [...done].sort());
  }

  // Small bounded concurrency, with a short per-request stagger — Datamuse
  // publishes no hard rate limit but asks for reasonable use, and running
  // this ticket's first attempt at 16-way concurrency with no stagger drew a
  // 403 partway through (see `datamuseFetch`'s retry/backoff, which also
  // guards the rest). This keeps well under a soft ~100k/day guideline while
  // not taking hours for ~11k keys.
  const CONCURRENCY = 2;
  const STAGGER_MS = 300;
  let cursor = 0;

  async function worker() {
    while (cursor < todo.length) {
      const i = cursor++;
      const key = todo[i];
      const cached = existsSync(cachePathFor(`rel_syn=${key}`));
      if (cached) fromCache++;
      else await sleep(STAGGER_MS);
      const raw = await candidatesFor(key);
      queried++;
      const sane = [...new Set(raw.map((w) => w.toLowerCase()))].filter((w) =>
        isSane(key, w),
      );
      if (sane.length > 0) {
        pool[key] = sane;
        withHits++;
      } else {
        delete pool[key]; // in case --refresh is re-deriving a key that used to have hits
      }
      done.add(key);
      sinceFlush++;
      if (sinceFlush >= BATCH_SIZE) {
        sinceFlush = 0;
        flush();
      }
      if (queried % 500 === 0) {
        console.log(`  ...${queried}/${todo.length} queried, ${withHits} with hits`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Merge the hand-curated supplement on top — union, not replace, since a
  // supplement key colliding with an automated one is a deliberate addition,
  // not an override. Re-applied every run (cheap, idempotent) so it survives
  // a plain resumed run even though those keys are already in `done`.
  for (const [key, syns] of Object.entries(MANUAL_SEEDS)) {
    const existing = new Set(pool[key] ?? []);
    for (const s of syns) existing.add(s);
    pool[key] = [...existing];
  }

  flush();

  console.log(
    `en-synonyms.json written: ${Object.keys(pool).length} keys with at ` +
      `least one accepted synonym (of ${keys.length} total, ${queried} ` +
      `queried this run, ${fromCache} served from the response cache), ` +
      `${JSON.stringify(pool).length} bytes.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
