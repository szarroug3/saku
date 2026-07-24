// Practice types — the finer-than-subject axis the Practice page's TYPE chooser
// offers, and the join from (types, scope) to the facts a drill runs.
//
// A SUBJECT is what minted a fact (facts.ts: kana, radical, kanji, word,
// grammar, transitivity, keigo). A TYPE is what a learner would name when they
// say "drill my katakana", and it is finer than the subject in two places:
//
//   - `kana` splits into HIRAGANA and KATAKANA, by the script of the glyph.
//   - `word` splits into WORDS and COUNTERS. The counters track is vocab with a
//     track label (COUNTERS_SUBJECT === "word"); COUNTER_ENTRIES is that label.
//
// Every other type is its subject one-to-one. So a type is a PREDICATE over a
// fact, not a field stored on one — factType() computes it, nothing persists it.
// This is deliberately the same shape `subjects` already had (an id list that
// NARROWS, empty = all); types just cut finer where a subject bundles two things
// a person keeps apart.
//
// SCOPE is the orthogonal axis Practice already had, expressed entirely in the
// existing Selection fields so this module invents no second definition of
// "known" or "shaky":
//
//   everything .. the known pool (no state/list/session/text narrowing).
//   shaky ....... SHAKY_BANDS — the bands that need work (see practice-presets).
//   custom ...... a manual selection: a saved list, a rerun, or a text search.
//
// scopeOf() reads the scope OFF a Selection; withScope() writes it BACK, always
// carrying the chosen types through. resolve() (selection.ts) then turns the
// Selection into facts against the real knowledge base and applies matchesTypes,
// so the drill is exactly types ∩ scope — the chosen types AND within the chosen
// scope, nothing else.

import { COUNTER_ENTRIES } from "@/data/counters";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { SHAKY_BANDS, shakySelection } from "@/lib/practice-presets";
import { emptySelection } from "@/lib/selection-empty";
import type { FactId, Selection } from "@/types";

// ---------- the type descriptors ----------

export interface PracticeType {
  /** Stable id stored in Selection.types. */
  readonly id: string;
  /** What the chooser chip says. */
  readonly label: string;
  /** A representative glyph for the chip. */
  readonly glyph: string;
}

/**
 * Every practice type, in the order the chooser shows them — reading roughly
 * from the smallest building blocks (kana) up to the most composed (keigo). The
 * ids are the vocabulary of Selection.types; the labels are the only thing a
 * learner reads.
 */
export const PRACTICE_TYPES: readonly PracticeType[] = [
  { id: "hiragana", label: "Hiragana", glyph: "あ" },
  { id: "katakana", label: "Katakana", glyph: "ア" },
  { id: "radical", label: "Radicals", glyph: "氵" },
  { id: "kanji", label: "Kanji", glyph: "字" },
  { id: "word", label: "Words", glyph: "語" },
  { id: "counter", label: "Counters", glyph: "本" },
  { id: "grammar", label: "Grammar", glyph: "文" },
  { id: "transitivity", label: "Verb pairs", glyph: "動" },
  { id: "keigo", label: "Keigo", glyph: "敬" },
];

const LABEL_BY_ID = new Map(PRACTICE_TYPES.map((t) => [t.id, t.label]));

/** The chip label for a type id, or the raw id for one this module doesn't
 * name (so a stored id from a later build renders as itself, never blank). */
export function typeLabel(id: string): string {
  return LABEL_BY_ID.get(id) ?? id;
}

// ---------- classifying a fact ----------

// Script tests for the kana split. A kana entry is single-script (each glyph is
// wholly hiragana or wholly katakana, yōon combos included), so one hit decides
// it. Katakana is checked first; anything else in the kana subject is hiragana.
const KATAKANA = /[゠-ヿㇰ-ㇿｦ-ﾝ]/u;

/**
 * The practice type a fact belongs to, or null when its data is gone.
 *
 * The one place a subject becomes a type. Two subjects fan out (kana → script,
 * word → counters vs words); the rest pass through as themselves. A lookup and
 * two set/regex checks — never a parse of the id.
 */
export function factType(id: FactId): string | null {
  const info = factInfo(id);
  if (!info) return null;
  switch (info.subject) {
    case "kana":
      return KATAKANA.test(info.glyph) ? "katakana" : "hiragana";
    case "word":
      return COUNTER_ENTRIES.has(entryOf(id)) ? "counter" : "word";
    default:
      return info.subject;
  }
}

/**
 * Does a fact match the chosen types? Empty `types` matches everything, exactly
 * as an empty `subjects` does — "no type chosen" means "all types", not "none".
 */
