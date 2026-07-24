import { askIsEmpty } from "@/lib/ask-config";
import type { QuizConfig } from "@/types";

/** Pure availability rule. Match pairs intentionally has no fact-level
 * preflight here: the mode owns filtering its selected pool into useful pairs. */
export function startIsDisabled(
  cfg: Pick<
    QuizConfig,
    "mode" | "ask" | "pairResponses" | "gridResponses"
  >,
  count: number,
  plannedCount: number,
): boolean {
  const howBroken =
    (cfg.mode === "drill" && askIsEmpty(cfg.ask)) ||
    (cfg.mode === "pairs" && cfg.pairResponses.length === 0) ||
    (cfg.mode === "grid" && cfg.gridResponses.length === 0);
  const nothingToAsk = count > 0 && !howBroken && plannedCount === 0;
  return !count || howBroken || nothingToAsk;
}
