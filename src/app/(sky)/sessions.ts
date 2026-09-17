// Recent sessions from the app's history records (SAK-347): each record's
// facts as Sky items with the grade the quiz would give from its counts.
// Server-side and dev-only, like the adapters beside it.

import { entryOf, factInfo } from "@/lib/facts";
import { gradeFromCounts, type SessionKind, type SkySession } from "@/sky/lib/sessions";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId } from "@/types/facts";
import type { HistoryFile, QuizSessionRecord } from "@/types/store";

import { offerPicker } from "./observatory";

const MOST = 100;

/** Which screen a record came from. Practice first, because a practice run
 * is recorded as a drill like any quiz (SAK-441) and the only thing that
 * tells the two apart is the mark the run put on it. */
function kindOf(record: QuizSessionRecord): SessionKind {
  if (record.practice) return "practice";
  return record.mode === "drill" ? "quiz" : record.mode === "assembly" ? "ordering" : "other";
}

export function sessionsFromHistory(history: HistoryFile, now = Date.now()): SkySession[] {
  const o = offerPicker(history, now);
  const out: SkySession[] = [];
  for (const record of [...history.sessions].sort((a, b) => b.ts - a.ts).slice(0, MOST)) {
    const cards = [];
    for (const [fact, counts] of Object.entries(record.facts) as [FactId, QuizSessionRecord["facts"][FactId]][]) {
      if (!factInfo(fact)) continue;
      const item = o.offerPick(entryOf(fact));
      if (!item) continue;
      const { components: _parts, ...lean } = item;
      cards.push({ id: fact as string, item: lean as SkyItem, grade: gradeFromCounts(counts), seen: counts.seen });
    }
    if (!cards.length) continue;
    const name = record.practice?.name;
    out.push({ id: record.id ?? String(record.ts), when: record.ts, kind: kindOf(record), ...(name ? { name } : {}), cards });
  }
  return out;
}
