// "How Saku works" — the reference page. Not the product, not a tutorial you're
// walked through: a place to look something up after the fact, the same way
// /resources is a reading list and not a lesson. See src/app/how-it-works/page.tsx.
//
// SECTION ORDER IS A REQUIREMENT, NOT A STYLE CHOICE. The owner's review (Linear
// SAK-27): "in the reference page, let's put them in this order: srs then i
// already know button then progress word definitions." Pause-vs-end session
// comes after those three; the rounds and breaks are told inside the SRS
// section since SAK-456, because they are SRS. how-it-works.test.ts pins this
// order — do not reshuffle it without her sign-off.
//
// NO EM DASHES ANYWHERE IN THIS FILE. The owner's explicit instruction, checked
// by the test suite (a stray "—" fails the build's own review, not just style).
//
// EVERY FACTUAL CLAIM HERE IS CHECKED AGAINST CODE, not aspirational copy:
//   - the "slipping" claim (SRS section) is standingOf() in
//     src/lib/library/standing.ts: a fact with showings behind it that the
//     model has lost. It is a STANDING and nothing else. A thing the learner
//     has met stays met, the Observatory's sections offer only what is not
//     met (src/app/(sky)/observatory.ts), so a slipped item is never put back
//     on the list of things to learn; Practice's standing cut is where it is
//     drilled. Held by "a met item that has slipped" in
//     src/app/(sky)/observatory.test.ts (SAK-442).
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
    id: "scripts",
    title: "The three scripts",
    paragraphs: [
      "Japanese is written with three scripts at once. Hiragana is the everyday one: grammar, word endings, and any word with no kanji. Katakana represents the same sounds and is used for words borrowed from other languages, names, and emphasis, the way English uses italics. Kanji are the characters borrowed from Chinese; each has a meaning and one or more readings, and most words are written with them. Romaji is Japanese spelled in the Latin alphabet. It is not a script Japanese uses.",
    ],
    paragraphAccents: [["Hiragana", "Katakana", "Kanji", "Romaji"]],
  },
  {
    id: "srs",
    title: "Why things come back (SRS)",
    paragraphs: [
      "Saku doesn't ask you something once and file it away. This is spaced repetition (SRS): once you've learned something, it keeps coming back, with the gaps getting longer as you get it right.",
      "It starts inside the lesson. A lesson's quiz runs in three rounds, and each round goes through the whole set of cards. A card you got right last time comes back too. Between rounds, Saku schedules a break: 5 minutes before round 2, 10 minutes before round 3 by default. The length is adjustable on the break screen itself, and Saku remembers what you set. A quiz of what's due runs once. So does a practice deck.",
      "During a break, Saku shows you no cards and no answers, because a rest with the material still in front of you isn't a rest. You learn it by coming back and trying to recall it. You can leave the page; the clock keeps counting.",
      "After the lesson the gaps grow to days and then weeks. There is no fixed schedule behind it. Saku tracks how confident it currently is that you'd still get it right, and re-asks the things it's least sure about. What it is confident about, it leaves alone.",
      "And if something's clearly slipped, Saku doesn't send you back through its lesson. It shows up as Slipping, in your sky, in the Atlas and in Practice, so you can drill it when you choose. A missed card still opens its page under the quiz, so the explanation is right there.",
    ],
    paragraphAccents: [
      ["spaced repetition (SRS)"],
      ["three rounds", "5 minutes before round 2", "10 minutes before round 3", "adjustable on the break screen itself"],
      [],
      [],
      ["Slipping"],
    ],
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
        body: "Select one thing or several in the Atlas and say so. It's recorded as a claim, and anything that was waiting on it unlocks right away: a later lesson that needed a kanji or word you claimed, for example. No test record is made up for it, so it stays untested until you're asked. A claim fades over roughly three months, at which point Saku checks in on it for real.",
      },
      {
        label: "I don't know these",
        body: "This takes a claim back, so the thing is offered to be learned again.",
      },
      {
        label: "Quiz me",
        body: "Skips the teaching and takes you straight to being asked about what you selected.",
      },
    ],
    afterBullets: [
      "Either way, a claim only lasts until you answer something. If you claim an item and then miss it later, the miss overrides the claim.",
    ],
  },
  {
    id: "progress-words",
    title: "What the standings mean",
    paragraphs: [
      "Every star in your sky has a standing, and it is the star's color: on the sky, in the Atlas, in Practice. Here's what each one means:",
    ],
    bullets: [
      { label: "Undiscovered", body: "You haven't opened this in a lesson yet, and haven't claimed it. It isn't in your sky." },
      {
        label: "Untested",
        body: "It's in your sky, but Saku has nothing to go on yet. Either you opened it in a lesson, which means Saku starts asking you about it from that moment, or you said you already know it with \"I know these\". It stays untested: there are no quiz results for it yet, so Saku can't call it solid. From your first answer on, its standing comes from your answers alone.",
      },
      {
        label: "Solid",
        body: "You've been tested recently, and it's gone well: at least 8 of your last 10 real attempts were right. A claim on its own never makes something solid.",
        bodyAccents: ["8 of your last 10"],
      },
      {
        label: "Getting there",
        body: "At least 6 of your last 10 attempts were right. You are on the way.",
      },
      { label: "Shaky", body: "Fewer than 6 of your last 10 attempts were right." },
      {
        label: "Slipping",
        body: "You had this at some point, and Saku has real history on it, but it's been long enough (or gone badly enough recently) that Saku no longer expects you'd get it right today. It is not the same as shaky, which means you are struggling with it right now. Slipping is something you once had that's fading because you haven't used it. It stays learned either way: it is never put back on the list of things to learn, and you drill it in Practice when you choose.",
      },
      {
        label: "Mix-ups",
        body: "This one is separate from all of the above. It marks two things you keep confusing with each other, regardless of how well you know either one on its own. Something can be solid and still show up as a mix-up if you consistently swap it for its look-alike partner. A mix-up clears itself once you've kept the two apart for enough runs in a row; how many is yours to set in Settings.",
      },
    ],
    afterBullets: [
      "A word's standing is the worse of its meaning and its reading: it isn't solid until both of them are. A word with a verified pitch is also asked its pitch, by ear, and that has a standing of its own that never holds the word back.",
    ],
  },
  {
    id: "pause-end",
    title: "Leaving a quiz",
    paragraphs: [
      "Walk away and Saku keeps your place. One Continue button, on the Planetarium and the Observatory, offers whichever you left last: your lesson, or a quiz at the card you were on with the answers you already gave still counted. Anything else you left waits on the Sessions page, under Unfinished, with the same way back and a way to let it go.",
      "A lesson is one sitting: the steps, round 1, a break, round 2, a break, round 3. From the moment you open it until its last round is over, Continue takes you back to wherever you were in it, and says where that is: \"step 3 of 9\", \"round 1, card 4 of 18\", \"break before round 2 of 3, 3 min left\". Opening the drill does not end the lesson; finishing the last round does.",
      "Saku keeps one quiz and one lesson. Starting a second quiz while one is unfinished asks you first. Starting a lesson never asks, because it is always the lesson you picked, and its drill always deals its own cards.",
      "A lesson you come back to opens on the step you left, with the same steps in the same order.",
    ],
    paragraphAccents: [
      ["Continue"],
      ["one sitting", "wherever you were in it"],
      ["one quiz and one lesson"],
      ["the step you left"],
    ],
    bullets: [
      {
        label: "End the quiz",
        body: "Finishes the round early. Whatever you've answered is recorded and shown on the results; the cards you didn't reach are left out and are not marked wrong. End the last round and the sitting is over, so Continue stops offering it.",
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
    title: "Practice counts",
    paragraphs: [
      "Practice is for drilling whatever you like: a collection or a part of one, a standing, a size, a saved recipe. It uses the same cards the quiz does, and it counts the same way. What you get right and wrong there moves your standings and your schedule exactly as a quiz would. The run shows up under Sessions, and what you keep missing comes back first the next time you practice it.",
    ],
  },
];
