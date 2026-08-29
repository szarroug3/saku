import {
  test,
  expect,
  STEADY_CFG,
  answerBox,
  answeredPill,
  answeredTextRe,
  progressPill,
  progressText,
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
  await expect(answeredPill(page)).toHaveText(answeredTextRe(1));
});

/**
 * SAK-223: REPLAYING THE AUDIO MUST NOT DEAD-END THE CARD.
 *
 * The centre speaker is a <button>, so pressing it took keyboard focus off the
 * answer box — and the drill only submits on Enter while the box itself holds
 * focus (drill-screen's onKeyDown). One replay therefore made a typed listening
 * card unanswerable: every keystroke went to the speaker, Enter re-fired the
 * speaker rather than submitting, nothing shook or said no, and Skip (which
 * re-queues the card with no credit) was the only way out.
 *
 * Typed here through the KEYBOARD, deliberately — `fill()`/`press()` focus the
 * box themselves and so would pass even with the bug in place, which is exactly
 * why the existing spec above never caught it.
 */
test("answering still works after replaying the audio", async ({ page }) => {
  await seedQuiz(page, {
    seen: [wordReadingFactId(word)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["romaji"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  await listenSpeaker(page).click();

  // The replay hands focus straight back, so the next keystroke lands in the box.
  const box = answerBox(page);
  await expect(box).toBeFocused();
  await page.keyboard.type("denwa");
  await expect(box).toHaveValue("でんわ");
  await page.keyboard.press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredTextRe(1));
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
 * SAK-289: "SHOW TEXT" MUST NOT DEAD-END THE CARD EITHER.
 *
 * Flagged as a follow-up to SAK-223 (same pattern: a plain <button> sibling
 * to the answer input) and the worst case of the three, since the button
 * UNMOUNTS ITSELF on press — it only renders while `!q.textRevealed`
 * (drill-screen.tsx), so the very click that focuses it also flips the flag
 * that removes it from the DOM on the next render. A browser drops focus to
 * <body> when the focused element is removed, the same dead end as SAK-223's
 * disabled-button case: every following keystroke on a typed listening card
 * would go nowhere, and Enter would not submit (onKeyDown's Enter path only
 * fires while the box itself is focused).
 *
 * Typed here through the KEYBOARD, deliberately, for the same reason SAK-223's
 * regression test was: fill()/press() focus the box themselves and would pass
 * even with the bug in place.
 *
 * An audio → MEANING card is the vehicle (not audio → reading): "Show text" is
 * withheld entirely on a pronunciation question (SAK-153, the reading itself
 * would be the answer), so a reading card never renders this button at all.
 */
test("answering still works after pressing Show text on a listening card", async ({
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
  await page.getByRole("button", { name: "Show text" }).click();

  // The word is now shown as text, and the replay hands focus straight back
  // to the box, so the next keystroke lands there rather than nowhere.
  await expect(page.getByText(word, { exact: true })).toBeVisible();
  const box = answerBox(page);
  await expect(box).toBeFocused();
  await page.keyboard.type("telephone");
  await expect(box).toHaveValue("telephone");
  await page.keyboard.press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredTextRe(1));
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
    await expect(progressPill(page)).toHaveText(progressText(1, 2));
  }
  await expect(listenSpeaker(page)).toBeVisible();
});
