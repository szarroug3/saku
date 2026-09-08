// Building the verb vehicles, at build time (SAK-399).
//
// vehicles.ts used to mint the verb pool as it loaded: `corpusPoolFor` filtered,
// sorted and sliced all 12,555 VOCAB rows once per regular class, ten passes,
// to reach 230 vehicles weighing about 21 KB. It also asked the dictionary for
// each candidate's register on the way, which reads word-definitions.json
// (4.7 MB) from disk, so a table meant to be read when a word card asks for it
// was read by every process on its first request instead.
//
// The derivation lives here now, and only two things run it:
// scripts/build-vehicles.mjs, which writes src/data/generated/vehicles.json,
// and vehicles.equiv.test.ts, which asserts the file still agrees with it.
// Nothing a page serves imports this module.
//
// The pools, the `Vehicle` shape and every function the app calls stay in
// vehicles.ts, which is what the app reads; this file imports from it, never
// the other way round.
//
// Everything below is the code vehicles.ts had, moved, with its comments: the
// pool row, the regular classes and the order they are in, the size cap, the
// register filter, and the per-class pass over the corpus.

import { VOCAB, wordSenseRegister, type VocabRow } from "../../data/vocab.ts";
import { wordClassOf } from "../word-forms.ts";
import { transitivityOf, type BakedVehicles, type Vehicle } from "./vehicles.ts";
import type { Transitivity } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

/** One verb pool row. The transitivity comes from the dictionary rather than
 * from the argument list, which is what keeps this table a table. */
function verb(surface: string, kana: string, cls: WordClass): Vehicle {
  return { surface, kana, cls, host: "verb", transitivity: transitivityOf(surface) };
}

/**
 * SAK-214: the REGULAR classes, wired to the real corpus rather than hand-typed.
 *
 * THE BUG THIS CLOSES
 * ====================
 * Six of the nine regular godan classes (v5k, v5s, v5t, v5n, v5b, v5r) had
 * EXACTLY ONE pool member each — 話す was not merely "over-picked" the day Sam
 * saw it drilled twice in one session, it was v5s's entire pool, the same shape
 * SAK-203 round 2 already found and fixed for v5g (泳ぐ / 急ぐ). SAK-203's
 * session-aware dedup (`usedInDeck`, `pickVehicle` in vehicles.ts) is correct
 * but structurally powerless against a class with nothing to dedupe against.
 *
 * The fix is not "hand-add a second word per thin class" — that is the same
 * hand-typed artifact that produced the gap, just delayed. `wordClassOf`
 * (word-forms.ts) already classifies any VOCAB row into this exact class
 * system, because the drill's production facts are minted per-class off the
 * SAME classifier (data/grammar/index.ts). The pool was simply never wired to
 * it. `REGULAR_VERB_CLASSES` is every class that classifier resolves for a
 * verb whose 音便 has NO irregularity — v5u through v5r, plus v1.
 *
 * WHY THIS DOES NOT WEAKEN "a vehicle must be a word she knows cold"
 * =====================================================================
 * `pickVehicle` already prefers a KNOWN vehicle and only falls back to
 * `showableWhenUnknown` — a genuinely restrictive gate, unaffected by this
 * change — when she knows none of the pool. Growing the pool only grows the
 * KNOWN side's headroom (a class she has studied deeply now has real
 * alternatives to dedupe across) and the unknown-fallback's variety within the
 * SAME restrictive gate. It does not touch which side `pickVehicle` tries
 * first, or what `showableWhenUnknown` admits.
 *
 * WHAT IT DOES REINTRODUCE, AND HOW THAT IS HANDLED
 * ====================================================
 * `showableWhenUnknown`'s fallback path has NO commonness filter of its own —
 * it trusted the old pool to already BE common words. Naively admitting every
 * VOCAB row of a class would hand an unmet learner something like 承る or
 * 召し上がる (honorific-register verbs, real JMdict hits in these classes) as
 * an unlabeled filler, which reads as bizarre precisely because she has never
 * been taught to use it that way. `corpusPoolFor` below excludes any sense
 * whose SOLE register is honorific/humble (`wordSenseRegister`), and keeps
 * only each class's most common ~`MAX_POOL_PER_CLASS` members by
 * `beginnerRank` — see that constant's own comment for the exact number and
 * why.
 */
const REGULAR_VERB_CLASSES: readonly WordClass[] = [
  "v5u",
  "v1",
  "v5k",
  "v5g",
  "v5s",
  "v5t",
  "v5n",
  "v5b",
  "v5m",
  "v5r",
];

