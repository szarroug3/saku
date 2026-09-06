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
//   - "Pause" / "End session" are session-hud.tsx's own default labels
//     (doneLabel / endLabel) — the only two session-exit controls in the app
//     since SAK-55 collapsed the break screen's redundant "Done for now" /
//     "Complete session now" pair into these.

/** One definition inside a section's bulleted list ("Solid", "Pause",
 * …). `label` is the word as it appears on screen; `body` is what it means. */
export interface HowItWorksBullet {
  readonly label: string;
  readonly body: string;
  /** Exact substrings of `body` to render in text-accent — the handful of
   * numbers/terms that are the actual point of this definition (SAK-27
   * review round two: "accent the things that need to stand out"). Optional;
   * most bullets need none, since the bold label already carries the weight.
   * See accentTerms() in src/lib/accent-terms.tsx. */
  readonly bodyAccents?: readonly string[];
}

export interface HowItWorksSection {
  readonly id: string;
  readonly title: string;
  /** Paragraphs rendered before any bullets. Can be empty (a section that is
   * entirely a bulleted list, like "Pause vs. end session"). */
  readonly paragraphs: readonly string[];
  /** Exact substrings to accent inside `paragraphs`, index-aligned (entry i
   * accents paragraphs[i]). Optional per paragraph; omit or leave an entry
   * empty when a paragraph has no real landmark to lift. */
  readonly paragraphAccents?: readonly (readonly string[])[];
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
      "And if something's clearly slipped, Saku doesn't keep grinding on it as a \"hard\" item: a missed card opens its lesson right there under the quiz, and the Observatory offers it to be learned again, because testing you on something you don't know isn't teaching. It re-teaches it.",
    ],
    paragraphAccents: [["spaced repetition (SRS)"], [], []],
  },
  {
    id: "already-know",
    title: "Skipping ahead: \"I know these\"",
    paragraphs: [
      "When you come across material in the Atlas that you're confident you already know, you don't have to sit through it.",
    ],
    bullets: [
      {
        label: "I know these",
        body: "Select one thing or several in the Atlas and say so. It's recorded as a claim, it immediately unblocks anything waiting on it (a later lesson gated on a kanji or word you just claimed, for example), and it doesn't fabricate a test record: it stays untested until you're actually asked. A claim fades over roughly three months, at which point Saku checks in on it for real.",
      },
      {
        label: "I don't know these",
        body: "The reverse. Takes a claim back, so the thing is offered to be learned again.",
      },
      {
        label: "Quiz me",
        body: "Skips the teaching and drops you straight into being asked about what you selected.",
      },
    ],
    afterBullets: [
      "Either way, a claim only holds until you actually answer something. If you claim an item and then miss it later, the miss overrides the claim.",
    ],
  },
  {
    id: "progress-words",
    title: "What the standings mean",
    paragraphs: [
      "Every star in your sky has a standing, and it is the star's color: on the sky, in the Atlas, in Practice. Here's exactly what each one is claiming:",
    ],
    bullets: [
      { label: "Undiscovered", body: "You haven't opened this in a lesson yet, and haven't claimed it. It isn't in your sky." },
      {
        label: "Untested",
        body: "It's in your sky, but Saku has nothing to go on yet. Either you opened it in a lesson, which puts it in rotation from that moment, or you said you already know it with \"I know these\". Untested is untested: no quiz results are behind it, so Saku can't call it solid. From your first answer on, its standing comes from your answers alone.",
      },
      {
        label: "Solid",
        body: "You've actually been tested, recently, and it's gone well: at least 8 of your last 10 real attempts landed. Saying \"solid\" always requires real test results; a claim alone can never make something solid.",
        bodyAccents: ["8 of your last 10"],
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
        body: "A separate thing from all of the above. This flags two things you keep confusing with each other, regardless of how well you know either one on its own. Something can be solid and still show up as a mix-up if you consistently swap it for its look-alike partner. A mix-up clears itself once you've kept the two apart for enough runs in a row; how many is yours to set in Settings.",
      },
    ],
    afterBullets: [
      "A word's standing is the worst of its facts: it isn't solid until both its meaning and its reading are. Words with a verified pitch carry a pitch fact too, asked by ear, which has a standing of its own and never holds the word back.",
    ],
  },
  {
    id: "rounds-breaks",
    title: "Rounds and breaks",
    paragraphs: [
      "A lesson's quiz runs in three rounds. Each round runs through the same whole set of cards, not just what you got wrong last time, so you see everything more than once across the quiz, on purpose. A quiz of what's due, and a practice deck, run once.",
      "Between rounds, Saku schedules a break: 5 minutes before round 2, 10 minutes before round 3 by default. The length is adjustable on the break screen itself, where you'd want to change it, and it's remembered.",
      "During a break, Saku deliberately shows you nothing: no cards, no answers, no preview, because a rest with the material still in front of you isn't a rest. The real learning happens when you come back and try to recall it. You can leave the page and come back; the clock keeps counting.",
    ],
    paragraphAccents: [
      ["three rounds"],
      ["5 minutes before round 2", "10 minutes before round 3", "adjustable on the break screen itself"],
      [],
    ],
  },
  {
    id: "pause-end",
    title: "Leaving a quiz",
    paragraphs: [],
    bullets: [
      {
        label: "End the quiz",
        body: "Finishes it early. Whatever you've answered is recorded and shown on the results; the cards you didn't reach are left out, not marked wrong.",
      },
      {
        label: "Back to the observatory",
        body: "From a break, or from the results. A break you leave keeps counting, and the next round is there when you come back.",
      },
    ],
  },
  {
    id: "help",
    title: "Help on a card",
    paragraphs: [
      "Every card has a help bar. Multiple choice narrows a typed card down to a few choices; Hint shows you the drawing or the note that goes with it (on a listening card, it shows the writing); I don't know gives up and shows the answer. A right answer with no help is Perfect. A right answer after a retry, a hint or multiple choice is With help. Running out of tries, or giving up, is Missed.",
      "How many retries you get is set on the help bar itself, and is remembered.",
    ],
    paragraphAccents: [["Perfect", "With help", "Missed"], []],
  },
  {
    id: "practice",
    title: "Practice is never recorded",
    paragraphs: [
      "Practice is for drilling whatever you like, however you like: a collection or a part of one, a standing, a size, a saved recipe. It uses the same cards the quiz does, and nothing you do there touches your schedule. Miss everything in practice and not one standing moves. Practice keeps its own note of what you miss, only to put those first next time.",
    ],
  },
];
