// Practice's model: a recipe that describes a deck rather than assembling
// it (SAK-319), the preview it resolves to (SAK-320), and a saved recipe,
// which is the recipe under a name (SAK-321). Practice never writes to
// the review schedule (SAK-318): a run's answers go to whoever the route
// hands in, and that is never the recorder the Quiz uses.

import { STANDING, STANDING_ORDER, type Standing } from "./standing";
import type { SkyItem } from "./types";

/** What a card asks for. */
export type Ask = "meaning" | "reading" | "reading-in-word" | "form" | "pick";

export const ASKS: readonly Ask[] = ["meaning", "reading", "reading-in-word", "form", "pick"];

export const ASK: Record<Ask, { label: string; meaning: string }> = {
  meaning: { label: "The meaning", meaning: "Type what it means." },
  reading: { label: "The reading", meaning: "Type how it is said." },
  "reading-in-word": { label: "The reading in a word", meaning: "How a kanji is said inside a word it is written in. Asked once you have met such a word." },
  form: { label: "Building a form", meaning: "Type the pattern built on a word." },
  pick: { label: "Picking from choices", meaning: "The things only ever asked by recognition: patterns, verb pairs, keigo, and a word's pitch." },
};

/** How many the deck holds: a number the learner types, or all of them. */
export type DeckSize = number | "all";
export const DEFAULT_SIZE = 10;

/** The description of a deck. Everything empty means everything. */
export interface Recipe {
  /** Atlas collection ids to draw from. */
  collections: readonly string[];
  /** Cut ids to keep within a collection, by collection id; a collection
   * with none listed is drawn from whole. Cuts in different groups combine
   * (katakana and yōon: the katakana yōon), cuts in one group widen. */
  cuts: Readonly<Record<string, readonly string[]>>;
  /** Standings to keep; empty keeps every standing. */
  statuses: readonly Standing[];
  asks: readonly Ask[];
  size: DeckSize;
  /** Items left out by hand, by id. Part of the recipe, so a saved one
   * keeps them (Sam, 2026-09-06). */
  excluded: readonly string[];
}

export const EMPTY_RECIPE: Recipe = { collections: [], cuts: {}, statuses: [], asks: [...ASKS], size: 10, excluded: [] };

/** The cuts a recipe keeps within one collection: none listed means all. */
export const cutsOf = (recipe: Recipe, collection: string): readonly string[] => recipe.cuts?.[collection] ?? [];

/** The same recipe, written one way (SAK-372).
 *
 * A recipe is a description, and nothing in it is ordered: drawing from kana
 * and words is the same deck as drawing from words and kana. But the page
 * built its recipes by appending, so which chip was clicked first decided the
 * order of the list, `toggleCut` moved a collection's key to the end of
 * `cuts` every time a cut was picked, and a recipe that came back through the
 * URL was rebuilt as `{ ...EMPTY_RECIPE, ...parsed }`, in EMPTY_RECIPE's key
 * order. Comparing the two by `JSON.stringify` called all of those different
 * recipes: "Saved as X" flipped to "Update X" for no visible change, and the
 * preview cache missed and refetched.
 *
 * So: the six fields in a fixed order, every list sorted, the `cuts` keys
 * sorted and their lists sorted too. What it means and what it draws are
 * untouched, since none of those orders was ever read for anything. */
export function canonicalRecipe(recipe: Recipe): Recipe {
  const cuts = recipe.cuts ?? {};
  return {
    collections: [...recipe.collections].sort(),
    cuts: Object.fromEntries(Object.keys(cuts).sort().map((id) => [id, [...(cuts[id] ?? [])].sort()])),
    statuses: [...recipe.statuses].sort(),
    asks: [...recipe.asks].sort(),
    size: recipe.size,
    excluded: [...(recipe.excluded ?? [])].sort(),
  };
}

/** A recipe as one string, for comparing and for keying an effect.
 *
 * It is the canonical recipe as JSON, so parsing it back gives a recipe that
 * draws the same deck; the page leans on that to send the looked-up recipe
 * without keeping a second copy of it. */
export const recipeKey = (recipe: Recipe): string => JSON.stringify(canonicalRecipe(recipe));

/** Whether two recipes describe the same deck. */
export const sameRecipe = (a: Recipe, b: Recipe): boolean => recipeKey(a) === recipeKey(b);

/** A recipe under a name, kept by the learner. It keeps the recipe, not
 * the list it resolved to, so it changes as the learner does. */
export interface SavedRecipe {
  name: string;
  recipe: Recipe;
}

/** A named part of a collection: the Library's own cut of it (て-form,
 * the counting rules), or for kana one side of a pairing (hiragana or
 * katakana; plain, dakuten, yōon), the pairing named by `group`, as the
 * menu shows it. */
