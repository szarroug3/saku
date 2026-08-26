// A POOL of vehicle words, so a production question is not always 行く.
//
// WHY THIS EXISTS
// ===============
// example.ts bakes ONE fixed vehicle per host (行く for verbs) into every
// production fact, and its own header explains why the fact HAS to be fixed:
// the built form is a real, gradeable answer string baked into the fact, and a
// fact cannot carry a different string every showing. That fixed form still
// anchors the fact — its answers, its meaning, its unlock.
//
// This module is the OTHER half: a per-SHOWING vehicle. Naming the target
// ("build the 〜てから form of X") makes the answer unique for ANY legal X, so
// the drill can pick a fresh X each time and grade it by re-running the recipe
// on that X — the answer is recomputed from the vehicle, never read off the
// baked fact. So the fact stays fixed (行く) and the DRILL varies the vehicle.
// Presentation moves; grading and scheduling do not. This is the same shape as
// the kanji anchor in engine/question.ts: the context moves, the fact does not.
//
// WHY A CURATED POOL AND NOT "any verb from VOCAB"
// ================================================
// A production item tests the RECIPE, with the vehicle's conjugation riding
// along (see the confound note in grammar/questions.ts). A vehicle should
// therefore be a verb the learner already knows cold, or the item stops
// measuring the pattern and starts measuring whether they can conjugate an
// obscure verb. So the pool is small, common, and hand-picked to COVER the
// conjugation classes — one representative per godan ending, both irregulars,
// ichidan, する/くる — because the class is what the 音便 hinges on and the point
// is to exercise the engine across classes, not to trawl the dictionary.
//
// LEGALITY IS NOT ASSUMED, IT IS TESTED
// =====================================
// A recipe that a vehicle cannot legally take (defective forms, host mismatch,
// a form that leaves the word untouched) must never be emitted. `vehiclesFor`
// does not reason about which pattern blocks which verb; it BUILDS the recipe
// on each candidate with apply() and keeps only the ones that both succeed and
// transform. So the conjugation engine's own blocklist (行く→行って, ある's
// defectiveness, class-defective forms) is honoured for free, exactly as the
// fixed-vehicle path honours it.

import { apply } from "./apply.ts";
import { VOCAB, vocabRow, wordSenseRegister, type VocabRow } from "../../data/vocab.ts";
import { isIntransitive, isTransitive, ruVerbKindOf, wordClassOf } from "../word-forms.ts";
import { vehicleInBucket, type VehicleBucket } from "./te-endings.ts";
import type { Host, Recipe, Transitivity } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

/** A candidate word to build a pattern on. */
export interface Vehicle {
  /** Surface (dictionary) form. 食べる */
  readonly surface: string;
  /** Kana reading, so a built form can be accepted in kana too (行ってから AND
   * いってから). null for a noun, which does not conjugate. */
  readonly kana: string;
  /** Conjugation class for the engine; null for a noun (no class, no form). */
  readonly cls: WordClass | null;
  /** Which recipe host this word satisfies — the axis recipes attach on. */
  readonly host: Host;
  /**
   * Whether somebody does this verb TO something, or it just happens. Null for
   * a word the axis does not apply to (every non-verb) and for a verb the
   * dictionary declines to tag.
   *
   * READ FROM THE DICTIONARY, NOT TYPED HERE. The app already knows this — it
   * is JMdict's vt/vi, sitting in vocab.json, and lib/word-forms.ts already
   * reads it to caption a word's page. A hand-kept copy in this table would be
   * a second answer to a question that already has one, free to drift from it
   * on the next ingest. See `transitivityOf`.
   */
  readonly transitivity: Transitivity | null;
}

/**
 * What the dictionary says about a word, on the transitivity axis. Null when it
 * has no entry, or when the entry carries neither tag (a noun, an adjective).
 *
 * BOTH TAGS RESOLVE TO TRANSITIVE. 待つ and する carry vi AND vt, and a pattern
 * asking for a transitive verb is asking whether a transitive reading exists —
 * for those two it does. See `isTransitive` in lib/word-forms.ts.
 */
