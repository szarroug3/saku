// "How it's built", as a string, for the cluster page.
//
// The cluster page's middle column is the one thing on it that CANNOT BE WRONG,
// and that is the whole reason the column exists. It is not typed out: every
// cell is `apply()` run against a real word, so the 音便 and the suppletive
// stems and いい's よ- are already correct before this file is reached. If a row
// here is wrong, the engine is wrong, and 20,408 entries are wrong with it.
//
// WHY A FIXED EXAMPLE WORD PER HOST
// =================================
// A recipe attaches to a HOST (verb / adj-i / adj-na / noun), not to a word —
// see the Host doc in recipes.ts. So the page needs one word per host to show
// the pattern on, and it needs to be the SAME word down the column: the money
// shot of the obligation cluster is seven rows that differ only in their
// ending, and picking a different verb per row would hide the very thing the
// page is for.
//
// 行く is the plate's choice and it is a good one for a reason worth writing
// down: it is v5k-s, the one verb whose て-form is irregular (行って, not 行いて).
// A column built on 行く is a column that proves the engine did the hard case.

import { apply, applyWrap } from "./apply.ts";
import { exampleVerb, type Vehicle } from "./vehicles.ts";
import type { Attachment, Host, Recipe } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

interface Example {
  readonly word: string;
  readonly cls: WordClass | null;
  /** SAK-33: `word`'s reading, so a kanji-spelled example (高い, 本, 読む) can
   * gloss the cluster page's built form the way the rest of the app already
   * glosses a word beside its reading. Optional because a purely-kana example
   * (かう, たかい) has nothing to gloss. */
  readonly reading?: string;
}

/** A vehicle as this file's Example. The kana reading now rides along for two
 * reasons: the DRILL needs it to accept a kana answer, and (SAK-33) the
 * cluster page's built column needs it to gloss a kanji-spelled verb (読む,
 * 行く) the built row is shown on. */
function asExample(v: Vehicle): Example {
  return { word: v.surface, cls: v.cls, reading: v.kana };
}

/**
 * The word each host is demonstrated on, and its class. Noun class is null.
 *
 * THE VERB ROW IS NOT HERE. A recipe may refuse 行く — 〜てある wants a verb
 * somebody does to something, 〜に行く refuses going as its own errand — and a
 * cell that conjugates correctly into Japanese nobody says breaks this column's
 * promise exactly as a bad 音便 would. So the verb is `exampleVerb`'s answer,
 * asked per recipe, and it is the SAME answer the baked production fact and the
 * entry page's worked line get. See vehicles.ts.
 */
const EXAMPLE: Record<Exclude<Host, "verb">, Example> = {
  "adj-i": { word: "高い", cls: "adj-i", reading: "たかい" },
  "adj-na": { word: "静か", cls: "adj-na", reading: "しずか" },
  noun: { word: "本", cls: null, reading: "ほん" },
};

/**
 * The word the CLOSING slot of a wrap is demonstrated on.
 *
 * A second word per host, and it has to exist: 〜は〜より needs two nouns, and
 * building it on 本 twice would print 本は本より — a sentence about how a book
 * exceeds itself, offered as the worked example of "X is more … than Y".
 *
 * This does not undercut the same-word-down-the-column argument above. That
 * argument is about the difference between ROWS, and it still holds: every
 * opening slot on a page is still 行く or still 本, so the column still differs
 * only in its pattern. A second slot needs a second word by construction.
 *
 * 読む is the verb, chosen the way 行く was: it is v5m, so its た-form is 読んだ
 * (not 読みた) and its ない is 読まない. A 〜たり〜たり row built on 行く and 読む
 * is 行ったり読んだりする — two different 音便 in one cell, both from the engine.
 */
const CLOSING_EXAMPLE: Record<Host, Example> = {
  verb: { word: "読む", cls: "v5m", reading: "よむ" },
  "adj-i": { word: "安い", cls: "adj-i", reading: "やすい" },
  "adj-na": { word: "便利", cls: "adj-na", reading: "べんり" },
  noun: { word: "車", cls: null, reading: "くるま" },
};

