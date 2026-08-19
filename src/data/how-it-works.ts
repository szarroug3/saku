// "How Saku works" — the reference page. Not the product, not a tutorial you're
// walked through: a place to look something up after the fact, the same way
// /resources is a reading list and not a lesson. See src/app/how-it-works/page.tsx.
//
// SECTION ORDER IS A REQUIREMENT, NOT A STYLE CHOICE. The owner's review (Linear
// SAK-27): "in the reference page, let's put them in this order: srs then i
// already know button then progress word definitions." Rounds/breaks and
// pause-vs-end session come after those three. how-it-works.test.ts pins this
// order — do not reshuffle it without her sign-off.
//
// NO EM DASHES ANYWHERE IN THIS FILE. The owner's explicit instruction, checked
// by the test suite (a stray "—" fails the build's own review, not just style).
//
// EVERY FACTUAL CLAIM HERE IS CHECKED AGAINST CODE, not aspirational copy:
//   - the "slipping" claim (SRS section) is standingOf() in
//     src/lib/library/standing.ts, crossed with the `teach` bucket
//     planSession() in src/lib/budget.ts routes lapsed items into — shown with
//     their answer, then drilled, never quizzed cold. See standing.ts's own
//     header comment for the model this narrates.
//   - the progress words are STANDING_LABEL / SOLID_PCT / GETTING_THERE_PCT in
//     the same file: solid is >= 80% of the last 10 real attempts, getting there
//     is >= 60%, claimed is untested by construction (a claim writes no counts).
//   - the break minutes (5 / 10) are the DEFAULTS of cfg.restFirstMin /
//     cfg.restThenMin (src/lib/quiz-config.tsx), and they are genuinely
//     adjustable: src/components/settings/settings-card.tsx renders "Breaks
//     between rounds" with a NumIn bound to each field. If that control is ever
//     removed, this page's "adjustable in Settings" claim has to go with it.
//   - three rounds is SESSION_ROUND_TARGET in src/lib/session.ts; the "Complete
//     session" label on the final round and "Complete round" before it are
//     round-complete.tsx's own button text, not paraphrased.
//   - "Done for now" / "End session" are session-hud.tsx's own default labels.

/** One definition inside a section's bulleted list ("Solid", "Done for now",
 * …). `label` is the word as it appears on screen; `body` is what it means. */
export interface HowItWorksBullet {
  readonly label: string;
  readonly body: string;
}

export interface HowItWorksSection {
  readonly id: string;
  readonly title: string;
  /** Paragraphs rendered before any bullets. Can be empty (a section that is
   * entirely a bulleted list, like "Pause vs. end session"). */
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly HowItWorksBullet[];
  /** Paragraphs rendered after the bullets, when a section needs a closing
   * sentence the list itself can't carry (the "already know" section's note
   * about a later miss overriding a claim). */
  readonly afterBullets?: readonly string[];
}

export const HOW_IT_WORKS_SECTIONS: readonly HowItWorksSection[] = [
  {
    id: "srs",
    title: "Why things come back (SRS)",
    paragraphs: [
      "Saku doesn't ask you something once and file it away. This is spaced repetition (SRS): once you've learned something, it keeps coming back, but not on a fixed schedule.",
      "Saku tracks how confident it currently is that you'd still get it right, and re-asks the things it's least sure about. When it's confident, it stays quiet and leaves you alone. When it's genuinely unsure, it asks again.",
      "And if something's clearly slipped, Saku doesn't keep grinding on it as a \"hard\" item: it treats it as new again and re-teaches it, because testing you on something you don't know isn't teaching.",
    ],
  },
  {
    id: "already-know",
    title: "The \"I already know\" buttons",
    paragraphs: [
      "When Saku offers material you're confident you already know, you get two ways to skip ahead of it.",
    ],
    bullets: [
      {
        label: "I already know this (or these)",
        body: "Skips both the lesson and the quiz. It's recorded as a claim, immediately unblocks anything waiting on it (a later lesson gated on a kanji or word you just claimed, for example), and doesn't fabricate a test record: it stays blank on accuracy until you're actually tested. The claim fades over roughly three months, at which point Saku checks in on it for real.",
      },
      {
        label: "Quiz me",
        body: "The middle option. Skips only the teaching walk-through and drops you straight into being tested.",
      },
    ],
    afterBullets: [
      "Either way, a claim only holds until you actually answer something. If you claim an item and then miss it later, the miss overrides the claim.",
    ],
  },
  {
    id: "progress-words",
    title: "What the progress words mean",
    paragraphs: [
      "Every fact you've met gets one of these words, on its standing chip in the Library and on the Progress page. Here's exactly what each one is claiming:",
    ],
    bullets: [
      { label: "Not seen", body: "Saku hasn't asked you about this yet." },
      {
        label: "Claimed",
        body: "You said you already know it, using an \"I already know\" button. It's untested: no quiz results are behind it yet, so Saku can't call it solid. A claim fades: after about three months untested, Saku starts checking it again.",
      },
      {
        label: "Solid",
        body: "You've actually been tested, recently, and it's gone well: at least 8 of your last 10 real attempts landed. Saying \"solid\" always requires real test results; a claim alone can never make something solid.",
      },
      {
        label: "Getting there",
        body: "At least 6 of your last 10 attempts landed. On the way, not there yet.",
      },
      { label: "Shaky", body: "Fewer than 6 of your last 10 attempts landed." },
      {
        label: "Slipping",
        body: "You had this at some point, and Saku has real history on it, but it's been long enough (or gone badly enough recently) that Saku no longer expects you'd get it right today. Different from shaky: shaky is struggling right now, slipping is something you once had that's fading from disuse.",
      },
      {
        label: "Mix-ups",
        body: "A separate thing from all of the above. This flags two items you keep confusing with each other, regardless of how well you know either one on its own. Something can be solid and still show up as a mix-up if you consistently swap it for its look-alike partner.",
      },
    ],
  },
  {
    id: "rounds-breaks",
    title: "Rounds and breaks",
    paragraphs: [
      "A full Learn session runs in three rounds. Each round runs through the same whole set of material queued for the session, not just what you got wrong last time, so you may see an item more than once across a session, on purpose.",
      "Between rounds, Saku enforces a short break: 5 minutes before round 2, 10 minutes before round 3 by default, adjustable in Settings. There's no break after round 3; you're offered \"Complete session\" instead.",
      "During a break, Saku deliberately shows you nothing: no items, no answers, no preview, because a rest with the material still in front of you isn't a rest. You can skip a break early, or end the session at any point; whatever round you finished is already saved.",
    ],
  },
  {
    id: "pause-end",
    title: "Pause vs. end session",
    paragraphs: [],
    bullets: [
      {
        label: "Done for now",
        body: "Pauses. Takes you back to Learn and keeps your place; pick it back up later.",
      },
      {
        label: "End session",
        body: "Finishes it. Whatever you've completed is saved, and the session is marked done.",
      },
    ],
  },
];
