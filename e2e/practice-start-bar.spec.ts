import { test, expect, STEADY_CFG } from "./helpers/app";
import { seedQuiz, ask } from "./helpers/quiz";
import { kanaFact } from "@/data/characters";
import { wordReadingFactId, wordMeaningFactId, VOCAB, isKanaWord } from "@/data/vocab";
import { READING_INDEX } from "@/data/kanji";
import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";

/**
 * PRACTICE PAGE — START BAR ENFORCEMENT (task 30 + enforcement).
 *
 * Verifies that the Start bar on /practice shows the correct disabled reason
 * when settings won't produce any cards for the selected material. Before this
 * enforcement, "audio-only with kana" would show "You're solid on all of these"
 * — now it says why.
 *
 * The tests navigate to /practice, check the reason text in the start bar,
 * and do NOT click Start (the button is disabled when the reason is shown).
 */

const kanaChar = "あ";
const word = VOCAB.find((w) => !isKanaWord(w))!;
const wordReading = wordReadingFactId(word.keb);
const wordMeaning = wordMeaningFactId(word.keb);
const firstKanjiReading = READING_INDEX.keys().next().value as string;
const grammarFact = patternMeaningFactId(RECIPES[0].id);

// ---------------------------------------------------------------------------
// Unreachable settings → specific diagnostic message

test("audio-only with kana shows unreachable message, not 'solid'", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [kanaFact(kanaChar)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["romaji"], jpAnswers: ["mc"] }),
    },
  });
  await page.goto("/practice");

  // The start bar should show the unreachable diagnostic — not "solid"
  const bar = page.locator(".kq-band").last();
  await expect(bar).toContainText("Audio");
  await expect(bar).not.toContainText("solid");

  // Start is disabled
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});

test("audio-only with kanji reading shows unreachable message, not 'solid'", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [firstKanjiReading],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["romaji"], jpAnswers: ["mc"] }),
    },
  });
  await page.goto("/practice");

  const bar = page.locator(".kq-band").last();
  await expect(bar).toContainText("Audio");
  await expect(bar).not.toContainText("solid");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});

test("audio-only with grammar fact shows unreachable message, not 'solid'", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [grammarFact],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["definition"], jpAnswers: ["mc"] }),
    },
  });
  await page.goto("/practice");

  const bar = page.locator(".kq-band").last();
  await expect(bar).toContainText("Audio");
  await expect(bar).not.toContainText("solid");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Reachable settings → Start is enabled (no disabled reason)

test("audio with word reading — Start is enabled", async ({ page }) => {
  await seedQuiz(page, {
    seen: [wordReading],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["audio"], jpResponses: ["romaji"], jpAnswers: ["typed"] }),
    },
  });
  await page.goto("/practice");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
});

test("text prompt with kana — Start is enabled", async ({ page }) => {
  await seedQuiz(page, {
    seen: [kanaFact(kanaChar)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["romaji"], jpAnswers: ["mc"] }),
    },
  });
  await page.goto("/practice");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Settings enforcement — filtering effect is visible at count level

test("definition-only config: word reading fact produces no questions", async ({
  page,
}) => {
  // A reading fact with definition-only response settings → 0 questions
  // because a reading fact's jp→en response is "romaji", not "definition"
  await seedQuiz(page, {
    seen: [wordReading],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["definition"], jpAnswers: ["typed"] }),
    },
  });
  await page.goto("/practice");

  // Start is disabled because the reading fact has no definition form
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});

test("romaji-only config: word meaning fact produces no questions", async ({
  page,
}) => {
  // A meaning fact with romaji-only response settings → 0 questions
  // because a meaning fact's jp→en response is "definition", not "romaji"
  await seedQuiz(page, {
    seen: [wordMeaning],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["romaji"], jpAnswers: ["typed"] }),
    },
  });
  await page.goto("/practice");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});
