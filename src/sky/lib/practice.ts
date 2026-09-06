// Practice's model: a recipe that describes a deck rather than assembling
// it (SAK-319), the preview it resolves to (SAK-320), and a saved recipe,
// which is the recipe under a name (SAK-321). Practice never writes to
// the review schedule (SAK-318): a run's answers go to whoever the route
// hands in, and that is never the recorder the Quiz uses.

import type { Standing } from "./standing";
import type { SkyItem } from "./types";

/** What a card asks for. */
export type Ask = "meaning" | "reading" | "reading-in-word" | "form" | "pick";

export const ASKS: readonly Ask[] = ["meaning", "reading", "reading-in-word", "form", "pick"];

export const ASK: Record<Ask, { label: string; meaning: string }> = {
  meaning: { label: "The meaning", meaning: "Type what it means." },
  reading: { label: "The reading", meaning: "Type how it is said." },
  "reading-in-word": { label: "The reading in a word", meaning: "How a kanji is said inside a word it is written in. Asked once you have met such a word." },
  form: { label: "Building a form", meaning: "Type the pattern built on a word." },
  pick: { label: "Picking from choices", meaning: "The things only ever asked by recognition: patterns, verb pairs, keigo." },
};

export type DeckSize = 5 | 10 | 20 | "all";
export const DECK_SIZES: readonly DeckSize[] = [5, 10, 20, "all"];

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

/** A recipe under a name, kept by the learner. It keeps the recipe, not
 * the list it resolved to, so it changes as the learner does. */
export interface SavedRecipe {
  name: string;
  recipe: Recipe;
}

/** A named part of a collection: the Library's own cut of it (て-form,
 * the counting rules), or for kana one side of a pairing (hiragana or
 * katakana; plain, dakuten, yōon), the pairing named by `group`. */
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
  if (recipe.asks.length === 0) return "Pick at least one thing to be asked. A deck with no question is just a list.";
  if (!preview) return "Working it out.";
  if (preview.matched === 0) return recipe.excluded?.length ? "Everything was left out. Put something back, or loosen a filter." : "Nothing matches. Loosen a filter, or add a collection to draw from.";
  return null;
}

/** "Only 6 items match, so the deck is shorter than the 10 you asked for." */
export function shortfall(recipe: Recipe, pool: number): string | null {
  if (recipe.size === "all" || pool === 0 || pool >= recipe.size) return null;
  return `Only ${pool} ${pool === 1 ? "item matches" : "items match"}, so the deck is shorter than the ${recipe.size} you asked for.`;
}
