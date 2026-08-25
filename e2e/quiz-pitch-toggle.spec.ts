import { test, expect, STEADY_CFG, type Page } from "./helpers/app";
import { seedQuiz, ask, startQuizDrill, skipButton } from "./helpers/quiz";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";

/**
 * SAK-138: THE PITCH-QUESTIONS TOGGLE.
 *
 * Mirrors quiz-audio-escape.spec.ts's shape exactly, because the ticket asked
 * for exactly that: "a similar one for pitch questions... this should behave
 * like the audio toggle where if a user turns it off mid-quiz, it removes the
 * prompts from the current quiz." Pitch is additive (SAK-129) — every
 * eligible showing of a word's own jp2en meaning card queues one extra pitch
 * board a few slots later, never replacing the ordinary card — so these tests
 * walk the deck with Skip until that extra board appears, exactly the manual
 * repro this ticket's own verification used.
 *
 * 水 carries verified pitch data (src/data/generated/pitch.json). Both its
 * facts (meaning + reading) are seeded under full coverage (limited/cov,
 * not endless) — the same shape the Library's own "Quiz me" launch uses,
 * which is the actual manually-verified repro this spec is pinning. An
 * endless deck over so few facts never gave the additive splice (SAK-129's
 * queuePitchCard) enough real room ahead of the current position to land
 * anywhere reachable; coverage's larger up-front deck does.
 */

const WORD = "水";

/** SAK-180: a word with NO verified pitch entry (src/data/generated/pitch.json
 * has no key for it) — plain kana, common (beginnerRank 2), no kanji, so
 * there is nothing homophone- or multi-sense-adjacent about it that would
 * complicate the repro. Used by the two SAK-180 regression tests below. */
const WORD_NO_PITCH = "あなた";

function pitchBoard(page: Page) {
  return page.getByRole("button", { name: "Play clip 1" });
}

/** Open the mid-drill gear, turn Pitch questions off, and save. Mirrors
 * quiz-audio-escape.spec.ts's turnAudioOff. */
async function turnPitchOff(page: Page) {
  await page.getByRole("button", { name: "Mid-drill settings" }).click();
  const row = page.getByText("Pitch questions").locator("..");
  const toggle = row.getByRole("button", { name: /^(On|Off)$/ });
  await expect(toggle).toHaveText("On");
  await toggle.click();
  await expect(toggle).toHaveText("Off");
  await page.getByRole("button", { name: "Save" }).click();
}

/** Skip forward until the additive pitch board appears, or give up. Every
 * showing of 水's meaning card is eligible (see file header), so this always
 * terminates well within the bound in practice. */
async function skipToPitchBoard(page: Page, maxSkips: number) {
  for (let i = 0; i < maxSkips; i++) {
    if (await pitchBoard(page).isVisible()) return;
    await skipButton(page).click();
  }
}

