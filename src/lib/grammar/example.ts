// A fixed representative word per host, for DRILLING a pattern's production.
//
// Production names the target ("build the 〜てから form of 行く"), so it needs a
// word to build ON. A pattern attaches to a HOST, not a word — see the Host doc
// in recipes.ts — so one word per host is enough. It is the same move build.ts
// makes for the cluster page, and for the same reason: the pattern is what
// varies down a drill, the word is the vehicle.
//
// WHY A FIXED WORD AND NOT A RANDOM ONE
// =====================================
// The drill's question seam (engine/question.ts) is (fact, direction) → prompt,
// with no per-showing slot to carry a freshly-picked verb. A random word would
// have to be re-picked on every render, and the answer would change under the
// user's hands between the question and their grading it. So the word is FIXED
// per pattern and the built form is deterministic — which is exactly what lets
// the form be baked into the fact as a real, gradeable answer string (see
// data/grammar/index.ts) rather than recomputed per keystroke.
//
// The cost is repetition: every verb pattern drills on 行く. That is a smaller
// drill than "give me the form of THIS verb" would be, and the honest path to
// the richer version is a per-showing lemma the question seam does not carry
// yet. 行く is a good fixed choice for the same reason build.ts picks it: it is
// v5k-s, the one verb whose て-form is irregular (行って, not 行いて), so a form
// built on it proves the engine did the hard case.

import { apply } from "./apply.ts";
import type { Host, Recipe } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

/** A representative word for a host: its surface form, its kana reading, and
 * its conjugation class (null for a noun, which does not conjugate). */
interface HostExample {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass | null;
}

/** One per host. The kana reading rides along so the built form can be accepted
 * in kana too (行ってから AND いってから) — an IME user types the first, a
 * romaji typist the second, and both are right. */
const HOST_EXAMPLE: Record<Host, HostExample> = {
  verb: { surface: "行く", kana: "いく", cls: "v5k-s" },
  "adj-i": { surface: "高い", kana: "たかい", cls: "adj-i" },
  "adj-na": { surface: "静か", kana: "しずか", cls: "adj-na" },
  noun: { surface: "本", kana: "ほん", cls: null },
};

/** The order hosts are tried in when a recipe accepts several — verb first,
 * because a verb pattern is the interesting one and 行く is the interesting
 * word. */
const HOST_ORDER: readonly Host[] = ["verb", "adj-i", "adj-na", "noun"];

export interface BuiltExample {
  /** The vehicle word, surface form. 行く */
  readonly lemma: string;
  /** Its kana reading. いく */
  readonly kana: string;
  /** The pattern built on the surface word. 行ってから */
  readonly form: string;
  /** The pattern built on the kana reading. いってから */
  readonly kanaForm: string;
}

const CACHE = new Map<string, BuiltExample | null>();

/**
 * Build a recipe on its representative word, or null if none of its hosts has
 * an example that applies.
 *
 * Null should not happen for a producible recipe — every one conjugates
 * something on a host we have a word for — but it is a VALUE rather than a
 * throw, exactly as apply() is: a recipe that will not build on a given word is
 * a normal outcome, and the caller drops the production instead of crashing.
 *
 * Cached by recipe id: this is called once per fact at module load and again
 * per candidate distractor, and the answer never changes.
 */
export function buildExample(r: Recipe): BuiltExample | null {
  const hit = CACHE.get(r.id);
  if (hit !== undefined) return hit;
  const built = compute(r);
  CACHE.set(r.id, built);
  return built;
}

function compute(r: Recipe): BuiltExample | null {
  // A wrap has two slots and no single-word form; apply() refuses it and so do
  // we. Producible recipes are never wraps (isProducible drops them), so this
  // only bites a caller reaching past the gate.
  if (r.wrap) return null;
  for (const host of HOST_ORDER) {
    if (!r.attach.some((a) => a.host === host)) continue;
    const ex = HOST_EXAMPLE[host];
    const surface = apply(r, ex.surface, ex.cls);
    if (!surface.ok) continue;
    // A form that leaves the word untouched (the vacuous rows) is typing, not a
    // question — mirror the production generator's own guard.
    if (surface.value === ex.surface) continue;
    const kana = apply(r, ex.kana, ex.cls);
    return {
      lemma: ex.surface,
      kana: ex.kana,
      form: surface.value,
      kanaForm: kana.ok ? kana.value : surface.value,
    };
  }
  return null;
}
