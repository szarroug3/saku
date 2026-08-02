import {
  test,
  expect,
  STEADY_CFG,
  answerBox,
  type Page,
} from "./helpers/app";
import { seedQuiz, ask, startQuizDrill, listenSpeaker } from "./helpers/quiz";
import { wordReadingFactId } from "@/data/vocab";

/**
 * THE AUDIO ESCAPE HATCH (task #61, from the from-scratch naive-learner audit).
 *
 * Audio prompts default ON, so a fresh learner meets listening cards (the glyph
 * is hidden and the word is played). A learner who cannot hear — no speakers, a
 * noisy room, a hearing impairment — was trapped: Skip only re-queues the card,
 * and the one off-switch lived in Settings, a screen away, with the mid-drill
 * gear exposing nothing but cosmetic HUD rows.
 *
 * The fix surfaces the SAME live toggle inside the mid-drill gear, AND makes the
 * running drill react to it: the run snapshots its ask at start, so turning audio
 * off has to reach the deck NOW — the card on screen is replaced with a fresh
 * text card for the same fact, and no further listening card is drawn.
 */

const word = "電話";

/** Open the mid-drill gear, turn Audio prompts off, and save. */
async function turnAudioOff(page: Page) {
  await page.getByRole("button", { name: "Mid-drill settings" }).click();
  const row = page.getByText("Audio prompts").locator("..");
  const toggle = row.getByRole("button", { name: /^(On|Off)$/ });
  await expect(toggle).toHaveText("On");
  await toggle.click();
  await expect(toggle).toHaveText("Off");
  await page.getByRole("button", { name: "Save" }).click();
}

test("turning Audio off replaces the listening card on screen with a text card", async ({
  page,
}) => {
  // Full coverage expands 電話's reading into a text card AND an audio card, so a
  // listening card is GUARANTEED (never left to a coin). Walk to it, then toggle.
  await seedQuiz(page, {
    seen: [wordReadingFactId(word)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      ...ask({ jpPrompts: ["text", "audio"], jpResponses: ["romaji"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  // Land on the audio card: answer the visual cards until the speaker leads. The
  // coverage deck is guaranteed to contain a listening card, so this terminates.
  for (let i = 0; i < 4 && !(await listenSpeaker(page).isVisible()); i++) {
    await answerBox(page).fill("denwa");
    await answerBox(page).press("Enter");
    await expect(answerBox(page)).toHaveValue(""); // next card has arrived
  }
  // A listening card: the speaker stands in for the glyph, which is empty.
  await expect(listenSpeaker(page)).toBeVisible();
  await expect(page.locator(".kq-glyph").first()).toHaveText("");

  await turnAudioOff(page);

  // The card is REPLACED: the speaker is gone and the written word now fills the
  // glyph, so the same fact is answerable by eye — no leaving the drill.
  await expect(listenSpeaker(page)).toHaveCount(0);
  await expect(page.locator(".kq-glyph").first()).toContainText(word);
  await expect(answerBox(page)).toBeVisible();
});

test("after turning Audio off, no further listening card is drawn in the run", async ({
  page,
}) => {
  // Full coverage expands the reading into a text card AND an audio card, so the
  // run is guaranteed to contain a listening card. Turn audio off up front, then
  // walk the whole run: the speaker must never appear.
  await seedQuiz(page, {
    seen: [wordReadingFactId(word)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      ...ask({
        jpPrompts: ["text", "audio"],
        jpResponses: ["romaji"],
        jpAnswers: ["typed"],
      }),
    },
  });
  await startQuizDrill(page);

  await turnAudioOff(page);

  // Walk every coverage slot. The speaker never shows — every card is text.
  for (let i = 0; i < 4; i++) {
    if (!(await answerBox(page).isVisible())) break;
    await expect(listenSpeaker(page)).toHaveCount(0);
    await answerBox(page).fill("denwa");
    await answerBox(page).press("Enter");
    // A correct answer auto-advances; a finished run leaves the drill.
    if (!page.url().includes("/quiz")) break;
  }
  await expect(listenSpeaker(page)).toHaveCount(0);
});