export interface BuiltRow {
  readonly recipe: Recipe;
  /**
   * The host this row demonstrates. A pattern with two of them gets two rows.
   *
   * Here because the page keys its rows on something, and the recipe id stopped
   * being unique the moment 〜すぎる printed twice.
   */
  readonly host: Host;
  /**
   * The words this row is demonstrated on, in slot order. [行く], or [本, 車]
   * for a wrap.
   *
   * A list rather than a word because the page prints "built on …" underneath,
   * and a wrap row built on 本 and 車 that claimed to be built on 本 would be a
   * small lie on the one page whose whole promise is that it cannot be wrong.
   */
  readonly on: readonly string[];
  /** The pattern built out on `on`. 行かなければならない */
  readonly built: string;
  /**
   * `built`'s reading, when every example word `on` is drawn from carries one
   * (SAK-33). Computed by running the SAME recipe through the SAME engine on
   * the examples' READINGS instead of their surface spellings — apply()/
   * applyWrap() are driven by `cls`, not by the string's script, so
   * よむ + cls v5m builds よんで exactly as 読む + v5m builds 読んで. Absent, not
   * guessed, when a slot's example has no reading on file or the reading
   * build disagrees with the surface build (same-length, same-shape check as
   * `built` itself gets from applyWrap below).
   */
  readonly builtReading?: string;
  /**
   * The build, spelled out: base form, the trim if any, the suffix.
   * 行かない − い + ければならない
   */
  readonly how: string;
}

/**
 * THERE IS NO `complete` FLAG ANY MORE, AND ITS ABSENCE IS THE FIX.
 *
 * This file used to carry one, set by sniffing the `pattern` string for a
 * second 〜 and meaning "a worked example cannot show the whole of this". The
 * cluster page read it and printed the bare pattern instead of a half-built
 * 本は, which was the honest thing to do with a model that could only reach
 * halfway.
 *
 * That flag was a workaround for a gap in recipes.ts, kept in the display
 * layer, and reading DISPLAY TEXT to recover a STRUCTURAL fact was the tell —
 * the same sniff nearly flagged 〜そう (様態) and 〜られる (可能), whose extra
 * characters are annotations for a human rather than slots. Now that a Recipe
 * has `wrap`, the structure is in the data where it belongs, every row builds
 * whole, and there is nothing left for a flag to say.
 */

/** One half of a pattern, built on one word, with its build spelled out. */
function buildHalf(
  r: Recipe,
  half: readonly Attachment[],
  ex: Example,
): { built: string; how: string } | null {
  const at = half[0];
  if (!at) return null;

  // A probe carrying ONE half and no wrap, so apply() sees an ordinary recipe.
  // Same idiom as the base probe below, and load-bearing for the same reason:
  // apply() refuses a wrap outright, which is exactly what protects every other
  // caller and exactly what this caller has to step around on purpose.
  const asHalf = (a: readonly Attachment[]): Recipe => ({ ...r, wrap: undefined, attach: a });

  const out = apply(asHalf(half), ex.word, ex.cls);
  if (!out.ok) return null;

  // The base the suffix hangs off — the bare word when form is null (the noun
  // rows), otherwise the conjugated form. Rebuilt rather than plucked out of
  // apply(), which returns only the finished string.
  //
  // `except: undefined` on the probe is load-bearing and cost an hour of
  // squinting at 降りそう: apply() resolves the suffix through `except` BEFORE
  // the attachment's own `add`, so a stripped-down `add: ""` is ignored on the
  // one recipe that carries an exception, and the "base" comes back with the
  // suffix still on it. The probe wants the FORM and nothing else, so it must
  // silence every source of a suffix, not just the one it can see.
  let base = ex.word;
  if (at.form !== null) {
    const b = apply(
      { ...asHalf([{ ...at, add: "", trim: undefined }]), except: undefined },
      ex.word,
      ex.cls,
    );
    if (!b.ok) return null;
    base = b.value;
  }

  const add = out.value.slice(base.length - (at.trim?.length ?? 0));

  // NOTHING IS ADDED, and that is a real case, not an oversight. For 〜ば,
  // 〜たら, the potential and bare 〜て the pattern IS a form the engine already
  // produces — `add` is "" and there is no suffix to show. The first cut
  // printed "行けば + " with an empty right-hand side, which reads as a bug on a
  // page whose entire promise is that this column cannot be wrong.
  //
  // So the degenerate row says the true thing instead: 行く → 行けば. No suffix,
  // just the form, and the arrow is doing the work the + cannot.
  const how =
    add === ""
      ? base === ex.word
        ? base
        : `${ex.word} → ${base}`
      : at.trim
        ? `${base} − ${at.trim} + ${add}`
        : `${base} + ${add}`;

  return { built: out.value, how };
}

