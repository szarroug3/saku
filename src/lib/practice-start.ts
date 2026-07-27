import { askIsEmpty } from "@/lib/ask-config";
import type { SettingsReachability } from "@/lib/ask-forms";
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

/**
 * The reason message shown inside a disabled Start button. Returns null when
 * Start is enabled and no message is needed.
 *
 * Distinguishes between unreachable settings (e.g. audio-only with kana) and
 * the normal "you're solid" case so the message is specific and actionable.
 */
export function getStartButtonReason(
  cfg: Pick<QuizConfig, "mode" | "ask" | "pairResponses" | "gridResponses">,
  count: number,
  plannedCount: number,
  reachability?: SettingsReachability,
): string | null {
  const howBroken =
    (cfg.mode === "drill" && askIsEmpty(cfg.ask)) ||
    (cfg.mode === "pairs" && cfg.pairResponses.length === 0) ||
    (cfg.mode === "grid" && cfg.gridResponses.length === 0);
  const nothingToAsk = count > 0 && !howBroken && plannedCount === 0;
  const settingsUnreachable =
    count > 0 && !howBroken && nothingToAsk && reachability && !reachability.isReachable;

  if (!count) {
    return "Nothing is selected. Widen the filters above to start.";
  }
  if (howBroken) {
    if (cfg.mode === "pairs") return "Choose at least one pair type in the setup above.";
    if (cfg.mode === "grid") return "Choose at least one Grid response type in the setup above.";
    return "Choose at least one complete way to ask in the setup above.";
  }
  if (settingsUnreachable) {
    return (
      reachability?.reason ||
      "These settings can't be used with the selected material. Check the 'How to ask' settings above."
    );
  }
  if (nothingToAsk) {
    if (cfg.mode === "grid") return "None of the selected material has those Grid response types.";
    if (cfg.mode === "pairs") {
      return "These don't make a matching board. Pick more so at least one type has two or more pairs.";
    }
    if (cfg.mode === "substitution") {
      return "No verbs to conjugate yet — learn some, or pick material in the Library.";
    }
    return "You're solid on all of these for now. Pick another deck to drill something else.";
  }
  return null;
}
