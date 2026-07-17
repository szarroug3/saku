// Applying a recipe to a word. The whole grammar layer's mechanism, and it is
// deliberately this small — the engine does the hard part.
//
// A recipe is a form name and a suffix, so applying one is: ask the engine for
// the form, trim, append. Everything difficult (音便, ある's suppletive
// negative, くる's paradigm, いい's よ-stem) already happened inside
// conjugate() and is not this file's business.
//
// Refusals propagate as VALUES, exactly as the engine does it. A recipe that
// cannot apply to a word is a normal, common, correct outcome — 〜てください
// does not apply to 高い — and callers enumerating thousands of (recipe, word)
// pairs must not need a try/catch.

import { conjugate, type ConjugateResult, type WordClass } from "../conjugate/index.ts";
import type { Attachment, Host, Recipe } from "../../data/grammar/recipes.ts";

/** Why a recipe would not apply. */
export type ApplyRefusal =
  /** The word's class isn't a host this recipe accepts (〜てください + 高い). */
  | "host-mismatch"
  /** The engine refused the underlying form. Its reason is carried in detail. */
  | "form-refused"
  /** The form came out not ending in the text the recipe wants to trim. */
  | "trim-mismatch"
  /**
   * One word was offered to a pattern that wraps around a slot. Use applyWrap.
   *
   * This is a REFUSAL and not a best effort, and that distinction was the whole
   * bug. Given 行く and 〜たり〜たり the old apply() returned 行ったり — true as
   * far as it went, and false as an answer to "give me the 〜たり〜たり form",
   * which is the exact prompt the production generator was building from it.
   * A caller with one word cannot be handed half a pattern to pass off as a
   * whole one, so it is handed nothing.
   */
  | "wrap-needs-two";

export type ApplyResult =
  | { ok: true; value: string }
  | { ok: false; reason: ApplyRefusal; detail: string };

/**
 * Which host does a JMdict conjugation class count as?
 *
 * The two axes are different questions — see the Host doc in recipes.ts. This
 * is the only place they meet, and it is a lookup rather than a heuristic so
 * that adding a class to the engine cannot silently change what a recipe
 * accepts.
 */
const HOST_OF_CLASS: Record<WordClass, Host> = {
  v5u: "verb",
  v5k: "verb",
  v5g: "verb",
  v5s: "verb",
  v5t: "verb",
  v5n: "verb",
  v5b: "verb",
  v5m: "verb",
  v5r: "verb",
  v5aru: "verb",
  "v5r-i": "verb",
  "v5k-s": "verb",
  "v5u-s": "verb",
  v1: "verb",
  "v1-s": "verb",
  "vs-i": "verb",
  "vs-s": "verb",
  vk: "verb",
  vz: "verb",
  "adj-i": "adj-i",
  "adj-ix": "adj-i", // いい/よい are い-adjectives; the class split is about their stem.
  "adj-na": "adj-na",
};

export function hostOfClass(cls: WordClass): Host {
  return HOST_OF_CLASS[cls];
}

/** The attachment for this host, out of one half's alternatives. */
function attachmentFor(half: readonly Attachment[], host: Host): Attachment | undefined {
  return half.find((a) => a.host === host);
}

/**
 * The suffix to append — the attachment's, unless an `except` row claims this
 * word. First match wins, so a `word` row must be listed before a `cls` row
 * that would also match it.
 *
 * One recipe uses this (sou-appearance's さ-insertion). If a second one ever
 * needs it, look hard at whether the recipe is really two recipes first.
 */
function suffixFor(r: Recipe, word: string, cls: WordClass, at: Attachment): string {
  const hit = r.except?.find((e) => (e.word ? e.word === word : e.cls === cls));
  return hit ? hit.add : at.add;
}

/**
 * Build ONE half of a recipe on one word.
 *
 * Both halves of a wrap are Attachments and both build the same way, so this is
 * the whole mechanism and `apply`/`applyWrap` are the two ways in. `r` is
 * carried only for its `pattern` (messages) and its `except` rows.
 */
