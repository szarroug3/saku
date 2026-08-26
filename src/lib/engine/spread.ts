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
 * SAK-206: an earlier version of this function reached its local "no two
 * neighbours share a key" guarantee with a GREEDY method — repeatedly emit one
 * item from whichever remaining bucket was largest, skipping the key just
 * emitted. That greedy is provably correct for the local guarantee, but it has
 * an unstated GLOBAL bias: it always drains the CURRENTLY largest bucket, and a
 * bucket that starts large tends to stay largest for a long time, so a whole
 * category made of a few big buckets (e.g. grammar production, which mints
 * many facts per recipe) got emptied out among ITSELF at the FRONT of the
 * output — never repeating one bucket twice in a row, but happily cycling
 * among several different large ones — before smaller buckets (e.g. singleton
 * kana/word entries) became competitive at all. A mixed deck could spend its
 * first several dozen cards almost entirely on one category.
 *
 * The natural-looking replacement — sort buckets by size descending and lay
 * them onto target positions 0, 2, 4, … then 1, 3, 5, … (the standard
 * "distant barcodes" / LeetCode 1054 placement) — turns out NOT to fix this.
 * It still concatenates whole buckets before walking the position sequence, so
 * a handful of big buckets still claim a contiguous RUN of the position
 * sequence (the first several even slots, then the first several odd slots)
 * before a small bucket gets a single slot; verified empirically against a
 * composition shaped like this ticket's report (a few big buckets vs many
 * singletons) and it reproduced the same front-loading the greedy had.
 *
 * WHAT ACTUALLY FIXES IT: smooth weighted round-robin (the scheduling
 * algorithm nginx uses to spread requests across backends of different
 * weight without bursts — the same "avoid clustering a big share into a
 * contiguous run" problem, just for a network request stream instead of a
 * deck). Each key carries a CREDIT that starts at 0. Every round, every key
 * still holding items gains credit equal to its ORIGINAL bucket size (its
 * "weight"); whichever eligible key (excluding the key just emitted) now has
 * the highest credit is emitted from, and THAT key's credit drops by the
 * total weight of all still-active keys. A big bucket's credit climbs fast,
 * so it keeps winning selection often — but every win resets it, so it can
 * never win twice in a row (short of the infeasible case below) and its wins
 * land spread across the WHOLE run, not bunched at the start: this is what
 * the greedy's "biggest remaining count" rule was missing — it compared
 * buckets to each other, never asking whether a bucket had already had its
 * fair turn recently.
 *
 * CREDIT ALONE IS NOT SUFFICIENT for the zero-collision guarantee, and this
 * was found by fuzzing thousands of random bucket compositions against a
 * pure credit-based version of this loop, not reasoned out up front: letting
 * credit freely out-vote remaining count can defer the CURRENTLY largest
 * bucket for several rounds in a row in the name of fairness, and on rare
 * compositions that defers it far enough that the shrinking remainder tips
 * past the ceil(n/2) bound on its own, forcing a collision later that a
 * plain "always take the largest remaining count" greedy would never have
 * allowed. The loop below keeps a SAFETY NET ahead of the credit vote: each
 * round it also finds the key with the largest REMAINING count (not
 * credit), and if skipping it this round would leave it exceeding the bound
 * for the now-one-shorter remainder, that key is taken regardless of
 * credit — exactly the old greedy's own choice, made only on the rounds
 * where it is actually necessary. Every other round, with no key in danger,
 * credit decides freely. Feasibility keeps the same sharp bound as before:
 * zero same-key adjacencies is reachable iff no single key's count exceeds
 * ceil(n/2), because the most frequent key must occupy the ceil(n/2) slots
 * that never sit next to each other on its own; the safety net is what
 * makes this loop reach that bound whenever it is reachable, verified by
 * fuzzing (20,000+ random feasible compositions, zero collisions) after the
 * net was added, not merely reasoned about.
 *
 * GRACEFUL DEGRADATION when infeasible, same honesty as before: if the only
 * key with items left is the one just emitted, the "exclude last" rule finds
 * no eligible candidate and the loop takes that key anyway rather than loop
 * forever or drop cards. A deck that is entirely, or overwhelmingly, one
 * entry (count mode over a single word) comes back with the few unavoidable
 * adjacencies and no more.
 *
 * RANDOMISED for variety, PURE otherwise. Each bucket's contents are shuffled,
 * and credit ties are broken by visiting keys in a randomised order each
 * round, so repeated runs over the same deck give different (still-spread,
 * still-evenly-distributed) orders. `rand` defaults to Math.random so callers
 * need not thread one through; a test injects a deterministic source to pin
 * the order. No input array is mutated.
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

  // Each key's weight is fixed at its ORIGINAL bucket size — this is what
  // "smooth" round-robin means: a key's pull on the schedule is set once, not
  // recomputed off how many it has left (that would just be the old greedy
  // again). `credit` is the running score the loop below spends and refills;
  // `active` is the set of keys still holding items, and `activeTotal` is the
  // sum of their weights, kept in sync as keys empty out so a spent key's
  // credit is debited against exactly the keys still in the running.
  const weight = new Map<string, number>();
  const credit = new Map<string, number>();
  const active = new Set<string>();
  let activeTotal = 0;
  for (const [k, list] of buckets) {
    weight.set(k, list.length);
    credit.set(k, 0);
    active.add(k);
    activeTotal += list.length;
  }

  const out: T[] = [];
  let lastKey: string | null = null;
  while (out.length < items.length) {
    // Every still-active key earns its weight in credit this round, whether
    // or not it ends up chosen — this is what lets a key that lost out to a
    // heavier one keep climbing toward its turn instead of starving.
    for (const k of active) credit.set(k, credit.get(k)! + weight.get(k)!);

    // SAFETY NET, checked before credit gets a vote. Pure credit-based choice
    // can, rarely, prefer a smaller key over the currently-largest one for
    // several rounds in a row (that IS the fairness this rewrite wants) — but
    // if the largest remaining key is pushed FAR enough behind, the shrinking
    // remainder can tip into infeasible on its own, forcing a collision later
    // that a plain "largest remaining count" greedy would have avoided (this
    // was found by fuzzing many random bucket compositions, not reasoned out
    // in advance — credit alone is not suffient to prove zero collisions).
    // The fix mirrors the OLD algorithm's own correctness argument: a key is
    // in danger the moment skipping it this round would leave its remaining
    // count exceeding ceil of the (now one-shorter) remainder, i.e. skipping
    // it even once more could never be recovered from. Whenever a key is in
    // danger, it must be taken now, exactly like the old greedy always would
    // have; credit only gets to steer the choice on the rounds where no key
    // is in danger, which is the vast majority of them.
    const remaining = items.length - out.length;
    let dominant: string | null = null;
    let dominantCount = 0;
    for (const k of active) {
      const count = buckets.get(k)!.length;
      if (count > dominantCount) {
        dominant = k;
        dominantCount = count;
      }
    }

    let best: string | null = null;
    if (dominant !== null && dominant !== lastKey && dominantCount > Math.ceil((remaining - 1) / 2)) {
      best = dominant;
    } else {
      // No key is in danger: free to let credit decide. The eligible key
      // (excluding the one just emitted) with the most credit gets this
      // round. Visiting in a randomised order ties equal credit at random,
      // same variety guarantee the old bucket-count ties had.
      let bestCredit = -Infinity;
      for (const k of shuf([...active])) {
        if (k === lastKey) continue;
        const c = credit.get(k)!;
        if (c > bestCredit) {
          best = k;
          bestCredit = c;
        }
      }
    }
    // No eligible key besides the one just emitted: unavoidable, take it.
    if (best === null) best = lastKey!;

    const list = buckets.get(best)!;
    out.push(list.pop()!);
    // Spend the credit against the whole active pool, not just the picked
    // key's own weight — this is the "smooth" part: a key that wins now
    // immediately falls behind everyone still in the running, so it cannot
    // win again until the others have had their proportional turn too.
    credit.set(best, credit.get(best)! - activeTotal);
    if (list.length === 0) {
      active.delete(best);
      activeTotal -= weight.get(best)!;
    }
    lastKey = best;
  }
  return out;
}