/**
 * A cluster member's row for ONE host, or null if it cannot be shown.
 *
 * Null is a refusal from the engine or a host this file has no example for, and
 * it propagates as a VALUE for the same reason apply() does: a recipe that will
 * not build on a given word is a normal outcome, not an exception. The caller
 * drops the row rather than crashing the page.
 *
 * `host` omitted means the recipe's FIRST attachment, which is what this
 * function used to hardcode — and hardcoding it was a bug on the one page whose
 * stated promise is that its middle column cannot be wrong. 〜すぎる attaches to
 * a verb, an い-adjective and a な-adjective; the page printed 行きすぎる and
 * stopped. Every cell was true and the column as a whole said something false —
 * that 〜すぎる is a verb pattern. A true row implying a false whole breaks the
 * promise just as a wrong cell would, so `buildRows` now emits one row per host.
 *
 * A WRAP BUILDS WHOLE OR NOT AT ALL. Both halves go through the same code on
 * two different words, and the row is the two halves joined — 本は車より, not
 * 本は with the rest left to the reader's imagination.
 */
/** `ex`'s build, read through the same recipe/half but on its READING instead
 * of its surface spelling — apply()/applyWrap() are driven by `cls`, not by
 * the string's script, so this reuses the identical engine call rather than
 * a hand-typed second answer (SAK-33). null when `ex` carries no reading to
 * build from. */
function buildHalfReading(
  r: Recipe,
  half: readonly Attachment[],
  ex: Example,
): string | null {
  if (!ex.reading) return null;
  const out = buildHalf(r, half, { word: ex.reading, cls: ex.cls });
  return out?.built ?? null;
}

export function buildRow(r: Recipe, host?: Host): BuiltRow | null {
  const at = host ? r.attach.find((a) => a.host === host) : r.attach[0];
  if (!at) return null;
  const ex = at.host === "verb" ? asExample(exampleVerb(r)) : EXAMPLE[at.host];
  // Only the named host's attachment goes in, or apply() would resolve the
  // recipe by the WORD's class and hand back the first-listed host's build for
  // free — which is precisely how one row came to stand for three.
  const half = [at];
  const open = buildHalf(r, half, ex);
  if (!open) return null;
  const openReading = buildHalfReading(r, half, ex);

  if (!r.wrap) {
    return {
      recipe: r,
      host: at.host,
      on: [ex.word],
      built: open.built,
      builtReading: openReading ?? undefined,
      how: open.how,
    };
  }

  const ct = r.wrap.close[0];
  if (!ct) return null;
  const cex = CLOSING_EXAMPLE[ct.host];
  const close = buildHalf(r, r.wrap.close, cex);
  if (!close) return null;

  // Cross-check against the real two-word path rather than trusting that
  // joining two halves reproduces it. If these ever disagree the page is
  // showing something applyWrap would not build, and the page's one promise is
  // that this column cannot be wrong.
  const whole = applyWrap(r, ex.word, ex.cls, cex.word, cex.cls);
  if (!whole.ok || whole.value !== open.built + close.built) return null;

  // The reading side gets the identical cross-check, and on its own terms: a
  // reading whole that does not equal its own two reading halves joined is
  // refused (undefined) rather than shown half-trusted, the same honesty the
  // surface build demands of itself just above.
  const closeReading = buildHalfReading(r, r.wrap.close, cex);
  const wholeReading =
    ex.reading && cex.reading ? applyWrap(r, ex.reading, ex.cls, cex.reading, cex.cls) : null;
  const builtReading =
    wholeReading?.ok && openReading !== null && closeReading !== null &&
    wholeReading.value === openReading + closeReading
      ? wholeReading.value
      : undefined;

  return {
    recipe: r,
    host: at.host,
    on: [ex.word, cex.word],
    built: whole.value,
    builtReading,
    // Two builds, one per slot, in the order they appear in the string. The
    // separator is not a "+": these are not being concatenated into each other,
    // they are two independent attachments with a word between them.
    how: `${open.how} · ${close.how}`,
  };
}

const COUNT_WORD = [
  "",
  "The one",
  "The two",
  "The three",
  "The four",
  "The five",
  "The six",
  "The seven",
  "The eight",
  "The nine",
];

/** "The seven", "The four" — the plate's phrasing. Numerals past nine. */
export function countWord(n: number): string {
  return COUNT_WORD[n] ?? `The ${n}`;
}
