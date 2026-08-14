// summaryOfEntry — an entry's mean accuracy across its practised facts.
//
// Split out of accuracy.ts because it is the ONE function there that needs the fact
// registry (`factsOf`). Keeping it here lets accuracy.ts stay content-free, so the
// many history-touching modules that use its pure rate math (use-history, aggregate,
// the HUDs) don't drag the ~8.6 MB curriculum dictionary into their bundles — the
// same barrel-avoidance split fact-keys.ts makes out of facts.ts. (Phase 2 removes
// the facts.ts barrel wholesale; this is the narrow Phase-1 cut that keeps it off
// /learn.)

import { factsOf } from "@/lib/facts";
import { accuracyOf } from "@/lib/accuracy";
import type { CountsByFact, EntrySummary } from "@/lib/accuracy";
import type { AccuracyMetric, EntryId } from "@/types";

/** An entry's summary accuracy, or null when none of its facts is practised. */
export function summaryOfEntry(
  history: CountsByFact,
  entry: EntryId,
  metric: AccuracyMetric,
): EntrySummary | null {
  let sum = 0;
  let facts = 0;
  let seen = 0;
  for (const f of factsOf(entry)) {
    const agg = history.facts[f];
    const pct = agg ? accuracyOf(agg, metric) : null;
    if (pct === null) continue; // never practised — unknown, not zero
    sum += pct;
    facts++;
    seen += agg!.seen;
  }
  if (!facts) return null;
  return { meanPct: Math.round(sum / facts), facts, seen };
}
