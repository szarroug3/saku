// Practice from the app's tables: a recipe resolved against the Atlas's
// collections, the learner's standings and misses, and the engine's facts.
// Server-side and dev-only, like the adapters beside it. Nothing here
// touches the schedule: a practice run's answers never reach recordQuiz
// (SAK-318); the run's misses are kept by the client as signal only.

import { grammarMeaning } from "@/data/grammar";
import { usedAsPartIn } from "@/lib/library/components";
import { knownFactsOf, type LibEntry } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { builtPieces } from "@/data/kanji-etymology";
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

/** The kanji a word is written with. */
const kanjiIn = (glyph: string): string[] => [...glyph].filter((c) => /[一-龯]/.test(c));

/** The radicals a kanji is built from, by the app's own pieces. */
const partsOf = (kanji: string): string[] => builtPieces(kanji).map((p) => p.glyph);

/** The recipe, resolved now: the items it holds (shakiest first), how many
 * matched, which asks the pool could carry, and the radicals in it. */
export function practicePreview(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses = {}, now = Date.now()): PracticePreview {
  const o = offerings(history, now);
  const shelves = recipe.collections.length ? SHELVES.filter((s) => recipe.collections.includes(s.id)) : SHELVES.filter((s) => s.sky !== "term");
  const pool: LibEntry[] = shelves.flatMap((s) => s.kinds.flatMap(all));
  const missesOf = (f: FactId) => (history.facts?.[f]?.missed ?? 0) + (practiceMisses[f as string] ?? 0);

  const asksAvailable: Record<Ask, boolean> = { meaning: false, reading: false, "reading-in-word": false, form: false, pick: false };
  const componentCounts = new Map<string, number>();
  const matched: PracticeItem[] = [];
  for (const e of pool) {
    if (recipe.statuses.length && !recipe.statuses.includes(standingFor(e, history, now).standing)) continue;
    // the radicals this thing is built from: a kanji's pieces, a word's kanji's pieces
    const built = e.kind === "kanji" ? partsOf(e.glyph) : e.kind === "word" ? kanjiIn(e.glyph).flatMap(partsOf) : [];
    for (const r of new Set(built)) componentCounts.set(r, (componentCounts.get(r) ?? 0) + 1);
    if (recipe.component && !built.includes(recipe.component) && !(e.kind === "kanji" && usedAsPartIn(recipe.component).includes(e.glyph))) continue;
    const facts = quizzableFacts(knownFactsOf(e), history);
    const byAsk = facts.map((f) => [f, askOf(f)] as const).filter((x): x is readonly [FactId, Ask] => x[1] !== null);
    for (const [, a] of byAsk) asksAvailable[a] = true;
    let kept = byAsk.filter(([, a]) => recipe.asks.includes(a)).map(([f]) => f);
    if (recipe.missedOnly) kept = kept.filter((f) => missesOf(f) > 0);
    if (!kept.length) continue;
    const item = o.offerPick(e.id);
    if (!item) continue;
    const { components: _parts, ...lean } = item;
    matched.push({ item: lean as SkyItem, misses: kept.reduce((n, f) => n + missesOf(f), 0), facts: kept });
  }
  // shakiest first; ties keep the shelf's own order
  const ordered = matched.map((m, i) => [m, i] as const).sort((a, b) => b[0].misses - a[0].misses || a[1] - b[1]).map(([m]) => m);
  const items = recipe.size === "all" ? ordered : ordered.slice(0, recipe.size);
  const components = [...componentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([glyph, count]) => ({ glyph, count }));
  return { items, matched: matched.length, asksAvailable, components };
}

/** The cards for a deck: the kept items' facts, in the deck's order. */
export function practiceCards(history: HistoryFile, recipe: Recipe, practiceMisses: PracticeMisses, dropped: readonly string[], now = Date.now()): QuizCard[] {
  const preview = practicePreview(history, recipe, practiceMisses, now);
  const facts = preview.items.filter((p) => !dropped.includes(p.item.id)).flatMap((p) => p.facts) as FactId[];
  return quizCards(history, facts, now);
}
