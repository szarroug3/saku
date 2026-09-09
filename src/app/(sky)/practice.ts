// Practice from the app's tables: a recipe resolved against the Atlas's
// collections, the learner's standings and misses, and the engine's facts.
// Server-side and dev-only, like the adapters beside it. Nothing here
// touches the schedule: a practice run's answers never reach recordQuiz
// (SAK-318); the run's misses are kept by the client as signal only.

import { isConstructionFact } from "@/data/counter-categories";
import { isPitchFact } from "@/data/pitch";
import { pitchFactId } from "@/data/pitch-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { grammarMeaning } from "@/data/grammar";
import { knownFactsOf, type Kind, type LibEntry } from "@/lib/library/entries";
import { factsOf, KANJI_SUBJECT } from "@/lib/library/library-index";
import { isReadingFact, provenReadingFacts, quizzable } from "@/lib/library/reading-proof-facts";
import { shelfSections } from "@/lib/library/shelf-sections";
import { timedSync } from "@/lib/server-timing";
import { fixedDirOf, mcOnlyIn } from "@/lib/engine/question";
import { cutsOf, deckSize, PREVIEW_CAP, type Ask, type PracticeCollection, type PracticeCut, type PracticeItem, type PracticeMisses, type PracticePreview, type Recipe } from "@/sky/lib/practice";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId, HistoryFile } from "@/types";

import { all, SHELVES } from "./atlas";
import { standingFor, touchedFacts } from "./learner";
import { offerPicker } from "./observatory";
import { quizCards, type QuizOptions } from "./quiz";
import { shuffleDeck, type QuizCard } from "@/sky/lib/quiz";

/** The shelves a deck can draw from. */
const DRAWABLE = SHELVES.filter((s) => s.sky !== "term");

/** A shelf's pool with the cuts each entry sits in: the Library's own
 * sections of the shelf's kinds (so Counting holds the counting rules and
 * the numbers, as the Atlas shelf does), plus anything of the kinds the
 * sections leave out, in no cut. Computed once; it depends only on the
 * shipped tables. */
interface Pool { entries: LibEntry[]; cutsOf: Map<string, readonly string[]>; cuts?: PracticeCut[] }
const POOLS = new Map<string, Pool>();

/** Kana are cut two ways at once: by script, and by row type. */
const KANA_CUTS: readonly PracticeCut[] = [
  { id: "hiragana", label: "Hiragana", group: "Script" },
  { id: "katakana", label: "Katakana", group: "Script" },
  { id: "plain", label: "Plain rows", group: "Row type" },
  { id: "dakuten", label: "Dakuten and handakuten", group: "Row type" },
  { id: "yoon", label: "Yōon", group: "Row type" },
];
const kanaCuts = (sectionId: string, label: string): string[] => [
  sectionId.startsWith("katakana") ? "katakana" : "hiragana",
  /Yōon/.test(label) ? "yoon" : /Dakuten|Handakuten/.test(label) ? "dakuten" : "plain",
];

/** The Atlas's names for the counting shelf's cuts. */
const COUNTING_LABELS: Record<string, string> = { "counters-constructions": "Counting rules", "counters-tsu": "〜つ", "counters-numbers": "Numbers" };

/** Shelves whose sections are real categories, not scroll positions. */
const CUT_SHELVES = new Set(["kana", "grammar", "counting", "keigo"]);

function poolOf(shelf: { id: string; kinds: readonly Kind[] }): Pool {
  let pool = POOLS.get(shelf.id);
  if (pool) return pool;
  const entries: LibEntry[] = [];
  const seen = new Set<string>();
  const cutsOfEntry = new Map<string, readonly string[]>();
  const cuts: PracticeCut[] = [];
  for (const kind of shelf.kinds) {
    for (const section of shelfSections(kind, "everyday")) {
      const ids = shelf.id === "kana" ? kanaCuts(section.id, section.label) : [section.id];
      if (shelf.id !== "kana" && CUT_SHELVES.has(shelf.id)) cuts.push({ id: section.id, label: COUNTING_LABELS[section.id] ?? section.label });
      for (const e of section.entries) {
        if (!seen.has(e.id)) { seen.add(e.id); entries.push(e); }
        cutsOfEntry.set(e.id, [...new Set([...(cutsOfEntry.get(e.id) ?? []), ...ids])]);
      }
    }
    for (const e of all(kind)) if (!seen.has(e.id)) { seen.add(e.id); entries.push(e); }
  }
  pool = { entries, cutsOf: cutsOfEntry, ...(shelf.id === "kana" ? { cuts: [...KANA_CUTS] } : cuts.length > 1 ? { cuts } : {}) };
  POOLS.set(shelf.id, pool);
  return pool;
}

/** The collections a deck can draw from: every Atlas shelf with something
 * to ask, with the cuts it can be narrowed to where it has named ones. */
