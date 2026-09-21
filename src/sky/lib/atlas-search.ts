// Where a search lands when the open collection holds none of it (SAK-475).
//
// Sam, in the Atlas with Sentences open, searched を: "0 Shown · Matching を.
// Nothing in Sentences matches. Also found: 1 Kana, 17 Words, 1 Grammar." Her
// words were "search を doesn't bring up the page". The 〜を page was there the
// whole time, one collection over. A chip counted it. Nothing drew it.
//
// She was not in the wrong collection either. Saku calls the particles
// "Particle" and offers them in the Observatory's Sentences row, so Sentences
// is where a learner goes to look one up, and scoping search to the open
// collection makes it the one place the answer cannot be. So when the open
// collection finds nothing, the other collections' matches are drawn where she
// is already looking, as tiles under each collection's name. The chips stay:
// they are still how you switch collection.
//
// This is the order those groups come in, and the order inside one. It is data
// in and data out so the rule can be read without a browser: the Atlas hands
// it the groups the search came back with and draws what it gets back.

import type { SkyItem, SkyKind } from "./types";

/** One collection's share of a search: which shelf it is, and what it found.
 * The Atlas writes these down by handing them over, so the name stays here. */
interface FoundOnShelf {
  kind: SkyKind;
  items: readonly SkyItem[];
}

/** Hiragana, katakana, the halfwidth katakana, and the long vowel mark. */
const KANA = /^[ぁ-ゟ゠-ヿｦ-ﾝ]+$/;

/** A pattern's written form, with the placeholder off it: 〜を is を.
 *
 * The placeholder is what tells a learner the pattern attaches to something,
 * and it is exactly what stops a typed を from looking like a match. Both ends,
 * since 〜ている carries it in front and ～ば carries one behind. */
const written = (glyph: string) => glyph.replace(/^[〜～]+|[〜～]+$/g, "");

/**
 * The other collections' matches, in the order they are drawn.
 *
 * GRAMMAR FIRST WHEN THE QUERY IS KANA. Type a run of kana into the Atlas and
 * you have typed either a word you heard or a particle, and the particles are
 * what a beginner is looking up. Every particle is kana, so asking whether the
 * query is kana asks whether it could be one; a kanji or an English meaning
 * leaves the collections in the shelves' own teaching order, which is what the
 * rail reads down and what the search already came back in.
 *
 * EXACT FIRST INSIDE A GROUP. 〜を is the page the を was typed for, and it
 * cannot be allowed to sit behind 〜を + a verb because the search ranked them
 * together. Everything else keeps the order it arrived in, which is the app's
 * own ranking.
 */
export function alsoFound<G extends FoundOnShelf>(groups: readonly G[], shelves: readonly SkyKind[], query: string): G[] {
  const q = query.trim();
  const rank = (kind: SkyKind) => {
    if (KANA.test(q) && kind === "grammar") return -1;
    const at = shelves.indexOf(kind);
    return at < 0 ? shelves.length : at;
  };
  // ONE TILE, ONCE. A pattern is on two shelves, Grammar and Sentences, so the
  // search can bring it back under both. Drawn here it is one page, so the
  // first group to hold it keeps it and a group left with nothing is dropped.
  const drawn = new Set<string>();
  return groups
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => Number(written(b.glyph) === q) - Number(written(a.glyph) === q)) }))
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .map((g) => ({ ...g, items: g.items.filter((it) => !drawn.has(it.id) && !!drawn.add(it.id)) }))
    .filter((g) => g.items.length > 0);
}
