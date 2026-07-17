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

import { apply } from "./apply.ts";
import type { Host, Recipe } from "../../data/grammar/recipes.ts";
import type { WordClass } from "../conjugate/index.ts";

/** The word each host is demonstrated on, and its class. Noun class is null. */
const EXAMPLE: Record<Host, { word: string; cls: WordClass | null }> = {
  verb: { word: "行く", cls: "v5k-s" },
  "adj-i": { word: "高い", cls: "adj-i" },
  "adj-na": { word: "静か", cls: "adj-na" },
  noun: { word: "本", cls: null },
};

export interface BuiltRow {
  readonly recipe: Recipe;
  /** The word this row is demonstrated on. 行く */
  readonly on: string;
  /** The pattern built out on `on`. 行かなければならない */
  readonly built: string;
  /**
   * The build, spelled out: base form, the trim if any, the suffix.
   * 行かない − い + ければならない
   */
  readonly how: string;
  /**
   * Can a worked example show the whole pattern? False for the DISCONTINUOUS
   * ones — see `discontinuous`.
   */
  readonly complete: boolean;
}

/**
 * Does this pattern have a slot in the MIDDLE of it?
 *
 * 〜 is the placeholder for the thing a pattern attaches to. A leading one is
 * the normal case and means "hangs off a word". A SECOND one means the pattern
 * wraps around something: 〜は〜より is two particles with the compared thing
 * between them. A Recipe is one host and one suffix, so `apply()` can only ever
 * produce 本は — the first half. Printing that under a column headed "Form",
 * beside a gloss reading "X is more … than Y", teaches that 本は means that. It
 * does not.
 *
 * WHY THE TEST IS THIS AND NOT "DOES THE OUTPUT CONTAIN THE PATTERN"
 * =================================================================
 * That was the first version and it was wrong twice over, because a `pattern`
 * is DISPLAY TEXT, not a string the output is obliged to contain:
 *
 *   〜そう (様態) carries a parenthetical that disambiguates it from 〜そうだ
 *   (伝聞). It is an annotation for a human. No conjugation ever emits "(様態)".
 *
 *   〜られる (可能) is a CITATION form. The potential of 行く is 行ける — no
 *   られる anywhere in it, and correctly so.
 *
 * Both are perfectly good rows, and both got flagged as broken. The structural
 * fact worth testing is the one the model genuinely cannot express, and that is
 * the middle slot — nothing else.
 */
function discontinuous(pattern: string): boolean {
  return pattern.indexOf("〜", 1) > 0;
}

/**
 * A cluster member's row, or null if it cannot be shown.
 *
 * Null is a refusal from the engine or a host this file has no example for, and
 * it propagates as a VALUE for the same reason apply() does: a recipe that will
 * not build on a given word is a normal outcome, not an exception. The caller
 * drops the row rather than crashing the page.
 */
export function buildRow(r: Recipe): BuiltRow | null {
  const at = r.attach[0];
  if (!at) return null;
  const ex = EXAMPLE[at.host];
  const out = apply(r, ex.word, ex.cls);
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
      { ...r, except: undefined, attach: [{ ...at, add: "", trim: undefined }] },
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

  return {
    recipe: r,
    on: ex.word,
    built: out.value,
    how,
    complete: !discontinuous(r.pattern),
  };
}

/** Every member that can be shown, in the cluster's order. */
export function buildRows(members: readonly Recipe[]): BuiltRow[] {
  return members.flatMap((r) => {
    const row = buildRow(r);
    return row ? [row] : [];
  });
}

/** The distinct words a set of rows is built on, in first-seen order. */
export function wordsUsed(rows: readonly BuiltRow[]): string[] {
  return [...new Set(rows.map((r) => r.on))];
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
