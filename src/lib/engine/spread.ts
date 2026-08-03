// The deck's "spread within a fact" reordering. Kept in its own leaf module —
// zero imports, pure generic — so a caller can use it WITHOUT dragging the
// engine barrel (grammar/mc, results, the fact registry) into its module graph.
// ask-forms.ts needs exactly this and nothing else from engine; importing the
// barrel there perturbs subject-data load order. Re-exported from @/lib/engine
// so barrel consumers are unchanged. Same split reason as engine/results.ts and
// fact-keys.ts.

/**
 * Reorder `items` so that neighbours rarely share a key — the deck's "spread
 * within a fact" rule. A word deals several cards that all name the SAME entry
 * (its reading and meaning cards, and for a multi-reading word like 日 also the
 * reading/meaning cards of each reading), and a plain shuffle can land two of
 * them back-to-back, so the learner meets 日 twice in a row. Keying on the entry
 * (entryOf) and pushing equal keys apart fixes that generally: kanji
 * reading+meaning, keigo's two production cards, count-mode's repeated copies of
 * one fact — every group of same-entry cards benefits, not just words.
 *
 * The method is the standard "reorganize so identical items are as far apart as
 * possible" greedy (task-scheduler / reorganize-string): bucket by key, then
 * repeatedly emit one item from the key with the MOST remaining, skipping the
 * key just emitted so no two neighbours match. This reaches ZERO same-key
 * adjacencies exactly when it is FEASIBLE, and feasibility has a sharp bound: it
 * is possible iff no single key's count exceeds ceil(n/2). Intuitively the most
 * frequent key must sit in the "even" slots (0, 2, 4 …); there are ceil(n/2) of
 * them, so a key with more copies than that is forced against itself somewhere
 * no matter the order.
 *
 * GRACEFUL DEGRADATION when infeasible. If the only key with items left is the
 * one we just emitted (a deck that is entirely, or overwhelmingly, one entry —
 * e.g. count mode over a single word), we emit it anyway rather than loop
 * forever or drop cards. The result then holds the few unavoidable adjacencies
 * and no more; a deck of one entry simply cannot be spread, and returning it in
 * order is the honest outcome.
 *
 * RANDOMISED for variety, PURE otherwise. Each bucket's contents are shuffled
 * and ties in "most remaining" are broken at random, so repeated runs over the
 * same deck give different (still-spread) orders. `rand` defaults to Math.random
 * so callers need not thread one through; a test injects a deterministic source
 * to pin the order. No input array is mutated.
 */
export function spread<T>(
  items: T[],
  keyOf: (t: T) => string,
  rand: () => number = Math.random,
): T[] {
  if (items.length <= 1) return items.slice();

  const shuf = <U>(arr: U[]): U[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Bucket by key, shuffling each bucket so equal-key items come out in a random
  // order rather than input order.
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const list = buckets.get(k);
    if (list) list.push(item);
    else buckets.set(k, [item]);
  }
  for (const list of buckets.values()) shuf(list);

  // Each round picks the key with the most items left whose key differs from the
  // last emitted, breaking count ties randomly. When only the last-emitted key
  // remains, it is emitted anyway (the infeasible case).
  const out: T[] = [];
  let lastKey: string | null = null;
  while (out.length < items.length) {
    let best: string | null = null;
    let bestCount = 0;
    // Visit keys in a randomised order so equal counts tie-break at random.
    for (const k of shuf([...buckets.keys()])) {
      const count = buckets.get(k)!.length;
      if (count === 0) continue;
      if (k === lastKey) continue;
      if (count > bestCount) {
        best = k;
        bestCount = count;
      }
    }
    // Only the just-emitted key has items left: unavoidable, take it.
    if (best === null) best = lastKey;
    const list = buckets.get(best!)!;
    out.push(list.pop()!);
    if (list.length === 0) buckets.delete(best!);
    lastKey = best;
  }
  return out;
}
