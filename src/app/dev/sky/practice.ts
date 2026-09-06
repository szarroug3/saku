// Practice from the app's tables: a recipe resolved against the Atlas's
// collections, the learner's standings and misses, and the engine's facts.
// Server-side and dev-only, like the adapters beside it. Nothing here
// touches the schedule: a practice run's answers never reach recordQuiz
// (SAK-318); the run's misses are kept by the client as signal only.

import { grammarMeaning } from "@/data/grammar";
import { knownFactsOf, type LibEntry } from "@/lib/library/entries";
import { factsOf, KANJI_SUBJECT } from "@/lib/library/library-index";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { fixedDirOf, mcOnlyIn } from "@/lib/engine/question";
import { deckSize, PREVIEW_CAP, type Ask, type PracticeCollection, type PracticeItem, type PracticeMisses, type PracticePreview, type Recipe } from "@/sky/lib/practice";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId, HistoryFile } from "@/types";

import { all, SHELVES } from "./atlas";
import { standingFor } from "./learner";
import { offerings } from "./observatory";
import { quizCards } from "./quiz";
import type { QuizCard } from "@/sky/lib/quiz";

/** The collections a deck can draw from: every Atlas shelf with something to ask. */
export function practiceCollections(): PracticeCollection[] {
  return SHELVES.filter((s) => s.sky !== "term").map((s) => ({ id: s.id, title: s.title, total: s.kinds.flatMap(all).length }));
}

/** What a fact asks for, in the recipe's terms. */
export function askOf(fact: FactId): Ask | null {
  const id = fact as string;
  const dir = fixedDirOf(fact) ?? "jp2en";
  if (grammarMeaning(fact)) return "pick";
  if (id.startsWith("grammar:")) return "form";
  const anchored = /^kanji:(.+?)\/reading@([^#]+)/.exec(id);
  if (anchored) return anchored[2] === anchored[1] ? null : "reading-in-word";
  if (mcOnlyIn(fact, dir)) return "pick";
  if (id.includes("/reading")) return "reading";
  if (id.includes("/meaning")) return "meaning";
  return null;
}

/** The facts practice may ask of an entry. A kanji is known by its meaning
 * alone (knownFactsOf), but its readings inside words are asked too, each
 * once a word carrying it has been met: quizzableFacts keeps that gate. */
function askable(e: LibEntry, history: HistoryFile): FactId[] {
  return quizzableFacts(e.kind === KANJI_SUBJECT ? factsOf(e.id) : knownFactsOf(e), history);
}

/** The recipe's whole pool, shakiest first, and which asks it could carry. */
function resolve(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, now: number): { pool: PracticeItem[]; asksAvailable: Record<Ask, boolean> } {
  const o = offerings(history, now);
  const shelves = recipe.collections.length ? SHELVES.filter((s) => recipe.collections.includes(s.id)) : SHELVES.filter((s) => s.sky !== "term");
  const entries: LibEntry[] = shelves.flatMap((s) => s.kinds.flatMap(all));
  const missesOf = (f: FactId) => (history.facts?.[f]?.missed ?? 0) + (practiceMisses[f as string] ?? 0);

  const asksAvailable: Record<Ask, boolean> = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
  const matched: PracticeItem[] = [];
  for (const e of entries) {
    if (recipe.statuses.length && !recipe.statuses.includes(standingFor(e, history, now).standing)) continue;
    const byAsk = askable(e, history).map((f) => [f, askOf(f)] as const).filter((x): x is readonly [FactId, Ask] => x[1] !== null);
    for (const [, a] of byAsk) asksAvailable[a] = true;
    const kept = byAsk.filter(([, a]) => recipe.asks.includes(a)).map(([f]) => f);
    if (!kept.length) continue;
    const item = o.offerPick(e.id);
    if (!item) continue;
    const { components: _parts, ...lean } = item;
    matched.push({ item: lean as SkyItem, misses: kept.reduce((n, f) => n + missesOf(f), 0), facts: kept });
  }
  // shakiest first; ties keep the shelf's own order
  const pool = matched.map((m, i) => [m, i] as const).sort((a, b) => b[0].misses - a[0].misses || a[1] - b[1]).map(([m]) => m);
  return { pool, asksAvailable };
}

/** The recipe, resolved now: the pool the deck is drawn from (shakiest
 * first, the first PREVIEW_CAP of it), how many match in all, and which
 * asks the pool could carry. */
export function practicePreview(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses = {}, now = Date.now()): PracticePreview {
  const { pool, asksAvailable } = resolve(history, recipe, practiceMisses, now);
  return { items: pool.slice(0, PREVIEW_CAP), matched: pool.length, asksAvailable };
}

/** The deck's items: a random draw of the size asked for from the pool,
 * less anything dropped by hand (Sam, 2026-09-06: not the first ten, a
 * draw from all of them). "All of them" is the pool in its own order. */
export function practiceDraw(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, dropped: readonly string[], now = Date.now(), random = Math.random): PracticeItem[] {
  const pool = resolve(history, recipe, practiceMisses, now).pool.filter((p) => !dropped.includes(p.item.id));
  if (recipe.size === "all") return pool;
  const drawn = [...pool];
  for (let i = drawn.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [drawn[i], drawn[j]] = [drawn[j], drawn[i]]; }
  return drawn.slice(0, deckSize(recipe, pool.length));
}

/** The cards for a deck: the drawn items' facts, in the draw's order. */
export function practiceCards(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, dropped: readonly string[], now = Date.now()): QuizCard[] {
  const facts = practiceDraw(history, recipe, practiceMisses, dropped, now).flatMap((p) => p.facts) as FactId[];
  return quizCards(history, facts, now);
}
