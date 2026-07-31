import { emptySelection } from "@/lib/selection";
import { entryOf } from "@/lib/facts";
import type { FactId, SavedList } from "@/types";

/** A finished session as a DERIVED list — a rule that re-selects it by its
 * timestamp. Idempotent id so re-saving overwrites rather than duplicating. */
export function deriveSessionList(ts: number): SavedList {
  return {
    kind: "derived",
    id: `session-${ts}`,
    name: `Session ${new Date(ts).toLocaleDateString()}`,
    created: Date.now(),
    query: { ...emptySelection(), session: ts },
    origin: "session",
  };
}

/** An in-progress run as a FIXED list of its material (a run is not a committed
 * session, so a derived session rule would resolve to nothing). Null if empty. */
export function fixedRunList(
  runId: string,
  name: string,
  facts: readonly FactId[],
): SavedList | null {
  const entries = [...new Set(facts.map((f) => entryOf(f)))];
  if (!entries.length) return null;
  return {
    kind: "fixed",
    id: `run-${runId}`,
    name,
    created: Date.now(),
    entries,
    origin: "manual",
  };
}