export interface PracticeCut {
  id: string;
  label: string;
  group?: string;
}

/** One collection to draw from, with how much it holds and, where it has
 * named parts, the cuts it can be narrowed to. */
export interface PracticeCollection {
  id: string;
  title: string;
  total: number;
  cuts?: readonly PracticeCut[];
}

/** "a", "a and b", "a, b and c". */
const listed = (parts: readonly string[]): string =>
  parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/** A recipe in one line, for a saved recipe's chip to carry the way a
 * collection's chip carries its count (SAK-372).
 *
 * The panel had a summary line and Sam took it out on purpose, so this is not
 * that: a recipe called "Everything" tells you nothing about what it draws
 * from until you read every chip, and this is what the chip says when you
 * rest on it. Only what has been narrowed is worth saying, so a clause is
 * left out when it says nothing: no standing picked means any standing, and
 * all five asks means asked every way.
 *
 * "Kana (Hiragana and Yōon) and Words, only shaky, asked for the meaning and
 * the reading, 10 of them" */
export function recipeSummary(recipe: Recipe, collections: readonly PracticeCollection[]): string {
  const drawn = recipe.collections.length === 0
    ? "Everything"
    : listed(collections.filter((c) => recipe.collections.includes(c.id)).map((c) => {
      const kept = cutsOf(recipe, c.id);
      if (!kept.length) return c.title;
      // named in the order the menu offers them, not the order they were
      // picked; anything the collection no longer offers keeps its id, so a
      // stale saved recipe still says something
      const known = (c.cuts ?? []).filter((x) => kept.includes(x.id)).map((x) => x.label);
      const rest = kept.filter((id) => !(c.cuts ?? []).some((x) => x.id === id));
      return `${c.title} (${listed([...known, ...rest])})`;
    }));
  const clauses = [drawn];
  if (recipe.statuses.length) clauses.push(`only ${listed(STANDING_ORDER.filter((s) => recipe.statuses.includes(s)).map((s) => STANDING[s].label))}`);
  if (ASKS.some((a) => !recipe.asks.includes(a))) clauses.push(`asked for ${listed(ASKS.filter((a) => recipe.asks.includes(a)).map((a) => ASK[a].label.toLowerCase()))}`);
  clauses.push(recipe.size === "all" ? "all of them" : `${recipe.size.toLocaleString()} of them`);
  const left = recipe.excluded?.length ?? 0;
  if (left) clauses.push(`less ${left === 1 ? "one" : left.toLocaleString()} left out by hand`);
  return clauses.join(", ");
}

/** An item in the preview, with what it has been missed. */
export interface PracticeItem {
  item: SkyItem;
  misses: number;
  /** The facts the deck would ask of it. */
  facts: readonly string[];
}

/** The most of the pool a preview carries; the rest is counted, not sent. */
export const PREVIEW_CAP = 400;

/** What a recipe resolves to, now: the pool the deck is drawn from. */
export interface PracticePreview {
  /** The pool, shakiest first, up to PREVIEW_CAP of it. */
  items: readonly PracticeItem[];
  /** How many match in all. */
  matched: number;
  /** How many questions the whole pool would ask: every matched item's facts,
   * counted over all of them and not only the ones the preview carries. A
   * deck is one card per fact, so 106 items were 202 questions and the panel
   * had no way to say so (Sam, 2026-09-08). */
  questions: number;
  /** Which asks the pool could support, before the recipe's own asks cut it. */
  asksAvailable: Readonly<Record<Ask, boolean>>;
}

/** Misses kept by practice itself, per fact: signal only, never the schedule. */
export type PracticeMisses = Readonly<Record<string, number>>;

/** How many the deck will hold: the size asked for, or the whole pool when
 * that is smaller or "all" was asked. */
export function deckSize(recipe: Recipe, pool: number): number {
  return recipe.size === "all" ? pool : Math.min(recipe.size, pool);
}

/** Why a deck cannot start, in the words the page shows, or null when it can. */
export function cannotStart(recipe: Recipe, preview: PracticePreview | null): string | null {
  if (recipe.asks.length === 0) return "Pick at least one thing to be asked.";
  if (!preview) return "Working it out.";
  if (preview.matched === 0) return recipe.excluded?.length ? "Everything was left out. Put something back, or loosen a filter." : "Nothing matches. Loosen a filter, or add a collection to draw from.";
  return null;
}

/** "Only 6 items match, so the deck is shorter than the 10 you asked for." */
export function shortfall(recipe: Recipe, pool: number): string | null {
  if (recipe.size === "all" || pool === 0 || pool >= recipe.size) return null;
  return `Only ${pool} ${pool === 1 ? "item matches" : "items match"}, so the deck is shorter than the ${recipe.size} you asked for.`;
}
