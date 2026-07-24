// Every fact the learner has in their knowledge base — for the confusion
// search space, and nothing heavier.
//
// A fact is KNOWN once it is one of three things, which are exactly the three
// records HistoryFile keeps beside `sessions`:
//
//   - in `facts`   — it has an aggregate, so it has been ANSWERED at least once;
//   - in `claims`  — the learner SAID they know it ("I already know this");
//   - in `seen`    — the learner asked to be QUIZZED on it ("quiz me").
//
// That is the same "in your knowledge base" the seen/claims docs describe, and
// it is deliberately the union rather than a stricter "mastered": a confusion is
// a candidate the learner could plausibly have MEANT, and any entry they have
// met is a plausible thing to mix another up with. The precision guard lives
// downstream — `confusedWith` claims a pair only when EXACTLY ONE known entry
// answers to what was typed — so a generous membership here cannot fabricate.
//
// Data-free by construction: it reads keys off a plain HistoryFile and restores
// their brand, importing nothing but the cast. Keeping it out of history.ts
// (server-only) and word-unlock.ts (drags the kanji registry) lets the drill
// pull it into the client bundle without either weight.

import { factKeys } from "@/lib/fact-keys";
import type { FactId, HistoryFile } from "@/types";

/**
 * The distinct facts the learner has learned, in no particular order.
 *
 * The union of `facts`, `claims` and `seen` keys — see the module header for why
 * those three and not a stricter set. Deduped, so a fact that is both answered
 * and claimed appears once.
 */
export function knownFactIds(history: HistoryFile): FactId[] {
  const out = new Set<FactId>(factKeys(history.facts));
  if (history.claims) for (const f of factKeys(history.claims)) out.add(f);
  if (history.seen) for (const f of factKeys(history.seen)) out.add(f);
  return [...out];
}
