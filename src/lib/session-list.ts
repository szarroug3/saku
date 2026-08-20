import { emptySelection } from "@/lib/selection";
import type { SavedList } from "@/types";

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
