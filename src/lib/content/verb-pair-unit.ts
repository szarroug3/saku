// TRANSITIVITY track — the ContentItems and VerbPairUnits of the verb pairs.
//
// A transitivity pair (src/data/transitivity-facts.ts) is one entry carrying two
// facts, one per side (happens = intransitive, doIt = transitive). `buildItem`
// turns the entry into a valid ContentItem; this file enumerates the distinct
// pair entries and reads the pair's two members back off the data for the unit.
//
// BLOCKING PREREQUISITE + ORDER. The transitivity SKILL — knowing which of a pair
// is intransitive vs transitive — is worth teaching only once you know the verbs
// themselves. So each pair is BLOCKED BY its two member verbs (the vocab words
// 開く and 開ける), not taught with the kanji pulled in ahead: if a verb is too
// rare to be in the curriculum, its pair never surfaces at all. The track then
// orders pairs by when their SHARED kanji is taught in the vocab spine — 開 before
// 閉 before … — so an unblocked pair arrives about when the learner meets its
// character. The one pair with no shared kanji (生まれる/産む) has no single base
// to sort by, so it falls to where its LAST-taught kanji lands.

import { buildItem } from "./build-item.ts";
import { TRANSITIVITY_FACTS, pairForEntry } from "@/data/transitivity-facts";
import { wordEntry } from "@/data/vocab";
import { curriculumPosition } from "@/lib/curriculum-order";
import type { ContentItem } from "./item.ts";
import type { VerbPairUnit } from "./teach-unit.ts";

const HAN = /\p{Script=Han}/u;

/** The kanji both verbs share (the base, 開), or undefined when they share none. */
function sharedKanji(intransitive: string, transitive: string): string | undefined {
  return [...intransitive].find((c) => transitive.includes(c) && HAN.test(c));
}

/** A curriculum position for sorting, with an untaught glyph (-1) sunk to the end. */
function pos(glyph: string): number {
  const p = curriculumPosition(glyph);
  return p < 0 ? Infinity : p;
}

/**
 * The distinct transitivity pairs as ContentItems — each BLOCKED BY its two member
 * verbs, ordered by when its SHARED kanji is taught (§ header). Undefined builds
 * are skipped.
 */
export function transitivityItems(): ContentItem[] {
  const seen = new Set<string>();
  const rows: { item: ContentItem; sortKey: number }[] = [];
  for (const f of TRANSITIVITY_FACTS) {
    if (seen.has(f.entry as string)) continue;
    seen.add(f.entry as string);
    const built = buildItem(f.entry, "transitivity");
    if (!built) continue;
    const pair = pairForEntry(f.entry);
    const intr = pair?.happens.word ?? built.glyph;
    const trans = pair?.doIt.word ?? "";
    const verbs = [intr, trans].filter(Boolean);
    const shared = sharedKanji(intr, trans);
    const sortKey = shared != null ? pos(shared) : Math.max(...verbs.map((w) => pos([...w][0])), 0);
    rows.push({
      item: { ...built, blockedBy: verbs.map((w) => wordEntry(w)) },
      sortKey,
    });
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows.map((r) => r.item);
}

/**
 * The VerbPairUnit of a transitivity item — one unit per item. `intransitive`
 * and `transitive` come from the pair data itself (`pairForEntry`): the
 * intransitive is the `happens` member (開く), the transitive the `doIt` member
 * (開ける) — the same order the entry key encodes (`transitivity:開く/開ける`,
 * intransitive first). Falls back to splitting that key on "/" if the pair
 * lookup misses (item.glyph alone is only the intransitive side).
 */
export function verbPairUnitsOf(item: ContentItem): VerbPairUnit[] {
  const pair = pairForEntry(item.entry);
  let intransitive: string;
  let transitive: string;
  if (pair) {
    intransitive = pair.happens.word;
    transitive = pair.doIt.word;
  } else {
    // The entry key is `transitivity:開く/開ける` — the pair half after the
    // subject prefix splits intransitive-first, matching the data order above.
    const key = String(item.entry).split(":").slice(1).join(":");
    [intransitive = "", transitive = ""] = key.split("/");
  }
  // The base is the kanji the two verbs share (開く/開ける → 開) — the true
  // common anchor, since a clean shared English word often doesn't exist. Empty
  // for the one suppletive pair that shares no kanji (生まれる/産む).
  const base = [...intransitive].find((c) => transitive.includes(c) && HAN.test(c)) ?? "";
  return [
    {
      kind: "verb-pair" as const,
      item,
      intransitive,
      transitive,
      base,
      facts: item.facts.map((f) => f.id),
      cost: 2, // both verbs are learned — the intransitive and the transitive
    },
  ];
}