export function matchesTypes(id: FactId, types: readonly string[]): boolean {
  if (!types.length) return true;
  const t = factType(id);
  return t !== null && types.includes(t);
}

/**
 * The type ids that actually have material, in PRACTICE_TYPES order. Scanned
 * once from the registry and cached, so the chooser only ever offers types the
 * app can drill — it is data, not a hardcoded nine.
 */
let PRESENT: string[] | null = null;
export function availableTypes(): string[] {
  if (PRESENT === null) {
    const seen = new Set<string>();
    for (const f of ALL_FACTS) {
      const t = factType(f);
      if (t) seen.add(t);
    }
    PRESENT = PRACTICE_TYPES.map((t) => t.id).filter((id) => seen.has(id));
  }
  return PRESENT;
}

// ---------- the scope axis ----------

export type PracticeScope = "everything" | "shaky" | "custom";

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Which scope a Selection expresses. Read off the SAME fields resolve() reads,
 * so the label can never disagree with the pool: no state/list/session/text is
 * "everything I know"; exactly SHAKY_BANDS and nothing else is "just the shaky
 * ones"; anything else — a saved list, a rerun, a text search, some other band
 * — is a manual "pick what I want". Types are ignored here: they are the OTHER
 * axis, and a typed everything-pool is still an everything scope.
 */
export function scopeOf(sel: Selection): PracticeScope {
  const bare = !sel.list && sel.session === null && !sel.text.trim();
  if (bare && !sel.states.length) return "everything";
  if (bare && sameSet(sel.states, SHAKY_BANDS)) return "shaky";
  return "custom";
}

/**
 * The same Selection moved into a scope, carrying the chosen types through.
 *
 *   everything → the empty query (the whole known pool).
 *   shaky ....→ SHAKY_BANDS.
 *   custom ...→ keep whatever manual narrowing is set (list, rerun, text) but
 *              drop the shaky bands, since "pick what I want" is the pool the
 *              learner named, not a band filter.
 *
 * Types survive every switch — changing scope never silently discards the type
 * chooser, and vice versa.
 */
export function withScope(sel: Selection, scope: PracticeScope): Selection {
  switch (scope) {
    case "everything":
      return { ...emptySelection(), types: sel.types };
    case "shaky":
      return { ...shakySelection(), types: sel.types };
    case "custom":
      return {
        ...emptySelection(),
        types: sel.types,
        list: sel.list,
        session: sel.session,
        text: sel.text,
      };
  }
}

/** The same Selection with a different set of chosen types, scope untouched. */
export function withTypes(sel: Selection, types: string[]): Selection {
  return { ...sel, types };
}

/**
 * Drop any chosen type that has nothing to drill in the current scope. `present`
 * is the set of type ids that resolve to at least one fact right now (the caller
 * computes it the same way the chips get their counts). Switching scope runs
 * this so the selection can never carry a type whose count is 0: a chip that
 * greys out to "0" in the new scope is also, in the same move, UNSELECTED — the
 * footer and the drill both drop it, not just the styling. Returns the same
 * Selection untouched when every chosen type is still present, so a no-op switch
 * doesn't churn the object.
 */
export function pruneEmptyTypes(
  sel: Selection,
  present: ReadonlySet<string>,
): Selection {
  if (sel.types.every((t) => present.has(t))) return sel;
  return withTypes(
    sel,
    sel.types.filter((t) => present.has(t)),
  );
}

/**
 * The scope the chooser should SHOW, given the stored Selection and the scope
 * button the learner last pressed (their intent, or null for none yet).
 *
 * scopeOf() alone cannot tell "pick what I want, nothing chosen yet" apart from
 * "everything I know": a custom pool with no list, text or rerun is field-for-
 * field the empty query. So the moment the learner presses "pick what I want"
 * before naming a list, scopeOf still reads "everything", the custom button
 * never lights, and the panel that lets them pick never opens — the preset looks
 * broken. When the intent is custom and the selection has not yet grown a manual
 * narrowing, honour the intent so the panel opens. Any self-describing shape (a
 * list, the shaky bands) wins over a stale intent, because it names its own
 * scope.
 */
export function effectiveScope(
  sel: Selection,
  intent: PracticeScope | null,
): PracticeScope {
  const derived = scopeOf(sel);
  if (intent === "custom" && derived === "everything") return "custom";
  return derived;
}

/** Toggle one type id in a Selection's type set. */
export function toggleType(sel: Selection, id: string): Selection {
  const has = sel.types.includes(id);
  return withTypes(
    sel,
    has ? sel.types.filter((t) => t !== id) : [...sel.types, id],
  );
}
