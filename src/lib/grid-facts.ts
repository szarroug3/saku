import { jp2enResponse } from "@/lib/ask-forms";
import { factInfo } from "@/lib/facts";
import type { FactId, GridResponse } from "@/types";

/**
 * The selected facts that Grid can deal for the requested response types.
 * Grid is deliberately simpler than Drill: Japanese text prompt, typed
 * response, one existing fact per compact cell.
 */
export function gridFacts(
  facts: readonly FactId[],
  responses: readonly GridResponse[],
): FactId[] {
  const wanted = new Set(responses);
  return facts.filter(
    (fact) => factInfo(fact) && wanted.has(jp2enResponse(fact)),
  );
}
