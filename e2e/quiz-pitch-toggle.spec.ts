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
