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
import { vocabRow } from "../../data/vocab.ts";
import { isIntransitive, isTransitive } from "../word-forms.ts";
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

/** One verb pool row. The transitivity comes from the dictionary rather than
 * from the argument list, which is what keeps this table a table. */
function verb(surface: string, kana: string, cls: WordClass): Vehicle {
  return { surface, kana, cls, host: "verb", transitivity: transitivityOf(surface) };
}

/**
 * The verb pool: common verbs, one per conjugation class the engine drives, so
 * every 音便 shape is exercised. 行く leads — it is the class whose て-form is
 * irregular (行って, not 行いて), the same reason example.ts fixes on it — and the
 * rest are the everyday verbs a beginner meets first.
 */
export const VERB_VEHICLES: readonly Vehicle[] = [
  verb("行く", "いく", "v5k-s"), // て-form irregular
  verb("食べる", "たべる", "v1"),
  verb("見る", "みる", "v1"),
  verb("起きる", "おきる", "v1"),
  verb("書く", "かく", "v5k"),
  verb("泳ぐ", "およぐ", "v5g"),
  verb("話す", "はなす", "v5s"),
  verb("待つ", "まつ", "v5t"),
  verb("死ぬ", "しぬ", "v5n"),
  verb("遊ぶ", "あそぶ", "v5b"),
  verb("飲む", "のむ", "v5m"),
  verb("読む", "よむ", "v5m"),
  verb("帰る", "かえる", "v5r"),
  verb("買う", "かう", "v5u"),
  verb("する", "する", "vs-i"),
  verb("来る", "くる", "vk"),
];

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
      // THE ONE CONSTRAINT apply() CANNOT SEE. Everything else this function
      // refuses, it refuses by building and looking — see the header. 〜てある
      // on 行く BUILDS: the engine produces 行ってある happily, because the
      // conjugation is fine and it is the sentence that is not Japanese. So the
      // recipe has to say it, and this is where it is heard.
      if (!transitivityAllows(r, v.surface)) continue;
      if (known && !known(v.surface)) continue;
      const built = apply(r, v.surface, v.cls);
      if (!built.ok || built.value === v.surface) continue;
      out.push(v);
    }
  }
  return out;
}

/**
 * Pick one legal vehicle for a recipe, or null when none is available.
 *
 * `rng` defaults to Math.random; pass a seeded one in tests. Null means the
 * caller should fall back to the fixed vehicle (行く) — a wrap, or a recipe the
 * pool cannot host.
 *
 * `onHost` pins the pick to one host, and a production showing always passes
 * it: the fact being drilled is a fact ABOUT that host. See `vehiclesFor`.
 *
 * `known` is the KNOWN-WORD gate, threaded straight to `vehiclesFor`: with it,
 * only words the learner has met are eligible, and null (fall back to the baked
 * vehicle) is the ordinary early answer when she knows none of the pool yet.
 */
export function pickVehicle(
  r: Recipe,
  rng: Rng = Math.random,
  onHost?: Host,
  known?: (surface: string) => boolean,
): Vehicle | null {
  const options = vehiclesFor(r, onHost, known);
  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)] ?? options[0];
}
