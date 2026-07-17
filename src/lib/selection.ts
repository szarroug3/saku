// Selection — turning a QUESTION into the facts it names.
//
// This replaced src/components/home/selection.ts, whose union-dedupe algebra
// was genuinely elegant and whose premise died. That file's ONE IDEA was "a
// card does not own a selection, it DESCRIBES one — the selection itself is
// cfg.enabled, a flat char→bool map". Union and dedup were free because a map
// cannot hold a key twice. All true, and all of it rests on there being few
// enough things that a map with one key per thing is a sensible object to keep
// in localStorage and rewrite on every click. At 21,449 that stops being true
// twice over — 400KB per toggle, and a gesture (tick what you want) that no
// human will perform 21,449 times.
//
// So: a selection is a QUERY. It is a fixed handful of fields regardless of how
// much material exists, and the facts are computed on demand rather than stored.
// Union and dedup are still free — resolve() ends in a Set — but now so is
// scale, and so is Rerun (a past session is just another filter; see
// Selection.session).
//
// Pure by contract: no React, no DOM, no fetch. Everything here is a function
// of (query, history, lists) and nothing else.

import { LOOKALIKES, kanaEntry } from "@/data/characters";
import { CONFUSABLE_WITH } from "@/data/confusable";
import { kanjiEntry } from "@/data/kanji";
import { accuracyOf } from "@/lib/accuracy";
import { ALL_FACTS, entryOf, factInfo, factsOf } from "@/lib/facts";
import type {
  AccuracyMetric,
  FactId,
  FactBand,
  HistoryFile,
  SavedList,
  Selection,
} from "@/types";

/** Everything. Every field empty means "not narrowed", so this is the query
 * that names the whole app — which is also the day-one default. */
export function emptySelection(): Selection {
  return {
    subjects: [],
    list: null,
    states: [],
    text: "",
    session: null,
  };
}

/** True when the query narrows nothing — used to say "Everything" rather than
 * printing a filter list that is empty. */
export function isEverything(sel: Selection): boolean {
  return (
    !sel.subjects.length &&
    !sel.list &&
    !sel.states.length &&
    !sel.text.trim() &&
    sel.session === null
  );
}

// ---------- how well you know something ----------

/**
 * The band a fact is in, as a WORD.
 *
 * The user never sees a probability, a stability, or the word "fact". They see
 * New / Shaky / Slipping / Solid, because those are things a person can mean
 * about their own memory. This function is the ONLY place numbers become words.
 *
 * THE THRESHOLDS ARE A STUB AND ARE MARKED AS ONE. Real scheduling — the rank
 * over (stability, lastTested, now) that decks.ts's `weakestFacts` also says is
 * coming — lives on another branch and is not in this base. It was not
 * reimplemented here; when it lands, `bandOf` and `rank` below are the two
 * functions it replaces, and nothing else in the app reads an accuracy to
 * decide what to drill. Today the bands are accuracy cuts, which is honest for
 * what it is: a coarse answer computed from the only signal on disk.
 */
export function bandOf(
  fact: FactId,
  history: HistoryFile,
  metric: AccuracyMetric,
): Exclude<FactBand, "mixup"> {
  const agg = history.facts[fact];
  if (!agg?.seen) return "new";
  const acc = accuracyOf(agg, metric);
  if (acc === null) return "new";
  if (acc < 60) return "shaky";
  if (acc < 85) return "slipping";
  return "solid";
}

/**
 * Every ENTRY involved in a measured mix-up, plus the predicted lookalikes.
 *
 * Separate from `bandOf` because it is not on the same axis: a fact you mix up
 * can be solid, shaky or new. That is exactly why Selection.states is a SET
 * that ORs rather than one value that partitions — "Mix-ups" is a different
 * question from "Shaky", and the answer to both can be yes.
 */
function mixedUpEntries(history: HistoryFile): Set<string> {
  const out = new Set<string>();
  for (const session of history.sessions) {
    for (const [fact, d] of Object.entries(session.detail ?? {})) {
      for (const [other, n] of Object.entries(d.confused ?? {})) {
        if (!n) continue;
        out.add(entryOf(fact as FactId));
        out.add(other);
      }
    }
  }
  // Day one there are no measured mix-ups, and a chip that selects nothing
  // until you have already made the mistake is a chip that looks broken. Fall
  // back to the PREDICTED lookalikes, same fallback (and same sources) as
  // decks.confusionDecks. The UI must not claim a count you never produced —
  // that is why `fromHistory` exists over there — but for SELECTING, "things
  // you are likely to mix up" is a useful answer on day one.
  if (!out.size) {
    for (const glyph of CONFUSABLE_WITH.keys()) {
      const facts = factsOf(kanjiEntry(glyph));
      if (facts.length) out.add(entryOf(facts[0]));
    }
    for (const group of LOOKALIKES) {
      for (const c of group) {
        const facts = factsOf(kanaEntry(c));
        if (facts.length) out.add(entryOf(facts[0]));
      }
    }
  }
  return out;
}

