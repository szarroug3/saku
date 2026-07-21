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
// 行く is a good fixed choice for the same reason build.ts picks it: it is
// v5k-s, the one verb whose て-form is irregular (行って, not 行いて), so a form
// built on it proves the engine did the hard case.
//
// THE FIXED FORM ANCHORS THE FACT; THE DRILL NOW VARIES THE SHOWING
// ================================================================
// This fixed form is still what the FACT carries — its baked answer, its
// meaning, its unlock — and it must stay fixed for the reason above. But the
// drill no longer has to SHOW 行く every time. engine/question.ts threads a
// per-showing vehicle through PromptContext, picked from lib/grammar/vehicles.ts,
// and grades by re-running the recipe on it (naming the target makes the answer
// unique for any legal verb). So the repetition is gone from the screen while
// the fact underneath is unchanged: presentation varies, grading and scheduling
// do not. See vehicles.ts and the grammar QuestionType.

import { apply } from "./apply.ts";
import { exampleVerb } from "./vehicles.ts";
import { isTrivialAttachment, type Host, type Recipe } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

/** A representative word for a host: its surface form, its kana reading, and
 * its conjugation class (null for a noun, which does not conjugate). */
interface HostExample {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass | null;
}

/** A vehicle as this file's HostExample. Same three fields under two names —
 * one shape for the pool, one for the fixed word — and this is the seam. */
function asHostExample(v: { surface: string; kana: string; cls: WordClass | null }): HostExample {
  return { surface: v.surface, kana: v.kana, cls: v.cls };
}

/**
 * One per host. The kana reading rides along so the built form can be accepted
 * in kana too (行ってから AND いってから) — an IME user types the first, a
 * romaji typist the second, and both are right.
 *
 * THE VERB ROW IS NOT HERE, and its absence is a fix. A recipe may refuse 行く:
 * 〜てある wants a verb somebody does to something and baked its fact on
 * 行ってある, which is not Japanese, and then the drill graded that answer
 * correct; 〜に行く refuses going as its own errand. The fixed vehicle has to
 * satisfy the recipe like any other, so it is `exampleVerb`'s answer — the same
 * one the cluster page and the worked line get. See vehicles.ts.
 */
const HOST_EXAMPLE: Record<Exclude<Host, "verb">, HostExample> = {
  "adj-i": { surface: "高い", kana: "たかい", cls: "adj-i" },
  "adj-na": { surface: "静か", kana: "しずか", cls: "adj-na" },
  noun: { surface: "本", kana: "ほん", cls: null },
};

/** The order hosts are tried in when a recipe accepts several — verb first,
 * because a verb pattern is the interesting one and 行く is the interesting
 * word. */
export const HOST_ORDER: readonly Host[] = ["verb", "adj-i", "adj-na", "noun"];

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
 * The host a recipe's production is baked on when nobody names one — the FIRST
 * host in HOST_ORDER whose attachment actually TRANSFORMS its word.
 *
 * NOT simply the first host in HOST_ORDER, and that distinction was a shipped
 * wrong item. 〜ので takes a verb's dictionary form (行く + ので) and an adj-na's
 * prenominal (静か → 静かな + ので). Only the second does any work; the first is
 * the word retyped with a fixed string on the end. Under "first host wins" the
 * verb won, so the baked fact was 行くので and the QUESTION WAS "type 行く again,
 * with ので". `isVacuous` exists to stop exactly that item, and 〜ので passed it
 * — honestly, on the strength of an adjective half that then never got shown.
 *
 * So the rule is "first host that is a QUESTION", and the verb still wins every
 * time it is one, which is all but this one row. Falls back to the plain host
 * order when nothing transforms; such a recipe is vacuous and has no production
 * fact anyway, and a null here would lose the cluster page's row for it.
 */
export function primaryHost(r: Recipe): Host | null {
  const has = (h: Host) => r.attach.some((a) => a.host === h);
  const real = HOST_ORDER.find((h) => r.attach.some((a) => a.host === h && !isTrivialAttachment(a)));
  return real ?? HOST_ORDER.find(has) ?? null;
}

/**
 * Build a recipe on its representative word for one host, or null if it will
 * not build there.
 *
 * `host` omitted means the PRIMARY host — see `primaryHost` for which that is
 * and why it is not just the first one. Naming a host is what lets a pattern
 * with two of them bake two facts, one per rule: 行きそう and 高そう are
 * different skills and each needs its own answer string. See `productionHosts`
 * in data/grammar/index.ts for which hosts get one.
 *
 * Null should not happen for a producible recipe on its primary host — every
 * one conjugates something on a host we have a word for — but it is a VALUE
 * rather than a throw, exactly as apply() is: a recipe that will not build on a
 * given word is a normal outcome, and the caller drops the production instead
 * of crashing.
 *
 * Cached by (recipe id, host): this is called once per fact at module load and
 * again per candidate distractor, and the answer never changes.
 */
export function buildExample(r: Recipe, host?: Host): BuiltExample | null {
  const on = host ?? primaryHost(r);
  const key = `${r.id}|${on ?? ""}`;
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const built = on ? compute(r, on) : null;
  CACHE.set(key, built);
  return built;
}

function compute(r: Recipe, host: Host): BuiltExample | null {
  // A wrap has two slots and no single-word form; apply() refuses it and so do
  // we. Producible recipes are never wraps (isProducible drops them), so this
  // only bites a caller reaching past the gate.
  if (r.wrap) return null;
  if (!r.attach.some((a) => a.host === host)) return null;
  const ex = host === "verb" ? asHostExample(exampleVerb(r)) : HOST_EXAMPLE[host];
  const surface = apply(r, ex.surface, ex.cls);
  if (!surface.ok) return null;
  // A form that leaves the word untouched (the vacuous rows) is typing, not a
  // question — mirror the production generator's own guard.
  if (surface.value === ex.surface) return null;
  const kana = apply(r, ex.kana, ex.cls);
  return {
    lemma: ex.surface,
    kana: ex.kana,
    form: surface.value,
    kanaForm: kana.ok ? kana.value : surface.value,
  };
}
