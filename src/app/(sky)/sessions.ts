// Recent sessions from the app's history records (SAK-347): each record's
// facts as Sky items with the grade the quiz would give from its counts.
// Server-side and dev-only, like the adapters beside it.

import { entryOf, factInfo } from "@/lib/facts";
import { gradeFromCounts, type SessionKind, type SkySession } from "@/sky/lib/sessions";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

import { offerPicker } from "./observatory";

const MOST = 100;

function kindOf(record: QuizSessionRecord): SessionKind {
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
    out.push({ id: record.id ?? String(record.ts), when: record.ts, kind: kindOf(record), cards });
  }
  return out;
}