export function transitivityOf(surface: string): Transitivity | null {
  const row = vocabRow(surface);
  if (!row) return null;
  if (isTransitive(row)) return "transitive";
  return isIntransitive(row) ? "intransitive" : null;
}

/**
 * Does this recipe accept this word, on the transitivity axis?
 *
 * True for every recipe that sets no restriction, which is all but 〜てある —
 * so this is a pass-through on 80 of the 81 rows and the one row it is not a
 * pass-through on is the one where the app was generating Japanese nobody says.
 *
 * Takes a SURFACE FORM rather than a Vehicle on purpose. The drill's serialized
 * runtime carries a vehicle as three plain strings (see `GrammarVehicle` in
 * engine/question.ts), and the GRADER is a caller: an item that arrives with an
 * intransitive vehicle — a stale runtime, a re-cut of the pool, anything — must
 * be refused there too, not merely never dealt. One predicate, both ends.
 */
export function transitivityAllows(r: Recipe, surface: string): boolean {
  if (!r.transitivity) return true;
  return transitivityOf(surface) === r.transitivity;
}

/**
 * Will this recipe take this word at all?
 *
 * The two verb restrictions behind ONE predicate, and they are behind one on
 * purpose: a caller that remembered `transitivity` and forgot `notOn` would
 * deal exactly the item `notOn` exists to stop, and it would do it silently.
 * Every gate in the app — the pool, the worked line, the cluster row, the baked
 * fact, the grader — goes through here.
 *
 * Takes a SURFACE FORM for the reason `transitivityAllows` does: the grader
 * receives a vehicle as three plain strings and has to be able to refuse one.
 */
