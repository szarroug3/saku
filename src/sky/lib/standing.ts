// Standings: the one status vocabulary every Sky surface shares, so a color
// means the same thing on the sky, in the Atlas, in the Planetarium and in
// Practice. Tracked as SAK-294.
//
// The words are the app's own, from src/lib/library/standing.ts. The decision
// that picks one of them is the app's too, and stays there: this file once
// carried a copy of it, with a test proving the copy agreed on every scenario,
// and nothing in the Sky ever called the copy. A standing reaches a Sky
// surface already decided, on the catalogue or the payload, so what is left
// here is the vocabulary and how it paints (SAK-433).
//
//   not seen       no showings, no claim ....... it has never asked you.
//   claimed        met or claimed, untested .... opened in a lesson, or marked
//                                                known; not yet asked. Shown
//                                                as "untested" (Sam, 2026-09-06).
//   solid          ≥ 80% of recent runs ........ eight in ten or better.
//   getting there  ≥ 60% of recent runs ........ six in ten or better.
//   shaky          < 60% of recent runs ........ fewer than six in ten.
//   slipping       lost, but you HAVE seen it .. you had it. It's gone.
//
// Slipping is a standing and nothing more (SAK-442). A thing the learner has
// met stays met however badly it goes, so nothing puts it back on the list of
// things to learn: it wears the slipping color in the sky and in the Atlas,
// it fills Practice's slipping cut, and the learner drills it when they
// choose. The page under a missed quiz card is the answer's explanation, not
// a lesson starting over.
//
// Two lesson-only visual states are NOT standings and never appear as chips:
// "tonight" (picked: a wide halo over its own paint) and "lit" (opened during
// this lesson). Inside the lesson a star is locked, open, lit or selected, and
// nothing else. See `LessonState`.

export type Standing =
  | "not-seen"
  | "claimed"
  | "solid"
  | "getting-there"
  | "shaky"
  | "slipping";

/** The order every legend, filter and coverage bar shows them: best first,
 * then the two the app has no evidence for. */
export const STANDING_ORDER: readonly Standing[] = ["solid", "getting-there", "shaky", "slipping", "claimed", "not-seen"];

/**
 * How each standing reads and paints. The classes are the `--sky-<standing>`
 * alias tokens in globals.css, so a screen never has to remember that mint
 * means solid. `text` is what a chip's label uses; for "not seen" that is
 * muted, because its dot color (star-dim) is decorative and sits under the
 * text floor on purpose.
 */
export const STANDING: Record<Standing, { label: string; dot: string; text: string; border: string; meaning: string }> = {
  solid: { label: "solid", dot: "bg-sky-solid", text: "text-sky-solid", border: "border-sky-solid/40", meaning: "You got at least 8 of the last 10 attempts correct" },
  "getting-there": { label: "getting there", dot: "bg-sky-getting-there", text: "text-sky-getting-there", border: "border-sky-getting-there/40", meaning: "You got at least 6 of the last 10 attempts correct" },
  shaky: { label: "shaky", dot: "bg-sky-shaky", text: "text-sky-shaky", border: "border-sky-shaky/40", meaning: "You got fewer than 6 of the last 10 attempts correct" },
  slipping: { label: "slipping", dot: "bg-sky-slipping", text: "text-sky-slipping", border: "border-sky-slipping/40", meaning: "You had this, and Saku no longer expects you'd get it right today. Drill it when you choose; it is not taught again" },
  claimed: { label: "untested", dot: "bg-sky-claimed", text: "text-sky-claimed", border: "border-sky-claimed/40", meaning: "Opened in a lesson or marked as known, but not tested yet" },
  // The app's word is "not seen"; the sky's is "undiscovered" (Sam, 2026-09-04), since the sky is about discovery.
  "not-seen": { label: "undiscovered", dot: "bg-sky-not-seen", text: "text-sky-muted", border: "border-sky-line", meaning: "You haven't opened this in a lesson, and haven't claimed it" },
};

/**
 * The standing's word as a line starts it: "Getting there", not "Getting
 * There" (SAK-363). `label` stays lowercase because it is also spoken inside
 * a sentence ("Hide getting there", a coverage bar's read-out); anything that
 * shows the word on its own uses this. CSS `capitalize` was doing it before,
 * and capitalized every word.
 */
export function standingWord(standing: Standing): string {
  const label = STANDING[standing].label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

