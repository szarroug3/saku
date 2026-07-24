// A one-line, human summary of the BUILDER settings a quiz will run with —
// mode, direction, answer style, and length. It exists so a launch point that
// drops you straight into a drill (the Library's "Quiz me", the rest screen
// between rounds) can still SAY what config is in effect, and so the "Change"
// affordance beside it edits exactly the settings this line names.
//
// WHY A SECOND SUMMARY, next to start-bar.tsx's howSentence? They read the same
// four fields but answer different questions. howSentence is the Practice
// page's live caption sitting directly above the editor, so it leans on the
// editor being visible: for grid it collapses to just "Grid", because the row
// right below it already states grid takes no direction or length. This line
// stands alone at a launch point with nothing else on screen, so it names all
// four parts every time — you should be able to read the whole run off it
// without opening the editor first. That is why grid here is
// "Grid · Both directions · Typed · Endless" and not the bare "Grid" howSentence
// gives. Keeping them separate lets each say the right amount for where it sits,
// rather than one straddling both and being wrong in one place.
//
// Pure and React-free on purpose: it is unit-tested here and imported by a
// client component, and a plain (cfg) => string is the whole of what both need.

import {
  enabledDirs,
  sentenceAsksRomaji,
  sentenceAsksSelection,
} from "@/lib/ask-config";
import type { AnswerStyle, AskConfig, QuizConfig } from "@/types";

// Non-drill modes get a leading name; "drill" is the default and stays silent,
// so an ordinary drill reads "Both directions · Typed · Endless" with no noun
// in front of it. Kept as a lookup rather than a chain so a new mode is one
// line to name and impossible to forget in the middle of a ternary.
const MODE_LABEL: Record<Exclude<QuizConfig["mode"], "drill">, string> = {
  pairs: "Match pairs",
  grid: "Grid",
  assembly: "Build sentences",
  substitution: "Substitution",
  "listen-sentence": "Listen to sentences",
};

function styleWord(s: AnswerStyle): string {
  return s === "typed" ? "Typed" : "Multiple choice";
}

/** Every answer format any enabled source offers — the Japanese source (only
 * when it can actually ask, i.e. has a response too) and the English source. */
function answerFormats(ask: AskConfig): AnswerStyle[] {
  const out: AnswerStyle[] = [];
  const { jp2en, en2jp } = enabledDirs(ask);
  if (jp2en) out.push(...ask.japanese.answers);
  if (sentenceAsksSelection(ask)) out.push("mc");
  if (sentenceAsksRomaji(ask)) out.push(...ask.sentence.answers);
  if (en2jp) out.push(...ask.english.answers);
  return out;
}

/**
 * A concise, dot-separated line of the settings QuizOptionsFields controls.
 *
 * Examples:
 *   "Both directions · Typed · Endless"
 *   "Japanese → English · Multiple choice · Limited to 50"
 *   "Grid · Both directions · Typed · Endless"
 */
export function configSummary(cfg: QuizConfig): string {
  const parts: string[] = [];

  // Mode first, and only when it is not the default drill — see MODE_LABEL.
  if (cfg.mode !== "drill") parts.push(MODE_LABEL[cfg.mode]);

  // Direction, INFERRED from the sources (see enabledDirs). Both reads as "Both
  // directions" rather than the arrow pair spelled out twice. The neither case
  // is invalid (the editor disables Start), but a summary must never render a
  // blank or a stray separator, so it says so plainly.
  const { jp2en, en2jp } = enabledDirs(cfg.ask);
  if (jp2en && en2jp) parts.push("Both directions");
  else if (jp2en) parts.push("Japanese → English");
  else if (en2jp) parts.push("English → Japanese");
  else parts.push("Nothing to ask");

  // Audio is a prompt format, not a mode — name it when the Japanese source
  // includes it, so a launch line says listening is in the run.
  if (
    cfg.ask.japanese.prompts.includes("audio") ||
    cfg.ask.sentence.prompts.includes("audio")
  ) {
    parts.push("Audio");
  }

  // Answer format, pooled across the enabled sources. One word when they all
  // agree; "Typed / multiple choice" when both formats are in play; dropped
  // when nothing is selected.
  const styles = new Set<AnswerStyle>(answerFormats(cfg.ask));
  if (styles.size === 1) parts.push(styleWord([...styles][0]));
  else if (styles.size === 2) parts.push("Typed / multiple choice");

  // Length. "Full coverage" is the editor's own name for the coverage cap, so
  // the summary uses it verbatim rather than inventing a second phrasing for
  // the same setting.
  if (cfg.length === "endless") parts.push("Endless");
  else if (cfg.limType === "cov") parts.push("Full coverage");
  else parts.push(`Limited to ${cfg.limCount}`);

  return parts.join(" · ");
}
