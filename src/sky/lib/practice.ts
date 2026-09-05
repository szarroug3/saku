// Practice's model: a recipe that describes a deck rather than assembling
// it (SAK-319), the preview it resolves to (SAK-320), and a saved deck,
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
  "reading-in-word": { label: "The reading in a word", meaning: "How a kanji is said inside a word it is written in." },
  form: { label: "Building a form", meaning: "Type the pattern built on a word." },
  pick: { label: "Picking from choices", meaning: "The things only ever asked by recognition: patterns, verb pairs, keigo." },
};

export type DeckSize = 5 | 10 | 20 | "all";
export const DECK_SIZES: readonly DeckSize[] = [5, 10, 20, "all"];

/** The description of a deck. Everything empty means everything. */
export interface Recipe {
  /** Atlas collection ids to draw from. */
  collections: readonly string[];
  /** Standings to keep; empty keeps every standing. */
  statuses: readonly Standing[];
  /** Only things missed before, in the schedule or in practice. */
  missedOnly: boolean;
  /** A radical every kanji (and word written with one) must be built from. */
  component: string | null;
  asks: readonly Ask[];
  size: DeckSize;
  /** No narrowing down: the choices are never offered on a typed card. */
  noNarrowing: boolean;
}

export const EMPTY_RECIPE: Recipe = { collections: [], statuses: [], missedOnly: false, component: null, asks: [...ASKS], size: 10, noNarrowing: false };

/** A recipe under a name. The presets are these, shipped. */
export interface Deck {
  name: string;
  recipe: Recipe;
}

export const PRESETS: readonly Deck[] = [
  { name: "Everything I keep missing", recipe: { ...EMPTY_RECIPE, missedOnly: true, size: "all" } },
  { name: "The 木 family", recipe: { ...EMPTY_RECIPE, collections: ["kanji", "words"], component: "木", size: "all" } },
  { name: "Kana speed run", recipe: { ...EMPTY_RECIPE, collections: ["kana"], asks: ["reading"], size: 20, noNarrowing: true } },
  { name: "Words I have learned", recipe: { ...EMPTY_RECIPE, collections: ["words"], statuses: ["solid", "getting-there", "shaky", "slipping", "claimed"], size: 20 } },
  { name: "A look at what is coming", recipe: { ...EMPTY_RECIPE, statuses: ["not-seen"], size: 10 } },
];

/** One collection to draw from, with how much it holds. */
export interface PracticeCollection {
  id: string;
  title: string;
  total: number;
}

/** An item in the preview, with what it has been missed. */
export interface PracticeItem {
  item: SkyItem;
  misses: number;
  /** The facts the deck would ask of it. */
  facts: readonly string[];
}

/** What a recipe resolves to, now. */
export interface PracticePreview {
  /** The items the deck holds, shakiest first, before any are dropped. */
  items: readonly PracticeItem[];
  /** How many matched before the size cap. */
  matched: number;
  /** Which asks the pool could support, before the recipe's own asks cut it. */
  asksAvailable: Readonly<Record<Ask, boolean>>;
  /** The radicals the pool's kanji are built from, most common first. */
  components: ReadonlyArray<{ glyph: string; count: number }>;
}

/** Misses kept by practice itself, per fact: signal only, never the schedule. */
export type PracticeMisses = Readonly<Record<string, number>>;

/** The recipe in plain words: "kanji · learned or mastered · built from 木 ·
 * asked for the meaning and the reading". */
export function describe(recipe: Recipe, collections: readonly PracticeCollection[]): string {
  const parts: string[] = [];
  const drawn = recipe.collections.map((id) => collections.find((c) => c.id === id)?.title.toLowerCase() ?? id);
  parts.push(drawn.length ? list(drawn) : "everything");
  if (recipe.statuses.length) parts.push(list(recipe.statuses.map((s) => s.replace("-", " "))));
  if (recipe.missedOnly) parts.push("only ones I have missed");
  if (recipe.component) parts.push(`built from ${recipe.component}`);
  if (recipe.asks.length && recipe.asks.length < ASKS.length) parts.push(`asked for ${list(recipe.asks.map((a) => ASK[a].label.toLowerCase().replace(/^the /, "")))}`);
  if (recipe.noNarrowing) parts.push("no narrowing down");
  return parts.join(" · ");
}

function list(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

/** Why a deck cannot start, in the words the page shows, or null when it can. */
export function cannotStart(recipe: Recipe, preview: PracticePreview | null, kept: number): string | null {
  if (recipe.asks.length === 0) return "Pick at least one thing to be asked. A deck with no question is just a list.";
  if (!preview) return "Working it out.";
  if (preview.matched === 0) return "Nothing matches. Loosen a filter, or add a collection to draw from.";
  if (kept === 0) return "Everything was dropped. Put something back, or loosen a filter.";
  return null;
}

/** "Only 6 items match, so the deck is shorter than the 10 you asked for." */
export function shortfall(recipe: Recipe, preview: PracticePreview): string | null {
  if (recipe.size === "all" || preview.matched === 0 || preview.matched >= recipe.size) return null;
  return `Only ${preview.matched} ${preview.matched === 1 ? "item matches" : "items match"}, so the deck is shorter than the ${recipe.size} you asked for.`;
}
