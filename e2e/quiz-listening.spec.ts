import {
  test,
  expect,
  STEADY_CFG,
  answerBox,
  answeredPill,
  answeredText,
  progressPill,
  type Page,
} from "./helpers/app";
import {
  seedQuiz,
  ask,
  instruction,
  hintButton,
  listenSpeaker,
  startQuizDrill,
} from "./helpers/quiz";
import { wordReadingFactId, wordMeaningFactId } from "@/data/vocab";

/**
 * LISTENING CARDS and FULL COVERAGE (tasks #25, #30).
 *
 * An audio prompt hides the glyph and plays the word; the learner answers the
 * romaji reading or the meaning on the same jp→en path as the visual card. The
 * centre of the halo becomes a speaker (DrillHalo, aria-label "Play the word
 * again") instead of the character, because the character would be the answer.
 *
 * These enable Audio through the source-based "How to ask" config (ask-forms.ts):
 * a Japanese source with an Audio prompt produces listening cards for a
 * listenable word. 電話 (でんわ, "telephone") is the vehicle throughout.
 */

const word = "電話";

test("an audio → romaji card plays the word, hides the glyph, and grades the reading", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordReadingFactId(word)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["romaji"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  // The prompt is the speaker, not the written word.
  await expect(listenSpeaker(page)).toBeVisible();
  await expect(page.getByText(word, { exact: true })).toHaveCount(0);
  await expect(instruction(page)).toHaveText("Type how this word is said.");

  // It grades the reading: でんわ, typed as romaji, is accepted.
  const box = answerBox(page);
  await box.fill("denwa");
  await box.press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredText(1));
});

test("an audio → meaning card asks for the meaning and hints the written word, not the gloss", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(word)],
    cfg: {
      ...STEADY_CFG,
      ...ask({
        jpPrompts: ["audio"],
        jpResponses: ["definition"],
        jpAnswers: ["typed"],
      }),
    },
  });
  await startQuizDrill(page);

  await expect(listenSpeaker(page)).toBeVisible();
  await expect(instruction(page)).toHaveText("Type what this word means.");

  // The hint on a listening MEANING card reveals WHICH word was heard (電話) plus
  // its per-kanji meanings — never the English gloss the card is grading.
  await hintButton(page).click();
  // The hint renders in the column below the answer control (drill-screen.tsx) —
  // the flex-col holding the Skip/Hint buttons and then the taken hint. A
  // listening MEANING card's hint is the WRITTEN FORM (電話) plus its per-kanji
  // meanings, so the column shows both and never the English gloss.
  const slot = page.locator("span.flex-col.items-center.gap-3").first();
  await expect(slot).toContainText(word);
  await expect(slot).toContainText("電 is electricity, 話 is tale");
  await expect(slot).not.toContainText("telephone");
});

/**
 * FULL COVERAGE asks EVERY enabled form (#30): with a Japanese source that has
 * both Text and Audio prompts on, a listening card is GUARANTEED to appear —
 * never left to a coin. The coverage deck expands 電話's reading into a text card
 * AND an audio card, so walking the (tiny, limited) run must meet the speaker.
 */
async function answerReadingCard(page: Page) {
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill("denwa");
  await box.press("Enter");
}

test("full coverage guarantees the audio card when Audio is enabled", async ({
  page,
}) => {
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

  // The run is a text card and an audio card, in some order. If the speaker does
  // not lead, the visual reading card does — answer it, and the second (and last)
  // coverage slot MUST be the audio card. Either way the speaker is guaranteed.
  if (!(await listenSpeaker(page).isVisible())) {
    await answerReadingCard(page);
    await expect(progressPill(page)).toHaveText("1 / 2");
  }
  await expect(listenSpeaker(page)).toBeVisible();
});