/**
 * How many of a class's most-common corpus members make the pool, most-common
 * (lowest `beginnerRank`) first.
 *
 * WHY 25, NOT "EVERYTHING"
 * ========================
 * v5r has 350 corpus members after the quality filters below and v1 has 475 —
 * unbounded, `showableWhenUnknown`'s fallback path (see the header above) would
 * eventually reach a beginnerRank in the thousands, well past what an early
 * learner has any business meeting as an UNLABELED filler. 25 keeps every
 * class inside a band that stays recognizably early: even v1 and v5s's 25th
 * member sits under beginnerRank ~2000 (立てる, 暮らす), the same
 * everyday-conversational neighbourhood the six thin classes' original single
 * hand-picked member came from, not a corpus straggler.
 *
 * 25 is also comfortably past what dedup headroom needs. SAK-203's own
 * scenario is two or three grammar recipes independently rolling the same
 * class in one session — that needs 2-3 distinct members to have somewhere
 * to go, not 25 — so this leaves deliberate ROOM for known-word variety to
 * grow as a learner studies further into a class, rather than cutting it to
 * the dedup minimum.
 *
 * WHY NOT LOWER (e.g. the suggested range's floor, ~20)
 * ======================================================
 * Some classes (v5t, v5b, v5g) have fewer than 25 corpus members even before
 * the cap applies — 25 is generous enough that a mid-size class like v5t
 * (23 after the transitivity filter below) is barely touched by the cap, so
 * the number is doing real work only on the three large classes (v5m, v5r,
 * v1) where a lower cutoff would not meaningfully change quality but would
 * needlessly shrink the known-word variety those classes can offer once a
 * learner has studied a lot of vocabulary.
 *
 * Classes with fewer than this many QUALIFYING members (see `corpusPoolFor`)
 * simply take everything they have — v5n is the extreme case: the entire
 * common-word corpus has exactly ONE v5n verb, 死ぬ, so that class stays a
 * single-member pool no matter the cutoff. That is not a data gap this
 * change can close; it is what "regular ぬ-ending verb" means in the corpus
 * the app teaches from. Session-aware dedup has nothing to work with there
 * either way, same as any of the pinned irregulars.
 */
const MAX_POOL_PER_CLASS = 25;

/**
 * Is `row`'s indexed sense honorific- or humble-ONLY (`wordSenseRegister`)?
 *
 * A sense that carries no register tag at all, or one that carries honorific
 * /humble ALONGSIDE a plainer register, is left alone — only the sole-register
 * case reads as a word she was never taught to use this way (承る, "to hear",
 * humble-only; 召し上がる, "to eat/drink", honorific-only). `VocabRow`'s
 * row-level `glosses`/`reb` are CEJC's first teachable sense (see its own doc
 * comment), so this checks exactly the sense a vehicle built from `row.keb` /
 * `row.reb` would actually be teaching.
 */
function isHonorificOrHumbleOnly(row: VocabRow): boolean {
  const register = wordSenseRegister(row.keb, row.reb, row.glosses);
  return register.length > 0 && register.every((r) => r === "honorific" || r === "humble");
}

/**
 * The corpus-derived pool for one REGULAR class: every VOCAB row `wordClassOf`
 * resolves to `cls`, minus honorific/humble-only senses (see above) and minus
 * any row `transitivityOf` cannot resolve at all — a handful of compound
 * EXPRESSIONS that happen to end in a regular godan/ichidan shape (役に立つ,
 * "to be useful"; 責任を持つ, "to be responsible") but carry neither JMdict's
 * vt nor vi tag, because they are phrases, not the kind of single verb this
 * pool means to hand a recipe. (This filter also keeps the invariant
 * transitivity.test.ts already asserts — every pool vehicle resolves to a
 * transitivity — true by construction rather than by accident.) Kept to the
 * `MAX_POOL_PER_CLASS` most common by `beginnerRank`, ascending.
 */
function corpusPoolFor(cls: WordClass): Vehicle[] {
  return VOCAB.filter(
    (row) =>
      wordClassOf(row) === cls &&
      !isHonorificOrHumbleOnly(row) &&
      transitivityOf(row.keb) !== null,
  )
    .slice()
    .sort((a, b) => a.beginnerRank - b.beginnerRank)
    .slice(0, MAX_POOL_PER_CLASS)
    .map((row) => verb(row.keb, row.reb, cls));
}

/**
 * The three pools vehicles.ts used to build as it loaded, in the order it built
 * them. See each constant in vehicles.ts for what its order and its contents
 * mean to a caller; this function only mints them.
 */
export function buildVehicles(): Omit<BakedVehicles, "vehiclesVersion"> {
  return {
    verbVehicles: [
      verb("行く", "いく", "v5k-s"), // て-form irregular
      ...REGULAR_VERB_CLASSES.flatMap(corpusPoolFor),
      verb("する", "する", "vs-i"),
      verb("来る", "くる", "vk"),
      verb("ある", "ある", "v5r-i"),
    ],
    defaultVerb: verb("行く", "いく", "v5k-s"),
    restrictedVerb: {
      transitive: verb("書く", "かく", "v5k"),
      intransitive: verb("行く", "いく", "v5k-s"),
    } satisfies Record<Transitivity, Vehicle>,
  };
}
