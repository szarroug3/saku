import { test, expect, STEADY_CFG } from "./helpers/app";
import { seedQuiz, ask } from "./helpers/quiz";
import { kanaFact } from "@/data/characters";
import { wordReadingFactId, wordMeaningFactId, VOCAB, isKanaWord } from "@/data/vocab";
import { READING_INDEX } from "@/data/kanji";
import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";

/**
 * PRACTICE PAGE START BAR ENFORCEMENT (task 30 + enforcement).
 *
 * Verifies that the Start bar on /practice never falsely says "you're solid"
 * when the chosen settings make no cards for the selected material. When an
 * audio-only ask lands on a fact that has no audio question (a kanji reading, a
 * grammar meaning), the run has zero questions: questionCount is 0, so the bar
 * reports "Nothing is selected" and Start stays disabled. Kana is the exception,
 * because audio dictation IS a real kana question (hear the kana, pick it back),
 * so audio-only with kana is reachable and Start enables.
 *
 * The tests navigate to /practice and read the start bar; they do NOT click
 * Start when it is disabled.
 */

const kanaChar = "あ";
const word = VOCAB.find((w) => !isKanaWord(w))!;
const wordReading = wordReadingFactId(word.keb);
const wordMeaning = wordMeaningFactId(word.keb);
const firstKanjiReading = READING_INDEX.keys().next().value as string;
const grammarFact = patternMeaningFactId(RECIPES[0].id);

// ---------------------------------------------------------------------------
// Audio-only asks: no questions on a non-listenable fact, a real one on kana

test("audio-only with kana is reachable (kana dictation), Start enabled", async ({
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

  // Kana keeps a real audio question (hear the kana, pick it back), so an
  // audio-only ask on kana is NOT a dead end and Start stays available.
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
});

test("audio-only with kanji reading makes no questions, not 'solid'", async ({
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

  // A kanji reading has no audio question, so audio-only makes zero cards. The
  // bar must report the empty run, never falsely claim the material is solid.
  const bar = page.locator(".kq-band").last();
  await expect(bar).toContainText("Nothing is selected");
  await expect(bar).not.toContainText("solid");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
});

test("audio-only with grammar fact makes no questions, not 'solid'", async ({
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

  // A grammar meaning has no audio question either, so audio-only makes zero
  // cards and the bar reports the empty run rather than a false "solid".
  const bar = page.locator(".kq-band").last();
  await expect(bar).toContainText("Nothing is selected");
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