function buildHalf(
  r: Recipe,
  half: readonly Attachment[],
  word: string,
  cls: WordClass | null,
): ApplyResult {
  const host: Host = cls === null ? "noun" : hostOfClass(cls);
  const at = attachmentFor(half, host);
  if (!at) {
    return {
      ok: false,
      reason: "host-mismatch",
      detail: `${r.pattern} takes ${half.map((a) => a.host).join("/")}, not ${host}.`,
    };
  }

  // form: null — attach to the bare word. Nouns, and the vacuous rows.
  if (at.form === null) return { ok: true, value: word + at.add };

  if (cls === null) {
    return {
      ok: false,
      reason: "host-mismatch",
      detail: `${r.pattern} wants the ${at.form} form, and a noun has none.`,
    };
  }

  const base: ConjugateResult = conjugate(word, cls, at.form);
  if (!base.ok) {
    return { ok: false, reason: "form-refused", detail: `${at.form}: ${base.detail}` };
  }

  const add = suffixFor(r, word, cls, at);

  if (at.trim) {
    if (!base.value.endsWith(at.trim)) {
      return {
        ok: false,
        reason: "trim-mismatch",
        detail: `${at.form} of ${word} is '${base.value}', which doesn't end with '${at.trim}'.`,
      };
    }
    return { ok: true, value: base.value.slice(0, -at.trim.length) + add };
  }
  return { ok: true, value: base.value + add };
}

/**
 * Build `recipe` on `word`.
 *
 * `cls` is a JMdict `<pos>` tag verbatim, as the engine takes it. Pass the
 * `noun` host by giving cls = null: a noun has no conjugation class, which is
 * precisely why noun-host recipes are the vacuous ones.
 *
 * REFUSES a wrap. One word cannot fill two slots, and the honest answer to
 * "build 〜は〜より on 本" is not 本は — see the `wrap-needs-two` doc. Callers
 * that have two words call `applyWrap`; callers that have one get a refusal
 * they already know how to handle, which is why this is safe to tighten.
 */
export function apply(r: Recipe, word: string, cls: WordClass | null): ApplyResult {
  if (r.wrap) {
    return {
      ok: false,
      reason: "wrap-needs-two",
      detail: `${r.pattern} wraps around a slot and needs two words, not one.`,
    };
  }
  return buildHalf(r, r.attach, word, cls);
}

/**
 * Build a WRAP on its two words, in order: opening slot, then closing slot.
 *
 * 〜は〜より on (本, 車) is 本は車より. 〜しか〜ない on (本, 読む) is 本しか読まない
 * — note the second word conjugates and the first does not, which is why each
 * half carries its own host and form.
 *
 * The two slots are NOT interchangeable in general, and this function does not
 * pretend otherwise: it fills them in the order given. For the patterns where
 * they ARE interchangeable that is a reason not to ASK the question, not a
 * reason to build the string differently — see isOrderFree in recipes.ts.
 */
export function applyWrap(
  r: Recipe,
  open: string,
  openCls: WordClass | null,
  close: string,
  closeCls: WordClass | null,
): ApplyResult {
  if (!r.wrap) {
    return {
      ok: false,
      reason: "host-mismatch",
      detail: `${r.pattern} is not a wrap; it takes one word.`,
    };
  }
  const a = buildHalf(r, r.attach, open, openCls);
  if (!a.ok) return a;
  const b = buildHalf(r, r.wrap.close, close, closeCls);
  if (!b.ok) return b;
  return { ok: true, value: a.value + b.value };
}

/**
 * Can this recipe apply to this class at all? Cheap host test, no building.
 *
 * Asks about the OPENING half, which is the slot a caller enumerating words is
 * choosing for. A wrap's closing host is a separate question and applyWrap is
 * where it gets asked.
 */
export function accepts(r: Recipe, cls: WordClass | null): boolean {
  return attachmentFor(r.attach, cls === null ? "noun" : hostOfClass(cls)) !== undefined;
}
