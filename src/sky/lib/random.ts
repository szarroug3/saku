// Chance, where the sky wants it repeatable.
//
// Two kinds of randomness live in the Sky and they want opposite things.
// A placement is seeded so it never moves: the same word is the same shape
// in the same spot every time it is drawn, which is what `hashUnit` in
// constellation.ts and the wash's star fields are for. A quiz's order is
// the other kind: it should differ every time, or the second round is
// answered from the rhythm of the first.
//
// Both are served from here. `seeded` is the generator the wash has always
// used; `shuffled` takes whichever source of numbers the caller wants,
// Math.random for a fresh order and a seeded one where a re-render must
// not reorder what is already on screen.

/** A small seeded generator (mulberry32): the same seed gives the same run
 * of numbers, so whatever is drawn from it can be drawn again. */
export function seeded(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of the list in a random order (Fisher-Yates). The source is
 * handed in so a caller that must not reorder on a re-render can pass a
 * seeded one. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
