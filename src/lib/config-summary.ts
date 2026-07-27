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

import type { InputFormat, QuizConfig } from "@/types";

// Non-drill modes get a leading name; "drill" is the default and stays silent,
// so an ordinary drill reads "Text · Full coverage" with no noun in front of it.
// Kept as a lookup rather than a chain so a new mode is one line to name and
// impossible to forget in the middle of a ternary.
const MODE_LABEL: Record<Exclude<QuizConfig["mode"], "drill">, string> = {
  pairs: "Match pairs",
  grid: "Grid",
  assembly: "Build sentences",
  substitution: "Substitution",
  "listen-sentence": "Listen to sentences",
};

// The one user-facing ask axis (see InputFormat). Everything else — direction,
// responses, answer format — is automatic and always-on, so the summary no
// longer spells it out: it would be the same on every run.
const INPUT_LABEL: Record<InputFormat, string> = {
  text: "Text",
  audio: "Audio",
  both: "Both",
};

/**
 * A concise, dot-separated line of the settings QuizOptionsFields controls —
 * mode, input format, and length.
 *
 * Examples:
 *   "Text · Full coverage"
 *   "Both · Limited to 50"
 *   "Match pairs · Full coverage"
 */
export function configSummary(cfg: QuizConfig): string {
  const parts: string[] = [];

  // Mode first, and only when it is not the default drill — see MODE_LABEL.
  if (cfg.mode !== "drill") parts.push(MODE_LABEL[cfg.mode]);

  // Input format is the drill's one ask knob; the other modes don't have it.
  if (cfg.mode === "drill") parts.push(INPUT_LABEL[cfg.input]);

  // Length. "Full coverage" is the editor's own name for the coverage cap, so
  // the summary uses it verbatim rather than inventing a second phrasing for
  // the same setting.
  if (cfg.length === "endless") parts.push("Endless");
  else if (cfg.limType === "cov") parts.push("Full coverage");
  else parts.push(`Limited to ${cfg.limCount}`);

  return parts.join(" · ");
}
