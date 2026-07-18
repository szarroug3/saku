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
import type { Host, Recipe } from "../../data/grammar/recipes.ts";
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
}

/**
 * The verb pool: common verbs, one per conjugation class the engine drives, so
 * every 音便 shape is exercised. 行く leads — it is the class whose て-form is
 * irregular (行って, not 行いて), the same reason example.ts fixes on it — and the
 * rest are the everyday verbs a beginner meets first.
 */
export const VERB_VEHICLES: readonly Vehicle[] = [
  { surface: "行く", kana: "いく", cls: "v5k-s", host: "verb" }, // て-form irregular
  { surface: "食べる", kana: "たべる", cls: "v1", host: "verb" },
  { surface: "見る", kana: "みる", cls: "v1", host: "verb" },
  { surface: "起きる", kana: "おきる", cls: "v1", host: "verb" },
  { surface: "書く", kana: "かく", cls: "v5k", host: "verb" },
  { surface: "泳ぐ", kana: "およぐ", cls: "v5g", host: "verb" },
  { surface: "話す", kana: "はなす", cls: "v5s", host: "verb" },
  { surface: "待つ", kana: "まつ", cls: "v5t", host: "verb" },
  { surface: "死ぬ", kana: "しぬ", cls: "v5n", host: "verb" },
  { surface: "遊ぶ", kana: "あそぶ", cls: "v5b", host: "verb" },
  { surface: "飲む", kana: "のむ", cls: "v5m", host: "verb" },
  { surface: "読む", kana: "よむ", cls: "v5m", host: "verb" },
  { surface: "帰る", kana: "かえる", cls: "v5r", host: "verb" },
  { surface: "買う", kana: "かう", cls: "v5u", host: "verb" },
  { surface: "する", kana: "する", cls: "vs-i", host: "verb" },
  { surface: "来る", kana: "くる", cls: "vk", host: "verb" },
];

/** い-adjective vehicles, for a recipe that attaches to adj-i (〜そう, 〜て…). */
export const ADJ_I_VEHICLES: readonly Vehicle[] = [
  { surface: "高い", kana: "たかい", cls: "adj-i", host: "adj-i" },
  { surface: "安い", kana: "やすい", cls: "adj-i", host: "adj-i" },
  { surface: "新しい", kana: "あたらしい", cls: "adj-i", host: "adj-i" },
];

/** な-adjective vehicles. */
export const ADJ_NA_VEHICLES: readonly Vehicle[] = [
  { surface: "静か", kana: "しずか", cls: "adj-na", host: "adj-na" },
  { surface: "元気", kana: "げんき", cls: "adj-na", host: "adj-na" },
  { surface: "便利", kana: "べんり", cls: "adj-na", host: "adj-na" },
];

/** Noun vehicles (no conjugation class). */
export const NOUN_VEHICLES: readonly Vehicle[] = [
  { surface: "本", kana: "ほん", cls: null, host: "noun" },
  { surface: "車", kana: "くるま", cls: null, host: "noun" },
  { surface: "水", kana: "みず", cls: null, host: "noun" },
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
 */
export function vehiclesFor(r: Recipe): Vehicle[] {
  if (r.wrap) return []; // a wrap needs two words; apply() refuses it anyway.
  const hosts = new Set(r.attach.map((a) => a.host));
  const out: Vehicle[] = [];
  for (const host of HOST_ORDER) {
    if (!hosts.has(host)) continue;
    for (const v of POOL[host]) {
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
 */
export function pickVehicle(r: Recipe, rng: Rng = Math.random): Vehicle | null {
  const options = vehiclesFor(r);
  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)] ?? options[0];
}
