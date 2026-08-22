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

import { activeWeaknessPairs } from "@/lib/confusions";
import { rangeLabel } from "@/lib/date-range";
import { knownConstructionFacts } from "@/data/counter-categories";
import {
  ALL_FACTS,
  entryOf,
  factInfo,
  factsOf,
} from "@/lib/facts";
import { matchesTypes, typeLabel } from "@/lib/practice-types";
import { standingOf } from "@/lib/library/standing";
import { quizzableFacts } from "@/lib/word-unlock";
import { effectiveState } from "@/lib/claims";
import { status } from "@/lib/scoring";
import type {
  FactId,
  FactBand,
  HistoryFile,
  SavedList,
  Selection,
} from "@/types";

// `emptySelection` lives in the DATA-FREE src/lib/selection-empty.ts so the
// always-mounted QuizConfigProvider can seed a config without importing this
// module's fact registry. Re-exported so this module's consumers are unchanged,
// and imported by name too so this module's own functions (dueFacts) can call it.
import { emptySelection } from "@/lib/selection-empty";
export { emptySelection };

/** True when the query narrows nothing — used to say "Everything" rather than
 * printing a filter list that is empty. */
export function isEverything(sel: Selection): boolean {
  return (
    !sel.subjects.length &&
    !sel.types.length &&
    !sel.list &&
    !sel.states.length &&
    !sel.text.trim() &&
    sel.session === null &&
    !(sel.learned && (sel.learned.from != null || sel.learned.to != null))
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
  now = Date.now(),
): Exclude<FactBand, "mixup"> {
  const standing = standingOf(
    history.facts[fact],
    history.claims?.[fact],
    now,
  ).standing;
  return standing === "not-seen" || standing === "claimed" ? "new" : standing;
}

/**
 * Every ENTRY in an active confusion pair — `activeWeaknessPairs` flattened to
 * the entries it names, nothing predicted or added on top.
 *
 * Separate from `bandOf` because it is not on the same axis: a fact you mix up
 * can be solid, shaky or new. That is exactly why Selection.states is a SET
 * that ORs rather than one value that partitions — "Mix-ups" is a different
 * question from "Shaky", and the answer to both can be yes.
 *
 * This is the canonical "currently confuses" set — the same one the Library's
 * mix-up filter reads (library-page.tsx's `activeMixupEntries`, doing this
 * same flatten by hand). resolve() below turns these ENTRIES into the FACTS
 * the pool actually contains, so the Practice "Mix-ups" chip's number is a
 * fact count, not a pair count: an entry can own many facts (a kanji carries
 * ~11, see facts.ts's `factsOf`), so it is routinely larger than the number
 * of pairs behind it. The Progress page's "Things you mix up" count
 * (stats/mix-ups.tsx) reads `activeWeaknessPairs` directly for exactly that
 * reason — it counts PAIRS, on purpose, and is spelled "N pairs" so it never
 * reads as the same number this produces (SAK-22).
 */
function mixedUpEntries(
  history: HistoryFile,
  graduateRuns: number,
): Set<string> {
  const out = new Set<string>();
  for (const pair of activeWeaknessPairs(history, graduateRuns, entryOf)) {
    out.add(pair.a);
    out.add(pair.b);
  }
  return out;
}

/** Does `fact` match ANY of the selected bands? */
function matchesStates(
  fact: FactId,
  states: FactBand[],
  history: HistoryFile,
  mixups: Set<string>,
  now: number,
): boolean {
  if (!states.length) return true;
  if (states.includes("mixup") && mixups.has(entryOf(fact))) return true;
  return states.includes(bandOf(fact, history, now));
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
    depth: number,
  context: { now?: number; graduateRuns?: number },
): FactId[] {
  const list = lists.find((l) => l.id === id);
  if (!list || depth > 4) return [];
  if (list.kind === "fixed") {
    return list.entries.flatMap((e) => factsOf(e));
  }
  return resolve(list.query, history, lists, depth + 1, context);
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
  // `seen` here is TWO different records that happen to share a word: the
  // aggregate's `seen` COUNT (times a session showed the fact) and the top-level
  // `seen` INTENT record (facts you pressed "quiz me" on but may not have
  // answered yet). Both put a fact in the knowledge base, and they must — a
  // group you asked to be quizzed on is drillable on your word, before the drill
  // that would give it a count has recorded anything.
  const seen = history.seen ?? {};
  // A kanji reading fact enters here through `seen` like anything else: teaching
  // the word that proves it writes the reading into the seen record (see the
  // words-track lesson handlers in page.tsx and readingsProvedBy in
  // word-unlock.ts), exactly as "quiz me" marks a kana group seen. So there is
  // no reading-specific branch here — a proved reading is seen material, and
  // that is the whole of it.
  const base = ALL_FACTS.filter(
    (f) => (history.facts[f]?.seen ?? 0) > 0 || f in claims || f in seen,
  );
  // A generative construction CATEGORY (〜本, the tens) becomes drillable the
  // moment its rule was TAUGHT — its counter:gen:* marker claimed (on Start) or
  // marked seen (on "Quiz me") — not when the category fact itself was answered
  // (it never is directly; the drill rolls a count for it). The marker is not the
  // fact, so this is the one join that turns a claimed marker into a known fact.
  // A category fact already in `base` (drilled at least once) is not added twice —
  // resolve() ends in a Set, so the union is free.
  return [...base, ...knownConstructionFacts(history)];
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
  depth = 0,
  context: { now?: number; graduateRuns?: number } = {},
): FactId[] {
  const now = context.now ?? Date.now();
  const graduateRuns = context.graduateRuns ?? 10;
  // A session that is gone names nothing, rather than everything. Rerunning a
  // deleted session must give you an empty selection you can see, not the
  // whole dictionary.
  const sessionFacts = (ts: number): FactId[] => {
    const record = history.sessions.find((s) => s.ts === ts);
    return Object.keys(record?.facts ?? {}) as FactId[];
  };

  // The starting pool: a list if one is named; otherwise, for a PURE session
  // query (Rerun — see "That session" in whatSentence, and results-view.tsx's
  // rerunFacts), the session's own recorded facts directly — every fact it put
  // on screen, answered or not, per session-record.ts's projectSessionFacts
  // ("a card put on screen but not yet resolved has seen === 0 here... that
  // is the point"). Narrowing that pool through knownFacts instead (as a plain
  // filter, below) used to mean a fact shown but never answered — never having
  // banked a seen count anywhere else — silently dropped out of its own
  // Rerun, which is exactly backwards: Rerun's whole premise is "what this
  // session put in front of you," not "of that, what you separately already
  // know." Otherwise (no session, or a list further narrowed BY a session),
  // fall back to knownFacts — the ordinary "everything you know" baseline.
  let pool: FactId[] = sel.list
    ? factsOfList(sel.list, lists, history, depth, context)
    : sel.session !== null
      ? sessionFacts(sel.session)
      : knownFacts(history);

  // A list ALSO narrowed to one session (not the common Rerun case, but a
  // real composition — see the module header's "session is just another
  // filter") still intersects, since the pool above came from the list, not
  // the session, in that combination.
  if (sel.list && sel.session !== null) {
    const inSession = new Set<string>(sessionFacts(sel.session));
    pool = pool.filter((f) => inSession.has(f));
  }

  // The date window, read STRAIGHT off the stored learnedAt map — no derivation
  // here, because the normalizers (Part A) guarantee learnedAt is populated on
  // every history the app reads. A one-sided window (from-only / to-only) is
  // honoured; an all-null window is treated as no filter.
  const learned =
    sel.learned && (sel.learned.from != null || sel.learned.to != null)
      ? sel.learned
      : null;

  const subjects = new Set(sel.subjects);
  const needle = sel.text.trim().toLowerCase();
  const mixups = sel.states.includes("mixup")
    ? mixedUpEntries(history, graduateRuns)
    : new Set<string>();

  const out = new Set<FactId>();
  for (const f of pool) {
    if (subjects.size) {
      const info = factInfo(f);
      if (!info || !subjects.has(info.subject)) continue;
    }
    // The finer, learner-facing cut: hiragana vs katakana, words vs counters.
    // A separate axis from `subjects` (see practice-types.ts). `?? []` guards a
    // list query persisted before types existed — an absent field is "all".
    if (!matchesTypes(f, sel.types ?? [])) continue;
    if (!matchesText(f, needle)) continue;
    if (!matchesStates(f, sel.states, history, mixups, now)) continue;
    if (learned) {
      const at = history.learnedAt?.[f];
      if (at == null) continue; // unknown first-learn → excluded
      if (learned.from != null && at < learned.from) continue;
      if (learned.to != null && at > learned.to) continue;
    }
    out.add(f);
  }

  // GUARD (see word-unlock.ts / quizzableFacts): a kanji reading is only ever
  // asked inside a MULTI-PART word the learner already knows. A reading whose
  // word is unlearned — or whose only "word" is the single kanji itself, the "on
  // its own" card task #22 removed — is dropped here, at the one seam every
  // review, practice and list drill draws its pool through. It can still have
  // reached `seen` (a lesson seeds it, a stray claim marks it), so the write
  // side does not settle this alone; this is where a non-askable reading is kept
  // off the board. Non-reading facts pass untouched, so kana, words and meanings
  // resolve exactly as before, and the count (countOf) drops with the pool.
  return shuffled(quizzableFacts([...out], history));
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

): number {
  return resolve(sel, history, lists).length;
}

// ---------- due for review ----------

/**
 * The facts it is time to review right now — the SRS sense of "due", computed
 * live rather than stored. This app deliberately keeps no due DATE on a fact
 * (see scoring.ts's header: "a due date is banned in this app"); what it keeps
 * instead is (stability, lastTested), and `status()` turns that plus `now` into
 * an action. "Due" is exactly the middle one: `probe` — the model is neither
 * confident you know it (`quiet`) nor confident you've lost it (`teach`, which
 * is re-TAUGHT, not re-tested) — so it wants to test you, right now, on this.
 *
 * This is the SAME split budget.ts's `planSession` and library/slice.ts's
 * `drillPlan` already read off `status()` to decide what a session or a Library
 * drill asks first; nothing here re-derives the model. It differs from them
 * only in scope — no length cap, no teach top-up, no ranking — because a
 * one-click "what's due" button hands the whole due set straight to the quiz,
 * the same way resolve() hands its whole named pool to Start.
 *
 * The base pool is `resolve(emptySelection(), …)` — the exact "Everything I
 * know" scope the Practice query builder's Scope buttons already produce — so
 * this is precisely what a learner would get by picking Everything and (were
 * it offered) a "Due" status, not a second definition of the known pool.
 */
export function dueFacts(
  history: HistoryFile,
  lists: SavedList[] = [],
  now = Date.now(),
  graduateRuns = 10,
): FactId[] {
  const pool = resolve(emptySelection(), history, lists, 0, { now, graduateRuns });
  return pool.filter((f) => {
    const state = effectiveState(
      history.facts[f],
      history.claims?.[f],
      history.seen?.[f],
    );
    return status(state, now) === "probe";
  });
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
  solid: "Solid",
  "getting-there": "Getting there",
  shaky: "Shaky",
  slipping: "Slipping",
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
 * Says "questions", not "facts" and not "characters". This is the run-facing
 * count users compare in the Practice footer and Start bar.
 */
export function whatSentence(
  sel: Selection,
  count: number,
  lists: SavedList[] = [],
  opts: { showCount?: boolean; now?: number } = {},
): string {
  const showCount = opts.showCount ?? true;
  if (showCount && !count) return "Nothing selected";
  const now = opts.now ?? Date.now();
  const bits: string[] = [];

  if (sel.list) {
    const list = lists.find((l) => l.id === sel.list);
    if (list) bits.push(list.name);
  }
  if (sel.session !== null && !sel.list) bits.push("That session");
  for (const t of sel.types ?? []) bits.push(typeLabel(t));
  for (const s of sel.subjects) bits.push(subjectWord(s));
  if (sel.states.length) bits.push(sel.states.map(stateWord).join(" or "));
  if (sel.text.trim()) bits.push(`“${sel.text.trim()}”`);
  if (sel.learned && (sel.learned.from != null || sel.learned.to != null)) {
    bits.push(`learned ${rangeLabel(sel.learned, now)}`);
  }

  // Un-narrowed names your whole knowledge base, so say so: "Everything you
  // know", not "Everything" — the pool is what you've seen or claimed, never the
  // untaught rest of the dictionary (see knownFacts).
  const head = bits.length ? bits.join(" · ") : "Everything you know";
  if (!showCount) return head;
  return `${head} · ${count.toLocaleString()} question${count === 1 ? "" : "s"}`;
}
