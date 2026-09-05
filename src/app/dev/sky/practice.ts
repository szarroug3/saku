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
import type { Ask, PracticeCollection, PracticeItem, PracticeMisses, PracticePreview, Recipe } from "@/sky/lib/practice";
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

/** The recipe, resolved now: the items it holds (shakiest first), how many
 * matched, and which asks the pool could carry. */
export function practicePreview(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses = {}, now = Date.now()): PracticePreview {
  const o = offerings(history, now);
  const shelves = recipe.collections.length ? SHELVES.filter((s) => recipe.collections.includes(s.id)) : SHELVES.filter((s) => s.sky !== "term");
  const pool: LibEntry[] = shelves.flatMap((s) => s.kinds.flatMap(all));
  const missesOf = (f: FactId) => (history.facts?.[f]?.missed ?? 0) + (practiceMisses[f as string] ?? 0);

  const asksAvailable: Record<Ask, boolean> = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
  const matched: PracticeItem[] = [];
  for (const e of pool) {
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
  const ordered = matched.map((m, i) => [m, i] as const).sort((a, b) => b[0].misses - a[0].misses || a[1] - b[1]).map(([m]) => m);
  const items = recipe.size === "all" ? ordered : ordered.slice(0, recipe.size);
  return { items, matched: matched.length, asksAvailable };
}

/** The cards for a deck: the kept items' facts, in the deck's order. */
export function practiceCards(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, dropped: readonly string[], now = Date.now()): QuizCard[] {
  const preview = practicePreview(history, recipe, practiceMisses, now);
  const facts = preview.items.filter((p) => !dropped.includes(p.item.id)).flatMap((p) => p.facts) as FactId[];
  return quizCards(history, facts, now);
}
