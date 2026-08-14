// The zero of FactCounts — no showings, nothing missed. It lives in its own module
// so a caller that only needs the empty counts (the aggregate fold's seed) does not
// drag in accuracy.ts, which statically imports the fact registry (`factsOf`) and,
// through it, the ~8.6 MB curriculum dictionary. This is the same split fact-keys.ts
// makes out of facts.ts, and the same reason: a pure constant must not pin a whole
// registry into every bundle that touches history. accuracy.ts re-exports this so
// its own callers are unaffected.

import type { FactCounts } from "@/types";

export const EMPTY_COUNTS: FactCounts = {
  seen: 0,
  missed: 0,
  firstTry: 0,
  correct: 0,
};