export function recipeAllows(r: Recipe, surface: string): boolean {
  if (!transitivityAllows(r, surface)) return false;
  return !r.notOn?.includes(surface);
}

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
 * session-aware dedup (`usedInDeck`, `pickVehicle` below) is correct but
 * structurally powerless against a class with nothing to dedupe against.
 *
 * The fix is not "hand-add a second word per thin class" — that is the same
 * hand-typed artifact that produced the gap, just delayed. `wordClassOf`
 * (word-forms.ts) already classifies any VOCAB row into this exact class
 * system, because the drill's production facts are minted per-class off the
 * SAME classifier (data/grammar/index.ts). The pool was simply never wired to
 * it. `REGULAR_VERB_CLASSES` is every class that classifier resolves for a
 * verb whose 音便 has NO irregularity — v5u through v5r, plus v1 — computed
 * from VOCAB once at import time (filter + sort + slice; no build step, see
 * this file's own header on why that stays true here).
 *
 * WHY THIS DOES NOT WEAKEN "a vehicle must be a word she knows cold"
 * =====================================================================
 * `pickVehicle` (below) already prefers a KNOWN vehicle and only falls back to
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
 * either way, same as any of the pinned irregulars below.
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
 *
 * A PLAIN MODULE-LEVEL COMPUTATION, done once when this module loads — filter,
 * sort, slice — not a build step. See this file's own header on why that
 * matters here.
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
 * The verb pool. 行く leads — it is the class whose て-form is irregular
 * (行って, not 行いて), the same reason example.ts fixes on it — followed by
 * every REGULAR class's corpus-derived members (`corpusPoolFor`, SAK-214), and
 * closed by the three remaining irregulars.
 *
 * `REGULAR_VERB_CLASSES`' ORDER IS NOT ARBITRARY. Two existing call sites walk
 * `VERB_VEHICLES` in ARRAY order and depend on what leads it:
 *   - `exampleVerb`'s fallback (below) takes the first vehicle a restricted
 *     recipe still accepts. 〜に行く blocks 行く itself (`notOn`), so it has
 *     always fallen through to 言う — v5u leads for exactly this, and 言う is
 *     also v5u's own most-common corpus member, so leading with v5u preserves
 *     it with no special-casing.
 *   - `recipeFormula`'s worked examples (formula.test.ts) take the first
 *     THREE vehicles with distinct 音便 classes to prove the pattern
 *     generalises — 行く, then 言う, then a THIRD class, which has always been
 *     v1 (食べる). v1 leads `REGULAR_VERB_CLASSES` right after v5u so that
 *     stays true.
 *
 * THE SPECIAL/IRREGULAR CLASSES (v5k-s, v5u-s, v5aru, v5r-i, v1-s, vz, vs-i,
 * vs-s, vk) ARE DELIBERATELY NOT HERE — they keep exactly the single
 * hand-picked canonical word they always had (行く above; する, 来る, ある
 * below). They are irregular precisely because there is essentially one
 * commonly-taught representative, and `DEFAULT_VERB` / `RESTRICTED_VERB` /
 * `exampleVerb()` all anchor on 行く / 書く specifically for reasons explained
 * in this file's own header — none of that changes here.
 */
export const VERB_VEHICLES: readonly Vehicle[] = [
  verb("行く", "いく", "v5k-s"), // て-form irregular
  ...REGULAR_VERB_CLASSES.flatMap(corpusPoolFor),
  verb("する", "する", "vs-i"),
  verb("来る", "くる", "vk"),
  verb("ある", "ある", "v5r-i"),
];

/** The verb every pattern is DEMONSTRATED on when it takes 行く: the cluster
 * page's column, the worked line's lead, and the word the production fact bakes
 * its answer on. v5k-s, so its て-form is the irregular 行って and a form built on
 * it proves the engine did the hard case. */
const DEFAULT_VERB: Vehicle = verb("行く", "いく", "v5k-s");

/**
 * The verb a recipe gets when it narrows by KIND. 〜てある wants a verb somebody
 * does to something, and 書いてある is the sentence everybody meets the pattern
 * on, so the transitive row is 書く (v5k → 書いて) and the intransitive one is
 * 行く itself.
 */
const RESTRICTED_VERB: Record<Transitivity, Vehicle> = {
  transitive: verb("書く", "かく", "v5k"),
  intransitive: DEFAULT_VERB,
};

/**
 * The one verb a recipe is demonstrated on, everywhere it is demonstrated.
 *
 * THREE PLACES USED TO ANSWER THIS SEPARATELY — build.ts for the cluster row,
 * example.ts for the baked fact, and formula.ts by reading example.ts's answer
 * back — off two identical hand-kept tables. Two copies of a table is two
 * chances for the page to lead with one verb while the fact under it is built on
 * another, which is the exact confusion formula.ts's own lead-ordering note was
 * written to prevent. One function, one answer.
 *
 * The pick is the recipe's own restriction, and then the recipe is asked whether
 * it will actually take it. 〜に行く refuses 行く outright (see `notOn`), so the
 * default is not available to it and the answer falls to the first verb in the
 * POOL the recipe does accept — 食べる, giving 食べに行く, which is the sentence
 * this pattern is for. Falling to the pool rather than to a third hand-kept
 * table is what keeps this a function instead of a per-recipe list: the pool is
 * already ordered by how early a beginner meets the word.
 */
export function exampleVerb(r: Recipe): Vehicle {
  const pick = r.transitivity ? RESTRICTED_VERB[r.transitivity] : DEFAULT_VERB;
  if (recipeAllows(r, pick.surface)) return pick;
  return VERB_VEHICLES.find((v) => recipeAllows(r, v.surface)) ?? pick;
}

/**
 * い-adjective vehicles, for a recipe that attaches to adj-i (〜そう, 〜て…).
 *
 * いい LEADS, and it is here for the reason 行く leads the verbs: it is the
 * irregular one. Its class is adj-ix, whose stem is よ and not い — so 〜そう on
 * it is よさそう, through BOTH of sou-appearance's `except` rules at once (the
 * さ-insertion, matched on the class).
 *
 * That row used to be unreachable. `except` was written after a run against
 * real vocabulary showed the template emitting よそう — not merely wrong but a
 * DIFFERENT WORD (予想, "a forecast") — and then no adj-ix word existed in this
 * pool, in example.ts's HOST_EXAMPLE, or in build.ts's EXAMPLE, so nothing the
 * app can actually show ever exercised it. Correctness code that cannot fire
 * reads as covered when it is not; the fix is a vehicle that fires it, not a
 * deletion, because the rule guards real Japanese the moment the drill meets
 * an いい. A test now asserts every `except` row is reachable from some vehicle.
 */
export const ADJ_I_VEHICLES: readonly Vehicle[] = [
  { surface: "いい", kana: "いい", cls: "adj-ix", host: "adj-i", transitivity: null }, // stem is よ: よさそう
  { surface: "高い", kana: "たかい", cls: "adj-i", host: "adj-i", transitivity: null },
  { surface: "安い", kana: "やすい", cls: "adj-i", host: "adj-i", transitivity: null },
  { surface: "新しい", kana: "あたらしい", cls: "adj-i", host: "adj-i", transitivity: null },
];

/** な-adjective vehicles. */
export const ADJ_NA_VEHICLES: readonly Vehicle[] = [
  { surface: "静か", kana: "しずか", cls: "adj-na", host: "adj-na", transitivity: null },
  { surface: "元気", kana: "げんき", cls: "adj-na", host: "adj-na", transitivity: null },
  { surface: "便利", kana: "べんり", cls: "adj-na", host: "adj-na", transitivity: null },
];

/** Noun vehicles (no conjugation class). */
export const NOUN_VEHICLES: readonly Vehicle[] = [
  { surface: "本", kana: "ほん", cls: null, host: "noun", transitivity: null },
  { surface: "車", kana: "くるま", cls: null, host: "noun", transitivity: null },
  { surface: "水", kana: "みず", cls: null, host: "noun", transitivity: null },
];

/** Every vehicle, keyed by host. verb first — a verb pattern is the interesting
 * one and the reason this pool exists. */
const POOL: Record<Host, readonly Vehicle[]> = {
  verb: VERB_VEHICLES,
  "adj-i": ADJ_I_VEHICLES,
  "adj-na": ADJ_NA_VEHICLES,
  noun: NOUN_VEHICLES,
};

/** The order hosts are tried in — verb first, mirroring example.ts. */
const HOST_ORDER: readonly Host[] = ["verb", "adj-i", "adj-na", "noun"];

/** A source of randomness, injectable so tests are deterministic. Returns
 * [0, 1). Defaults to Math.random. */
export type Rng = () => number;

/**
 * Every vehicle this recipe can LEGALLY be built on, in pool order.
 *
 * "Legally" is not a claim this function makes — it is one apply() makes. Each
 * candidate is actually built; a candidate is kept only when the build succeeds
 * AND changes the word (a form that leaves the word untouched is typing, not a
 * question — the same guard example.ts and the production generator both use).
 * So every constraint the conjugation engine encodes (defectiveness, the 行く
 * irregular, host mismatch) is honoured without this module naming any of them.
 *
 * Empty is a real answer: a wrap, or a recipe no pooled word can host. A caller
 * with an empty list has no varied question to ask and falls back to the fixed
 * vehicle baked in the fact.
 *
 * `known`, when given, is the KNOWN-WORD gate: a vehicle is kept only when the
 * predicate accepts its surface form. The live drill passes one built from the
 * learner's history, so a production item is never drilled on a word she has not
 * met — the item would then measure vocabulary, not the pattern (see the header
 * on why a vehicle must be a word known cold). It is INJECTED rather than read
 * here so this module stays a pure pool, and it is optional so the callers that
 * want every legal vehicle (a cluster page's worked examples) still get them.
 * An empty result is the same routine fallback either way.
 */
export function vehiclesFor(
  r: Recipe,
  onHost?: Host,
  known?: (surface: string) => boolean,
  bucket?: VehicleBucket,
): Vehicle[] {
  if (r.wrap) return []; // a wrap needs two words; apply() refuses it anyway.
  const hosts = new Set(r.attach.map((a) => a.host));
  const out: Vehicle[] = [];
  for (const host of HOST_ORDER) {
    if (!hosts.has(host)) continue;
    // A production fact is keyed on ONE host now (see productionAspect), so a
    // showing of the adj-i fact must never roll 行く. Without this filter the
    // split buys nothing: both facts would draw from the same pool, the drill
    // would ask the same mixed question twice, and two separate scores would be
    // kept for it. Unfiltered (no host given) is still the right default for a
    // caller asking "what can this recipe be built on at all".
    if (onHost !== undefined && host !== onHost) continue;
    for (const v of POOL[host]) {
      // A bucketed showing wants exactly its scored class or exceptional word.
      // This is what keeps v5m and v5n separate even when their visible ending is
      // the same, and keeps いい off the regular い-adjective fact.
      if (bucket !== undefined && !vehicleInBucket(v, bucket)) continue;
      // THE ONE CONSTRAINT apply() CANNOT SEE. Everything else this function
      // refuses, it refuses by building and looking — see the header. 〜てある
      // on 行く BUILDS: the engine produces 行ってある happily, because the
      // conjugation is fine and it is the sentence that is not Japanese. So the
      // recipe has to say it, and this is where it is heard.
      if (!recipeAllows(r, v.surface)) continue;
      if (known && !known(v.surface)) continue;
      const built = apply(r, v.surface, v.cls);
      if (!built.ok || built.value === v.surface) continue;
      out.push(v);
    }
  }
  return out;
}

/**
 * May this vehicle be shown to a learner who has NOT met it — i.e. can she
 * conjugate it, given what the card tells her?
 *
 * Non-verb hosts (adj, noun) are always fine: they carry no 音便 to guess. (The
 * い-adj / な-adj ambiguity is a separate, tiny edge case, deliberately not
 * blocked here.)
 *
 * A る-ending verb WHOSE CLASS WE CAN NAME is fine, and this is the part that
 * changed. A bare 食べる / 帰る is spelling-ambiguous — ichidan or godan, nothing
 * in 〜る says which — but the drill NAMES it: the instruction reads "this る-verb"
 * / "this う-verb" for an unknown vehicle (see quiz-instruction.ts), which is the
 * one fact spelling withholds. With the class stated, the conjugation is fully
 * determined, so a labelable る-verb (ichidan, or a regular godan-る) is dealt in
 * kana like any other filler. `ruVerbKindOf` is the one place that label is
 * decided, so this and the instruction can never disagree about which verbs it
 * covers.
 *
 * Out: 行く (v5k-s) and 問う (v5u-s) look godan but carry an irregular 音便 (行って
 * not 行いて) that no class label fixes, and する / 来る are their own memorized
 * skills — none may be dealt on a free pick. する/来る still reach a card through
 * their own VERB bucket (@suru/@kuru), which names the exception outright.
 *
 * KNOWN verbs skip this test entirely (see `pickVehicle`): once she has met 食べる
 * its class is no longer a guess, so its class rides in the HINT, not here.
 */
export function showableWhenUnknown(v: Vehicle): boolean {
  if (v.host !== "verb") return true;
  // A る-verb we can label ("る-verb" / "う-verb") is conjugable once named.
  if (ruVerbKindOf(v.surface, v.cls)) return true;
  // Otherwise only a plain godan whose non-る ending already gives its class.
  return !v.surface.endsWith("る") && v.cls !== "v5k-s" && v.cls !== "v5u-s";
}

/**
 * Pick one vehicle for a recipe, or null when none is available.
 *
 * `rng` defaults to Math.random; pass a seeded one in tests. Null means the
 * caller should fall back to the fixed vehicle (行く) — a wrap, or a recipe no
 * pooled word can host at all.
 *
 * `onHost` pins the pick to one host, and a production showing always passes
 * it: the fact being drilled is a fact ABOUT that host. See `vehiclesFor`.
 *
 * `known` is the KNOWN-WORD preference. PREFER a vehicle the learner has met —
 * a production item drilled on a known word tests the pattern, not vocabulary.
 * But a production fact must never become UNASKABLE just because she has met
 * none of the pool: so when she knows none, fall back to the vehicles she can
 * still conjugate given what the card names (`showableWhenUnknown`) and show
 * those in kana (the caller's job). That keeps the item askable from lesson one
 * while never asking her to produce a 音便 she has no way to predict (行く, 問う).
 * A る-verb IS now eligible — the instruction states its class — but 行く / する /
 * 来る stay out of a free pick. Without a `known` predicate every legal vehicle is
 * eligible (a cluster page's worked examples). Null only when the resulting pool
 * is empty.
 *
 * `usedInDeck` is the SESSION-AWARE dedup gate (SAK-203 round 2). It names
 * every vehicle SURFACE already picked for a DIFFERENT grammar-production
 * fact earlier in this same deck/session — so a learner reviewing 〜ている and
 * 〜てください in the same sitting does not get およぐ handed to both, just
 * because each recipe's fact independently rolled its own pool. It is a
 * PREFERENCE, not a second gate: applied to whichever pool the known/unknown
 * split above already produced, after that split runs, so "prefer known"
 * keeps deciding the partition and this only breaks ties within it. When
 * every member of that partition is already used — an irregular's one-word
 * pool, a class with a single pool member (see vehicles.ts's own header on
 * why the pool stays small), or a short session that has cycled the whole
 * thing — the filter drops out and a repeat is the pool's honest ceiling,
 * not a bug this function can fix. Optional and defaulting to "nothing used
 * yet" so every existing caller (a cluster page's worked examples, which
 * wants the plain earliest-taught pick with no session to be aware of) is
 * unaffected.
 */
export function pickVehicle(
  r: Recipe,
  rng: Rng = Math.random,
  onHost?: Host,
  known?: (surface: string) => boolean,
  bucket?: VehicleBucket,
  usedInDeck?: ReadonlySet<string>,
): Vehicle | null {
  // Every LEGAL vehicle for this recipe/host/bucket — do NOT gate by `known`
  // here, so the unknown-fallback below can still draw from the full legal pool.
  // The bucket pins a production pick to a verb of its ending / class / irregular
  // (and, for the 音便 case, keeps every unknown る-verb and irregular off).
  const all = vehiclesFor(r, onHost, undefined, bucket);
  let options: Vehicle[];
  if (known) {
    const knownOpts = all.filter((v) => known(v.surface));
    if (knownOpts.length > 0) {
      options = knownOpts;
    } else {
      const safe = all.filter(showableWhenUnknown);
      // A VERB bucket pins the fact to ONE irregular verb — 行く / する / 来る, the
      // @iku/@suru/@kuru production facts — and the fact IS that verb's exception:
      // there is no other verb it can be asked on. `showableWhenUnknown` strips
      // it (its 音便 is irregular, and no class label fixes it), and with nothing left the
      // caller stranded the card on its BAKED KANJI lemma — 行く shown to a learner
      // who has not met it, and 行って revealed the same way. Keep the pinned verb
      // instead; grammarVehicleFor returns it with `known: false`, so it draws in
      // KANA (いく → いって) exactly as every other unknown filler does. The te-form
      // lesson teaches these three as the irregulars, so drilling them is the point,
      // never a kanji the learner cannot read.
      options = safe.length > 0 ? safe : bucket?.kind === "verb" ? all : [];
    }
  } else {
    options = all;
  }
  if (options.length === 0) return null;
  // SESSION-AWARE DEDUP (SAK-203 round 2). Prefer an option NOT already used
  // for a different fact earlier in this deck — see the doc comment above.
  // Filters the partition the known/unknown split just chose; falls back to
  // the whole partition when every member is already spent.
  if (usedInDeck && usedInDeck.size > 0) {
    const unused = options.filter((v) => !usedInDeck.has(v.surface));
    if (unused.length > 0) options = unused;
  }
  // Prefer the FIRST-LEARNED verb (Sam): the known option with the lowest
  // beginnerRank — the earliest-taught, most-familiar word — so a grammar example
  // anchors on a verb the learner knows cold rather than a random known one.
  // `rng` still breaks exact rank ties, keeping the choice stable but not always
  // identical when two words are equally early.
  const rank = (v: Vehicle): number =>
    vocabRow(v.surface)?.beginnerRank ?? Number.POSITIVE_INFINITY;
  const best = Math.min(...options.map(rank));
  const earliest = options.filter((v) => rank(v) === best);
  return earliest[Math.floor(rng() * earliest.length)] ?? earliest[0]!;
}