/** Does `fact` match ANY of the selected bands? */
function matchesStates(
  fact: FactId,
  states: FactBand[],
  history: HistoryFile,
  metric: AccuracyMetric,
  mixups: Set<string>,
): boolean {
  if (!states.length) return true;
  if (states.includes("mixup") && mixups.has(entryOf(fact))) return true;
  return states.includes(bandOf(fact, history, metric));
}

// ---------- text ----------

/**
 * Free-text match: the glyph, any accepted answer, or the meaning.
 *
 * Substring, case-folded, and nothing cleverer. It finds し by "shi", 生 by
 * "life", 先生 by "teacher" and by "せんせい". It does NOT find 読む by
 * "読んで" — deconjugation machinery does not exist, and that is the most
 * useful search a textbook reader would run. Flagged rather than faked: a
 * search that silently guessed at stems would be wrong in a way you could not
 * see.
 */
function matchesText(fact: FactId, needle: string): boolean {
  if (!needle) return true;
  const info = factInfo(fact);
  if (!info) return false;
  const n = needle.toLowerCase();
  if (info.glyph.toLowerCase().includes(n)) return true;
  if (info.meaning?.toLowerCase().includes(n)) return true;
  return info.answers.some((a) => a.toLowerCase().includes(n));
}

// ---------- lists ----------

/**
 * The facts a saved list names.
 *
 * The two kinds diverge here and ONLY here, which is the point of the split.
 * A fixed list stores entries and expands them to facts; a derived list stores
 * a rule and re-runs it. Both come out as FactId[] and no caller can tell which
 * it asked.
 *
 * `depth` stops a derived list whose query names a derived list whose query
 * names it back. Nothing in the UI can build that cycle today — you cannot save
 * a search that references a list — but resolve() is public and the failure
 * mode of a cycle is a locked tab, not a wrong answer, so it is guarded rather
 * than argued about.
 */
function factsOfList(
  id: string,
  lists: SavedList[],
  history: HistoryFile,
  metric: AccuracyMetric,
  depth: number,
): FactId[] {
  const list = lists.find((l) => l.id === id);
  if (!list || depth > 4) return [];
  if (list.kind === "fixed") {
    return list.entries.flatMap((e) => factsOf(e));
  }
  return resolve(list.query, history, lists, metric, depth + 1);
}

// ---------- ordering ----------

/**
 * The whole pool, in RANDOM order.
 *
 * THIS IS A REVIEW SCREEN, AND THAT IS WHY IT IS RANDOM. resolve() used to end
 * in `rank` — a weakness sort, "hardest first" — and on a custom-drill screen
 * that is an autopilot pitfall: the same worst items in the same order every
 * time. Shuffling instead means two drills of the same query meet the pool in a
 * different order, so nothing gets memorised as a running order.
 *
 * It no longer TRUNCATES. "How many" used to be a second cap here (a random
 * sample of `n`), and there were then two controls that both capped a run — a
 * selection limit and the session's Length — which could disagree. The count is
 * now Length's alone (see quiz-options.tsx → budget.ts); this step only orders,
 * and hands the WHOLE selection to the budget so it can pick the session from
 * everything you named rather than from a pre-truncated slice of it.
 *
 * This does NOT touch the learning loop's ranking. The weakness model — the
 * 4·p·(1-p) rank in src/lib/scoring.ts that src/lib/budget.ts consumes — is the
 * product and stays exactly as it was: the session it builds still probes your
 * weakest first. resolve() only decides the POOL and its order; budget.ts
 * decides the session.
 */