export function practiceCollections(): PracticeCollection[] {
  return DRAWABLE.map((s) => { const pool = poolOf(s); return { id: s.id, title: s.title, total: pool.entries.length, ...(pool.cuts ? { cuts: pool.cuts } : {}) }; });
}

/** Whether an entry of a shelf sits in the cuts the recipe keeps of it:
 * within each group of cuts with any chosen, one of the chosen. */
function inCuts(recipe: Recipe, shelfId: string, pool: Pool, entryId: string): boolean {
  const chosen = cutsOf(recipe, shelfId).filter((id) => pool.cuts?.some((c) => c.id === id));
  if (!chosen.length) return true;
  const mine = pool.cutsOf.get(entryId) ?? [];
  const groups = new Set(chosen.map((id) => pool.cuts!.find((c) => c.id === id)!.group ?? ""));
  return [...groups].every((g) => chosen.some((id) => (pool.cuts!.find((c) => c.id === id)!.group ?? "") === g && mine.includes(id)));
}

/** What a fact asks for, in the recipe's terms. Worked out once per fact
 * and kept: it depends on the fact alone, and a preview asks it of thirty
 * thousand. */
const ASK_OF = new Map<string, Ask | null>();
export function askOf(fact: FactId): Ask | null {
  const id = fact as string;
  let ask = ASK_OF.get(id);
  if (ask === undefined) { ask = workOutAsk(fact); ASK_OF.set(id, ask); }
  return ask;
}
function workOutAsk(fact: FactId): Ask | null {
  const id = fact as string;
  const dir = fixedDirOf(fact) ?? "jp2en";
  // a counting rule is asked on a number rolled for the showing: how is 六十七 said
  if (isConstructionFact(fact)) return "reading";
  // a word's pitch: two clips, pick the one that means it
  if (isPitchFact(id)) return "pick";
  // a sentence tier: put the pieces in order
  if (isSentenceTierMarkerFact(fact)) return "pick";
  if (grammarMeaning(fact)) return "pick";
  if (id.startsWith("grammar:")) return "form";
  const anchored = /^kanji:(.+?)\/reading@([^#]+)/.exec(id);
  if (anchored) return anchored[2] === anchored[1] ? null : "reading-in-word";
  if (mcOnlyIn(fact, dir)) return "pick";
  if (id.includes("/reading")) return "reading";
  if (id.includes("/meaning")) return "meaning";
  return null;
}

/** The facts practice may ask of an entry, each with its ask, before the
 * learner is consulted. A kanji is known by its meaning alone
 * (knownFactsOf), but its readings inside words are asked too, each once a
 * word carrying it has been met: `quizzable` keeps that gate, per learner,
 * in `resolve`. This part depends on the shipped tables alone, so it is
 * worked out once per entry and kept.
 *
 * A word's pitch is added here (SAK-426). It is a registered fact but
 * deliberately not a listed one (see data/pitch-facts.ts), so neither
 * `factsOf` nor `knownFactsOf` hands it over and a practice deck could
 * never ask a pitch question, whatever Settings said. The lesson quiz adds
 * it the same way, per word taught. `askOf` already reads it as "pick", so
 * a recipe that asks for picking from choices takes it from here; a deck
 * dealt with pitch questions off drops it again in `practiceCards`. */
type EntryAsk = readonly [FactId, Ask];
const ASKS_OF = new Map<string, readonly EntryAsk[]>();
function asksOf(e: LibEntry): readonly EntryAsk[] {
  let asks = ASKS_OF.get(e.id);
  if (!asks) {
    const facts = [...(e.kind === KANJI_SUBJECT ? factsOf(e.id) : knownFactsOf(e))];
    if (e.kind === VOCAB_SUBJECT) { const pf = pitchFactId(e.glyph); if (factInfo(pf)) facts.push(pf); }
    asks = facts.flatMap((f) => { const a = askOf(f); return a ? [[f, a] as const] : []; });
    ASKS_OF.set(e.id, asks);
  }
  return asks;
}

/** An entry the recipe matched, before it is built into an item: the pool
 * is fifteen thousand of these and a preview sends four hundred, so the
 * items are built for the ones that are sent (`Resolved.items`) and the
 * rest are only counted. */
interface Candidate { entry: LibEntry; misses: number; facts: FactId[] }

interface Resolved {
  /** The whole pool, shakiest first. */
  pool: Candidate[];
  asksAvailable: Record<Ask, boolean>;
  /** The items for some of the pool, built the way the Observatory would
   * offer them. Every drawable entry has an offer (practice.test.ts holds
   * that), so nothing is dropped here that was counted above. */
  items: (picked: readonly Candidate[]) => PracticeItem[];
}

/** The entries a recipe draws from, in the shelves' order: an entry on two
 * shelves (the numbers are words too) is drawn once. */
function entriesOf(recipe: Recipe): LibEntry[] {
  const shelves = recipe.collections.length ? DRAWABLE.filter((s) => recipe.collections.includes(s.id)) : DRAWABLE;
  const drawn = new Set<string>(recipe.excluded ?? []);
  return shelves.flatMap((s) => { const pool = poolOf(s); return pool.entries.filter((e) => !drawn.has(e.id) && inCuts(recipe, s.id, pool, e.id) && drawn.add(e.id)); });
}

/**
 * What a recipe's pool is before any learner is consulted, worked out once
 * per shape of recipe (collections, cuts, what was left out, asks) and kept
 * for the process (SAK-382). The learner changes three things about it: a
 * reading fact is askable only once a word carrying it has been tested
 * (`gated`), a fact has misses, and an entry has a standing. The first two
 * touch only the facts a history has anything on, so `resolve` applies
 * them from the history's side and leaves the other fifteen thousand
 * entries as they are here, most of them the very same objects.
 */
interface Base {
  /** One per entry, in order, with the facts the recipe keeps of it: the
   * candidate as it is for a learner with nothing on it, gated facts left
   * out. Empty facts means the entry is not in the pool for that learner. */
  plain: Candidate[];
  /** Per entry, the recipe's kept facts in their own order, gated ones
   * included; only for entries that have a gated fact. */
  withGated: Map<number, FactId[]>;
  /** The asks the ungated facts carry, over every entry. */
  asksSure: Record<Ask, boolean>;
  /** Each gated fact: whose it is, what it asks, and whether the recipe
   * keeps it. */
  gated: Map<string, { idx: number; ask: Ask; kept: boolean }[]>;
  /** Each kept fact's entries, for the misses. */
  keptBy: Map<string, number[]>;
}
const BASES = new Map<string, Base>();
const MOST_BASES = 24;
function baseFor(recipe: Recipe): Base {
  const key = JSON.stringify([recipe.collections, recipe.cuts ?? {}, recipe.excluded ?? [], recipe.asks]);
  const had = BASES.get(key);
  if (had) return had;
  const plain: Candidate[] = [];
  const withGated = new Map<number, FactId[]>();
  const asksSure: Record<Ask, boolean> = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
  const gated = new Map<string, { idx: number; ask: Ask; kept: boolean }[]>();
  const keptBy = new Map<string, number[]>();
  for (const e of entriesOf(recipe)) {
    const idx = plain.length;
    const sure: FactId[] = [];
    const all: FactId[] = [];
    let anyGated = false;
    for (const [f, a] of asksOf(e)) {
      const kept = recipe.asks.includes(a);
      if (isReadingFact(f)) {
        anyGated = true;
        const uses = gated.get(f as string);
        if (uses) uses.push({ idx, ask: a, kept }); else gated.set(f as string, [{ idx, ask: a, kept }]);
      } else {
        asksSure[a] = true;
        if (kept) sure.push(f);
      }
      if (kept) { all.push(f); const by = keptBy.get(f as string); if (by) by.push(idx); else keptBy.set(f as string, [idx]); }
    }
    plain.push({ entry: e, misses: 0, facts: sure });
    if (anyGated) withGated.set(idx, all);
  }
  if (BASES.size >= MOST_BASES) BASES.delete(BASES.keys().next().value!);
  const base = { plain, withGated, asksSure, gated, keptBy };
  BASES.set(key, base);
  return base;
}

/** The recipe's whole pool, shakiest first, and which asks it could carry. */
function resolve(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now: number): Resolved {
  const missesOf = (f: FactId) => (history.facts?.[f]?.missed ?? 0) + (practiceMisses[f as string] ?? 0);
  let pool: Candidate[];
  let asksAvailable: Record<Ask, boolean>;
  if (recipe.statuses.length) {
    // a recipe cut by standing asks every entry for its standing, and counts
    // the asks of the ones that pass: the plain walk
    asksAvailable = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
    const matched: Candidate[] = [];
    for (const e of entriesOf(recipe)) {
      if (!recipe.statuses.includes(standingFor(e, history, now).standing)) continue;
      const kept: FactId[] = [];
      for (const [f, a] of asksOf(e)) {
        if (!quizzable(f, history)) continue;
        asksAvailable[a] = true;
        if (recipe.asks.includes(a)) kept.push(f);
      }
      if (!kept.length) continue;
      let misses = 0;
      for (const f of kept) misses += missesOf(f);
      matched.push({ entry: e, misses, facts: kept });
    }
    // shakiest first; ties keep the shelf's own order (the sort is stable)
    pool = matched.sort((a, b) => b.misses - a.misses);
  } else {
    // the recipe's base, with the learner applied from the history's side:
    // the gated facts a tested word has opened, and the misses
    const base = baseFor(recipe);
    asksAvailable = { ...base.asksSure };
    const proven = provenReadingFacts(history, touchedFacts(history));
    const opened = new Set<number>();
    for (const f of proven) for (const use of base.gated.get(f as string) ?? []) { asksAvailable[use.ask] = true; if (use.kept) opened.add(use.idx); }
    const changed = new Map<number, Candidate>();
    const candidate = (idx: number): Candidate => {
      let c = changed.get(idx);
      if (c) return c;
      const all = base.withGated.get(idx);
      const facts = all && opened.has(idx) ? all.filter((f) => !isReadingFact(f) || proven.has(f)) : base.plain[idx].facts;
      c = { entry: base.plain[idx].entry, misses: 0, facts };
      changed.set(idx, c);
      return c;
    };
    for (const idx of opened) candidate(idx);
    const missed = new Set<string>(touchedFacts(history) as readonly string[]);
    for (const f of Object.keys(practiceMisses)) missed.add(f);
    for (const f of missed) {
      const m = missesOf(f as FactId);
      if (!m) continue;
      for (const idx of base.keptBy.get(f) ?? []) {
        const c = candidate(idx);
        if (c.facts.includes(f as FactId)) c.misses += m;
      }
    }
    // shakiest first, ties in the shelf's order: the ones with misses sorted
    // to the front, the rest as they stand
    const shaky = [...changed.entries()].filter(([, c]) => c.misses > 0).sort((a, b) => b[1].misses - a[1].misses || a[0] - b[0]).map(([, c]) => c);
    pool = shaky;
    for (let idx = 0; idx < base.plain.length; idx++) {
      const c = changed.get(idx) ?? base.plain[idx];
      if (c.misses > 0 || !c.facts.length) continue;
      pool.push(c);
    }
  }

  let offered: ReturnType<typeof offerPicker> | undefined;
  const items = (picked: readonly Candidate[]): PracticeItem[] => {
    offered ??= offerPicker(history, now);
    return picked.flatMap((c) => {
      const item = offered!.offerPick(c.entry.id);
      if (!item) return [];
      const { components: _parts, ...lean } = item;
      return [{ item: lean as SkyItem, misses: c.misses, facts: c.facts }];
    });
  };
  return { pool, asksAvailable, items };
}

/** The recipe, resolved now: the pool the deck is drawn from (shakiest
 * first, the first PREVIEW_CAP of it), how many match in all, and which
 * asks the pool could carry. */
export function practicePreview(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses = {}, now = Date.now()): PracticePreview {
  const { pool, asksAvailable, items } = timedSync("practice:resolve", () => resolve(history, recipe, practiceMisses, now));
  return { items: timedSync("practice:items", () => items(pool.slice(0, PREVIEW_CAP))), matched: pool.length, asksAvailable };
}

/** The deck's draw: a random draw of the size asked for from the pool
 * (Sam, 2026-09-06: not the first ten, a draw from all of them). "All of
 * them" is the pool in its own order. */
function draw(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now: number, random: () => number): { drawn: Candidate[]; items: Resolved["items"] } {
  const { pool, items } = resolve(history, recipe, practiceMisses, now);
  if (recipe.size === "all") return { drawn: pool, items };
  const drawn = [...pool];
  for (let i = drawn.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [drawn[i], drawn[j]] = [drawn[j], drawn[i]]; }
  return { drawn: drawn.slice(0, deckSize(recipe, pool.length)), items };
}

/** The deck's items. */
export function practiceDraw(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now = Date.now(), random = Math.random): PracticeItem[] {
  const { drawn, items } = draw(history, recipe, practiceMisses, now, random);
  return items(drawn);
}

/** The cards for a deck: the drawn items' facts, shuffled. The draw is
 * already random, but it draws ITEMS, and a drawn word's facts came out
 * together, so its meaning and its reading were always asked back to back
 * (SAK-388). A deck of "all of them" was not shuffled at all.
 *
 * `opts` is the learner's Settings, threaded through the way the lesson
 * quiz threads them (SAK-426): with `audio` a card that has a sound to ask
 * by becomes a listening card half the time, and with `pitch` off the
 * words' pitch facts are dropped before any card is built. Both default to
 * on, as Settings do. */
export function practiceCards(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now = Date.now(), opts: QuizOptions = {}): QuizCard[] {
  const audio = opts.audio ?? true;
  const pitch = opts.pitch ?? true;
  // the cards want the facts alone, so the drawn items are never built
  const drawn = draw(history, recipe, practiceMisses, now, Math.random).drawn.flatMap((p) => p.facts);
  const facts = pitch ? drawn : drawn.filter((f) => !isPitchFact(f as string));
  return shuffleDeck(quizCards(history, facts, now, { audio, pitch }));
}
