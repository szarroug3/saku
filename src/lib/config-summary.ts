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

import type { AnswerStyle, QuizConfig } from "@/types";

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

  // Direction. Both selected reads as "Both directions" rather than the arrow
  // pair spelled out twice. The neither-selected case is invalid (the editor
  // enforces at least one), but a summary must never render a blank or a stray
  // separator, so it says so plainly instead of crashing or going silent.
  const { jp2en, en2jp } = cfg.dirs;
  if (jp2en && en2jp) parts.push("Both directions");
  else if (jp2en) parts.push("Japanese → English");
  else if (en2jp) parts.push("English → Japanese");
  else parts.push("No direction selected");

  // Answer style is PER DIRECTION, so only the enabled directions get a say. If
  // both are on and answered the same way it is one word ("Typed"); if they
  // differ it is "Typed / multiple choice"; if only one direction is on, that
  // direction's style is the whole answer. With no direction on there is no
  // style to state, so the segment is dropped entirely rather than guessed.
  const styles: AnswerStyle[] = [];
  if (jp2en) styles.push(cfg.styleJp2en);
  if (en2jp) styles.push(cfg.styleEn2jp);
  const distinct = [...new Set(styles)];
  if (distinct.length === 1) parts.push(styleWord(distinct[0]));
  else if (distinct.length === 2) parts.push("Typed / multiple choice");

  // Length. "Full coverage" is the editor's own name for the coverage cap, so
  // the summary uses it verbatim rather than inventing a second phrasing for
  // the same setting.
  if (cfg.length === "endless") parts.push("Endless");
  else if (cfg.limType === "cov") parts.push("Full coverage");
  else parts.push(`Limited to ${cfg.limCount}`);

  return parts.join(" · ");
}