function shuffled(facts: FactId[]): FactId[] {
  const out = facts.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- resolve ----------

/**
 * The facts you have a knowledge base for: anything you've seen at least once,
 * or claimed to know. This — not the whole 21,000-entry dictionary — is what an
 * un-narrowed drill selection means.
 *
 * "Everything" on a REVIEW screen is everything you know, not every character
 * the app ships. Untaught material is not drillable here; it is learned through
 * the lesson loop (see src/lib/budget.ts), which draws new material one group at
 * a time. The "New" band still surfaces genuinely-new-but-touched items, because
 * a fact you've seen once with no settled accuracy has `seen ≥ 1` and so is in
 * this pool while still reading as New (see bandOf).
 *
 * Day one this is empty: a brand-new user knows nothing, so an un-narrowed
 * selection names zero things. That is correct — the custom drill screen is for
 * slicing a knowledge base you already have — and whatSentence renders it
 * honestly as "Nothing selected" rather than inventing a fake empty state.
 */
function knownFacts(history: HistoryFile): FactId[] {
  const claims = history.claims ?? {};
  return ALL_FACTS.filter(
    (f) => (history.facts[f]?.seen ?? 0) > 0 || f in claims,
  );
}

/**
 * THE ONE FUNCTION. A query in, the facts it names out.
 *
 * Every field NARROWS — they intersect, they do not union — so an un-narrowed
 * Selection is everything you know (see knownFacts) and each populated field is
 * a cut. The exception is `states`, which ORs internally (see matchesStates)
 * because its members are not alternatives to each other.
 *
 * Dedup is free, exactly as it was under cfg.enabled and for the same reason:
 * this ends in a Set. Two overlapping filters cannot yield a fact twice.
 *
 * The result is the WHOLE named pool in RANDOM order (see shuffled) — this is a
 * review surface, not the learning loop. It does not cap: the count is Length's
 * job (budget.ts), and this hands it the full selection.
 */
export function resolve(
  sel: Selection,
  history: HistoryFile,
  lists: SavedList[] = [],
  metric: AccuracyMetric = "firstTry",
  depth = 0,
): FactId[] {
  // The starting pool: a list if one is named, otherwise everything you know.
  // NOT the whole dictionary — untaught material is learned, not drilled here.
  let pool: FactId[] = sel.list
    ? factsOfList(sel.list, lists, history, metric, depth)
    : knownFacts(history);

  if (sel.session !== null) {
    const record = history.sessions.find((s) => s.ts === sel.session);
    // A session that is gone names nothing, rather than everything. Rerunning a
    // deleted session must give you an empty selection you can see, not the
    // whole dictionary.
    const inSession = new Set<string>(Object.keys(record?.facts ?? {}));
    pool = pool.filter((f) => inSession.has(f));
  }

  const subjects = new Set(sel.subjects);
  const needle = sel.text.trim().toLowerCase();
  const mixups = sel.states.includes("mixup")
    ? mixedUpEntries(history)
    : new Set<string>();

  const out = new Set<FactId>();
  for (const f of pool) {
    if (subjects.size) {
      const info = factInfo(f);
      if (!info || !subjects.has(info.subject)) continue;
    }
    if (!matchesText(f, needle)) continue;
    if (!matchesStates(f, sel.states, history, metric, mixups)) continue;
    out.add(f);
  }

  // The whole named pool, in random order (see shuffled). The count is applied
  // later, once, by the budget from Length — never here.
  return shuffled([...out]);
}

/**
 * How many facts a query names, without building the list twice.
 *
 * Thin on purpose. It exists so the count in the drill bar and the facts Start
 * hands to the quiz are computed by the same code — the old start bar carried a
 * comment about exactly this ("`count` is passed in rather than derived from
 * the labels… the names are a summary and are allowed to blur; the number never
 * is") and it stays true here.
 *
 * resolve() now returns the whole pool in random order, so the number never
 * blurs at all: it is the pool size, independent of the order the draw put it
 * in. Two calls disagree on the ORDER, never on how many.
 */
export function countOf(
  sel: Selection,
  history: HistoryFile,
  lists: SavedList[] = [],
  metric: AccuracyMetric = "firstTry",
): number {
  return resolve(sel, history, lists, metric).length;
}

// ---------- naming a selection ----------

/** The subject words, in the order a person would say them. */
const SUBJECT_WORD: Record<string, string> = {
  kana: "Kana",
  kanji: "Kanji",
  word: "Words",
  grammar: "Grammar",
};

const STATE_WORD: Record<FactBand, string> = {
  new: "New",
  shaky: "Shaky",
  slipping: "Slipping",
  solid: "Solid",
  mixup: "Mix-ups",
};

export function subjectWord(id: string): string {
  return SUBJECT_WORD[id] ?? id;
}

export function stateWord(s: FactBand): string {
  return STATE_WORD[s];
}

/**
 * What you are about to drill, as a sentence.
 *
 * The count is passed in rather than derived, and it is the load-bearing half:
 * the names summarise and are allowed to blur, the number never is. Same
 * contract the old whatSentence had, and the one thing worth keeping from it.
 *
 * Says "things", not "facts" and not "characters". "Characters" was a lie the
 * moment a selection could hold 生's nine readings — nine things, one character
 * — and "facts" is our word for it, not the user's.
 */
export function whatSentence(
  sel: Selection,
  count: number,
  lists: SavedList[] = [],
): string {
  if (!count) return "Nothing selected";
  const bits: string[] = [];

  if (sel.list) {
    const list = lists.find((l) => l.id === sel.list);
    if (list) bits.push(list.name);
  }
  if (sel.session !== null && !sel.list) bits.push("That session");
  for (const s of sel.subjects) bits.push(subjectWord(s));
  if (sel.states.length) bits.push(sel.states.map(stateWord).join(" or "));
  if (sel.text.trim()) bits.push(`“${sel.text.trim()}”`);

  // Un-narrowed names your whole knowledge base, so say so: "Everything you
  // know", not "Everything" — the pool is what you've seen or claimed, never the
  // untaught rest of the dictionary (see knownFacts).
  const head = bits.length ? bits.join(" · ") : "Everything you know";
  return `${head} · ${count.toLocaleString()} thing${count === 1 ? "" : "s"}`;
}

/** Every subject that has any material, in registry order — the subject chips
 * are data, not a hardcoded three. */
export function allSubjects(): string[] {
  const seen: string[] = [];
  for (const f of ALL_FACTS) {
    const s = factInfo(f)?.subject;
    if (s && !seen.includes(s)) seen.push(s);
  }
  return seen;
}
