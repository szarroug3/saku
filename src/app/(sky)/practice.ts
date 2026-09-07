// Practice from the app's tables: a recipe resolved against the Atlas's
// collections, the learner's standings and misses, and the engine's facts.
// Server-side and dev-only, like the adapters beside it. Nothing here
// touches the schedule: a practice run's answers never reach recordQuiz
// (SAK-318); the run's misses are kept by the client as signal only.

import { isConstructionFact } from "@/data/counter-categories";
import { isPitchFact } from "@/data/pitch";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { grammarMeaning } from "@/data/grammar";
import { knownFactsOf, type Kind, type LibEntry } from "@/lib/library/entries";
import { factsOf, KANJI_SUBJECT } from "@/lib/library/library-index";
import { quizzable } from "@/lib/library/reading-proof-facts";
import { shelfSections } from "@/lib/library/shelf-sections";
import { fixedDirOf, mcOnlyIn } from "@/lib/engine/question";
import { cutsOf, deckSize, PREVIEW_CAP, type Ask, type PracticeCollection, type PracticeCut, type PracticeItem, type PracticeMisses, type PracticePreview, type Recipe } from "@/sky/lib/practice";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId, HistoryFile } from "@/types";

import { all, SHELVES } from "./atlas";
import { standingFor } from "./learner";
import { offerPicker } from "./observatory";
import { quizCards } from "./quiz";
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
 * worked out once per entry and kept. */
type EntryAsk = readonly [FactId, Ask];
const ASKS_OF = new Map<string, readonly EntryAsk[]>();
function asksOf(e: LibEntry): readonly EntryAsk[] {
  let asks = ASKS_OF.get(e.id);
  if (!asks) {
    const facts = e.kind === KANJI_SUBJECT ? factsOf(e.id) : knownFactsOf(e);
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

/** The recipe's whole pool, shakiest first, and which asks it could carry. */
function resolve(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now: number): Resolved {
  const shelves = recipe.collections.length ? DRAWABLE.filter((s) => recipe.collections.includes(s.id)) : DRAWABLE;
  // an entry on two shelves (the numbers are words too) is drawn once
  const drawn = new Set<string>(recipe.excluded ?? []);
  const entries: LibEntry[] = shelves.flatMap((s) => { const pool = poolOf(s); return pool.entries.filter((e) => !drawn.has(e.id) && inCuts(recipe, s.id, pool, e.id) && drawn.add(e.id)); });
  const missesOf = (f: FactId) => (history.facts?.[f]?.missed ?? 0) + (practiceMisses[f as string] ?? 0);

  const asksAvailable: Record<Ask, boolean> = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
  const matched: Candidate[] = [];
  for (const e of entries) {
    if (recipe.statuses.length && !recipe.statuses.includes(standingFor(e, history, now).standing)) continue;
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
  const pool = matched.sort((a, b) => b.misses - a.misses);

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
  const { pool, asksAvailable, items } = resolve(history, recipe, practiceMisses, now);
  return { items: items(pool.slice(0, PREVIEW_CAP)), matched: pool.length, asksAvailable };
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
 * (SAK-388). A deck of "all of them" was not shuffled at all. */
export function practiceCards(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now = Date.now()): QuizCard[] {
  // the cards want the facts alone, so the drawn items are never built
  const facts = draw(history, recipe, practiceMisses, now, Math.random).drawn.flatMap((p) => p.facts);
  return shuffleDeck(quizCards(history, facts, now));
}
