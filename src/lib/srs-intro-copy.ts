// The copy for the first-run SRS intro (src/components/lesson/srs-intro.tsx).
// Pulled into its own module, data-only, so the required content (SAK-27's
// owner review) can be pinned by a plain test without rendering React — same
// split as src/data/how-it-works.ts.
//
// REQUIRED CONTENT, the owner's own words from the Linear review:
//   1. "introduce it as spaced repetition system or SRS."
//   2. "explain that people remember things better when they space them and
//      then try to recall them later" — the real spacing-effect finding the
//      app's design is based on, written as established fact, not a guess.
//   3. "explain that when you don't remember and you try really hard to try to
//      remember, that's when things get really burned into your memory so try
//      your best to not use the hints or just skip." Checked against the real
//      hint/skip mechanics in src/components/quiz/drill-screen.tsx: a hint
//      forfeits "nailed it" (first-try) credit (see takeHint / firstTryCredit),
//      and a skip just meets the card again later without you ever having
//      answered it — so the copy below describes the STRUGGLE being traded
//      away, not a specific scoring number, which stays true either way.
//   4. "then explain the 3 rounds."
//   5. "mention that the settings page lets you adjust the time" — CONFIRMED
//      true: src/components/settings/settings-card.tsx renders "Breaks between
//      rounds" with a NumIn bound to cfg.restFirstMin / cfg.restThenMin. If that
//      control is ever removed, this claim has to go with it.
//
// NO EM DASHES — the owner's explicit instruction, pinned by srs-intro-copy.test.ts.

/** The intro's body, one paragraph per string, rendered in order. */
export const SRS_INTRO_PARAGRAPHS: readonly string[] = [
  "Saku uses spaced repetition (SRS): once you've learned something, it comes back to you at increasing intervals instead of all at once. Spacing out your exposure to something, and then trying to recall it later, is one of the best established findings in memory research: it works better than cramming the same material back to back.",
  "The recall part matters more than it looks. When you don't remember something right away and you genuinely try hard to remember it before giving up, that struggle is what burns it into memory. A hint or an early skip feels efficient in the moment, but it trades that struggle away so try your best to remember it on your own before using them.",
  "A Learn session runs in three rounds through the same material, with a short break in between: by default 5 minutes before round 2 and 10 minutes before round 3. These are adjustable in Settings.",
];

/** A short eyebrow for each entry of SRS_INTRO_PARAGRAPHS, same length and
 * order, so the intro can render as distinct labelled chunks (the owner's
 * "unmute the headers... this is hard to read, a big blob of text" review)
 * instead of unbroken prose. Presentation only: none of this text is asserted
 * by srs-intro-copy.test.ts, only SRS_INTRO_PARAGRAPHS itself is. */
export const SRS_INTRO_HEADINGS: readonly string[] = [
  "Spaced repetition",
  "Recall beats hints",
  "Three rounds, with breaks",
];

/** Terms accented (text-accent) inside each paragraph above, by index — the
 * "accent the things that need to stand out" half of the same review. A few
 * real landmarks per paragraph, not a rewrite: exact substrings only, see
 * accentTerms() in src/lib/accent-terms.tsx. */
export const SRS_INTRO_ACCENTS: readonly (readonly string[])[] = [
  ["spaced repetition (SRS)", "increasing intervals"],
  ["burns it into memory", "hint", "skip"],
  ["three rounds", "5 minutes before round 2", "10 minutes before round 3", "adjustable in Settings"],
];

/** The trailing link line's text, with {link} standing in for where the
 * component splices in the actual <Link>. Kept as one string (not JSX) so the
 * copy itself, and only the link target, is what the test pins. */
export const SRS_INTRO_LINK_TEXT =
  "has the full reference: what \"I already know\" does, what the progress words mean, and more details about the SRS system.";

export const SRS_INTRO_LINK_LABEL = "How Saku works";
export const SRS_INTRO_LINK_HREF = "/how-it-works";
