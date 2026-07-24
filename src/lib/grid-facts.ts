import { KANA_SUBJECT } from "@/data/characters";
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
  return facts.filter((fact) => {
    const info = factInfo(fact);
    if (!info) return false;
    const response = jp2enResponse(fact);
    const english =
      wanted.has("definition") &&
      (response === "definition" || info.subject === KANA_SUBJECT);
    const reading =
      wanted.has("romaji") &&
      response === "romaji" &&
      /\p{Script=Han}/u.test(info.glyph);
    return english || reading;
  });
}