test("pitch questions appear for a word with verified pitch data, audio and pitch both on", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD), wordReadingFactId(WORD)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      // "audio" has to be one of the enabled prompt forms, not just typed
      // answers — cfg.audioPrompts is DERIVED from whether the ask config
      // includes an audio prompt anywhere (deriveAudioPrompts, ask-config.ts),
      // not an independent flag, and pitch eligibility gates on audioPrompts.
      ...ask({ jpPrompts: ["text", "audio"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  await skipToPitchBoard(page, 20);
  await expect(pitchBoard(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play clip 2" })).toBeVisible();
});

test("turning Pitch questions off mid-quiz removes it from the rest of the run", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD), wordReadingFactId(WORD)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      // "audio" has to be one of the enabled prompt forms, not just typed
      // answers — cfg.audioPrompts is DERIVED from whether the ask config
      // includes an audio prompt anywhere (deriveAudioPrompts, ask-config.ts),
      // not an independent flag, and pitch eligibility gates on audioPrompts.
      ...ask({ jpPrompts: ["text", "audio"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  await skipToPitchBoard(page, 20);
  await expect(pitchBoard(page)).toBeVisible();

  await turnPitchOff(page);

  // The pitch board on screen is replaced by the word's ordinary card — same
  // "current card reacts immediately" behavior the audio toggle already has.
  await expect(pitchBoard(page)).toHaveCount(0);

  // Walk several more draws: no pitch board is ever queued again.
  for (let i = 0; i < 10; i++) {
    await expect(pitchBoard(page)).toHaveCount(0);
    await skipButton(page).click();
  }
  await expect(pitchBoard(page)).toHaveCount(0);
});

test("pitch questions never appear while Audio prompts is off, even with Pitch questions on", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD), wordReadingFactId(WORD)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      audioPrompts: false,
      pitchQuestions: true,
      ...ask({ jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  for (let i = 0; i < 12; i++) {
    await expect(pitchBoard(page)).toHaveCount(0);
    await skipButton(page).click();
  }
  await expect(pitchBoard(page)).toHaveCount(0);
});

/**
 * SAK-180: THE DUPLICATE-QUEUE BUG.
 *
 * A real 5-word/15-form coverage round came back with 24 cards asked instead
 * of 15 — 9 phantom extras, invisible on the results screen but real draws
 * in the live "N of Y" progress count. Two independent, compounding causes
 * in queuePitchCard's call site and its own dedup guard (drill-screen.tsx):
 *
 *   1. Eligibility (`pitchEligibleGlyph`) never checked whether the word
 *      actually had verified pitch data — only rollPitchQuestion did, at
 *      DRAW time, well after an extra deck slot had already been queued for
 *      it. A queued slot that resolves to no pitch data silently falls back
 *      to an ordinary jp2en typed card: a duplicate of a form already asked.
 *   2. `alreadyQueued` only scanned the deck's PENDING suffix (`i >= rt.pos`).
 *      Once a queued pitch slot had been drawn and passed, a LATER showing
 *      of the same fact's meaning card — including a recycled one, since
 *      Skip requeues the current card to the back of the deck and it is
 *      re-presented (and re-checked for eligibility) exactly like a fresh
 *      draw — no longer saw it as already handled, and queued another one.
 *
 * The two tests below pin each fix independently.
 */

test("a word with no verified pitch data never gets a phantom queued card", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD_NO_PITCH), wordReadingFactId(WORD_NO_PITCH)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      ...ask({ jpPrompts: ["text", "audio"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  // Walk well past the point the WORD-with-pitch test above reliably finds
  // its board (20 skips) — every showing of this word's meaning card is
  // eligible on every OTHER count (audio+pitch on, jp2en, word's own
  // meaning fact), so the only thing that can be stopping a board from
  // appearing is the fix: no verified downstep means never eligible.
  for (let i = 0; i < 30; i++) {
    await expect(pitchBoard(page)).toHaveCount(0);
    await skipButton(page).click();
  }
  await expect(pitchBoard(page)).toHaveCount(0);
});

/**
 * Click the first clip (playing it and recording the pick), then Check, then
 * dismiss whatever the grade leaves behind — a correct pick auto-advances on
 * its own after 650ms, a miss waits on Continue. Either way this fully
 * RESOLVES the showing (unlike Skip, which just requeues it to the deck's
 * tail so the very same slot legitimately comes back around later — not the
 * bug this file is pinning). Once resolved, this queued pitch slot is gone
 * from the deck for good; any FUTURE board can only be a newly queued one.
 */
async function resolvePitchCard(page: Page) {
  await pitchBoard(page).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click({ timeout: 3000 })
    .catch(() => {});
  await expect(pitchBoard(page)).toHaveCount(0);
}

test("a word's meaning card is never queued a second pitch card once one has been queued", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD), wordReadingFactId(WORD)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      // A missed card requeues by default (comes back later in the run,
      // same as Skip) — off here so resolvePitchCard's Check click, whether
      // the 50/50 clip guess lands right or wrong, actually REMOVES the
      // pitch card from the deck for good rather than deferring it. Without
      // this a wrong guess would legitimately bring the SAME already-queued
      // card back around later, which looks identical to the bug this test
      // exists to catch.
      requeue: false,
      ...ask({ jpPrompts: ["text", "audio"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  // Find and fully RESOLVE the one pitch card SAK-129 always queues for an
  // eligible word — same 20-draw budget the WORD test above relies on.
  await skipToPitchBoard(page, 20);
  await expect(pitchBoard(page)).toBeVisible();
  await resolvePitchCard(page);

  // Keep skipping well past that point. 水's own meaning-fact card keeps
  // recycling through the deck (Skip requeues the CURRENT card to the tail),
  // re-presenting itself — and re-running the eligibility/queue check in
  // presentCard — again and again, exactly the repeated "showing" bug 2's
  // uncoordinated listen:false/listen:true call sites raced each other on.
  // With the fix, rt.pitchQueued already marked this fact as handled the
  // first time round, for the rest of THIS round — no matter how many more
  // times the card is shown — so no second board should ever surface.
  for (let i = 0; i < 30; i++) {
    await expect(pitchBoard(page)).toHaveCount(0);
    await skipButton(page).click();
  }
  await expect(pitchBoard(page)).toHaveCount(0);
});
