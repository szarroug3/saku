// Standings: the one status vocabulary every Sky surface shares, so a colour
// means the same thing on the sky, in the Atlas, in the Planetarium and in
// Practice. Tracked as SAK-294.
//
// The words are the app's own, from src/lib/library/standing.ts, and so is the
// decision table: this file is the Sky's copy of it (the boundary forbids the
// import), and sky/lib/standing.test.ts proves the copy agrees with the
// original on every scenario. What the Sky does NOT copy is the scoring model
// behind `recall`: the caller hands that reading in, already made.
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
// Two lesson-only visual states are NOT standings and never appear as chips:
// "tonight" (picked, unlearned: faint and dashed) and "lit" (opened during
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

/** At least 60% of recent runs is "getting there"; at least 80% is solid. */
export const GETTING_THERE_PCT = 60;
export const SOLID_PCT = 80;

/**
 * How each standing reads and paints. The classes are the `--sky-<standing>`
 * alias tokens in globals.css, so a screen never has to remember that mint
 * means solid. `text` is what a chip's label uses; for "not seen" that is
 * muted, because its dot colour (star-dim) is decorative and sits under the
 * text floor on purpose.
 */
export const STANDING: Record<Standing, { label: string; dot: string; text: string; border: string; meaning: string }> = {
  solid: { label: "solid", dot: "bg-sky-solid", text: "text-sky-solid", border: "border-sky-solid/40", meaning: "You got at least 8 of the last 10 attempts correct" },
  "getting-there": { label: "getting there", dot: "bg-sky-getting-there", text: "text-sky-getting-there", border: "border-sky-getting-there/40", meaning: "You got at least 6 of the last 10 attempts correct" },
  shaky: { label: "shaky", dot: "bg-sky-shaky", text: "text-sky-shaky", border: "border-sky-shaky/40", meaning: "You got fewer than 6 of the last 10 attempts correct" },
  slipping: { label: "slipping", dot: "bg-sky-slipping", text: "text-sky-slipping", border: "border-sky-slipping/40", meaning: "You haven't tested this recently" },
  claimed: { label: "untested", dot: "bg-sky-claimed", text: "text-sky-claimed", border: "border-sky-claimed/40", meaning: "Opened in a lesson or marked as known, but not tested yet" },
  // The app's word is "not seen"; the sky's is "undiscovered" (Sam, 2026-09-04), since the sky is about discovery.
  "not-seen": { label: "undiscovered", dot: "bg-sky-not-seen", text: "text-sky-muted", border: "border-sky-line", meaning: "You haven't learned this yet" },
};

/** True when the app is willing to count it as known: proved, or claimed. The
 * same bar the current Library's "known" filter uses, per fact. */
export function isKnown(standing: Standing): boolean {
  return standing === "solid" || standing === "claimed";
}

/** True when the item belongs in the learner's sky at all: anything met or
 * claimed. "Not seen" is the one standing that is not a star yet. */
export function isInSky(standing: Standing): boolean {
  return standing !== "not-seen";
}

/** What tonight's drill reaches for first: the two standings that say the
 * learner had it and is losing it, or never quite had it. */
export function needsWork(standing: Standing): boolean {
  return standing === "shaky" || standing === "slipping";
}

/**
 * Everything `standingOf` needs to know about one fact. The caller has
 * already run the app's model: `recall` is its reading of the fact's effective
 * state (history, claims and "quiz me" resolved, newest record winning) at the
 * moment in question, and `recentAccuracy` its score over the last ten runs.
 * Neither number is a prediction the UI could leak: one is an action word,
 * the other a count over a count.
 */
export interface StandingEvidence {
  /** Showings. 0 for anything never answered, including a claim, which
   * records no counts on purpose. */
  seen: number;
  /** The model's verdict at `now`: teach (never met, or lost), probe (unsure),
   * quiet (expects you to recall it right now). */
  recall: "teach" | "probe" | "quiet";
  /** Percent of the last ten runs that landed (or of all showings when there
   * are no runs on record); null when there is nothing to score. */
  recentAccuracy: number | null;
  /** When the learner said "I already know this", if ever. */
  claimedAt?: number;
  /** When the fact was last really tested. */
  lastTested?: number;
}

/** One word for how it is going. The same crossing the app makes: the model's
 * recency reading AND the learner's record, and "solid" needs both. */
export function standingOf(e: StandingEvidence): Standing {
  const seen = e.seen ?? 0;
  const tested = e.lastTested ?? 0;
  // A claim never tested gets its own word, checked before any arithmetic: it
  // reports the act, not a finding. Once its belief has decayed to "teach" it
  // reads "not seen", as untested material should.
  if (!seen && e.claimedAt && e.recall !== "teach") return "claimed";
  if (!seen) return "not-seen";
  // A newer claim over tested material is the learner marking it known now;
  // the next real test can still move it back out.
  if (e.claimedAt && e.claimedAt > tested) return "solid";
  // Showings behind it, lost to time: re-teach, not re-test.
  if (e.recall === "teach") return "slipping";
  const pct = e.recentAccuracy;
  if (pct !== null && pct >= SOLID_PCT) return "solid";
  return pct !== null && pct >= GETTING_THERE_PCT ? "getting-there" : "shaky";
}

/**
 * The lesson's own vocabulary for a star, which is not a standing. A star
 * there is locked (its prerequisites are not lit yet), open (clickable), lit
 * (opened during this lesson; once lit it stays lit) or selected (the one the
 * panel is showing). Standings never appear inside the lesson.
 */
export type LessonState = "locked" | "open" | "lit" | "selected";
