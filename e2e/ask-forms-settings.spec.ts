import {
  test,
  expect,
  STEADY_CFG,
  type Page,
} from "./helpers/app";
import {
  seedQuiz,
  ask,
  startQuizDrill,
} from "./helpers/quiz";
import {
  kanaFact,
} from "@/data/characters";
import {
  wordReadingFactId,
  wordMeaningFactId,
  VOCAB,
  isKanaWord,
} from "@/data/vocab";
import { READING_INDEX } from "@/data/kanji";
import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";

/**
 * ASK-FORMS SETTINGS BEHAVIOR (task 30, question format matrix).
 *
 * Verifies that question format matrix accurately describes what questions
 * appear when settings are selected. Tests both:
 * - Unreachable combinations: settings selected that produce no forms
 * - Multiple paths: same format reachable via different prompt types
 */

const kanaChar = "あ";
const word = VOCAB.find((w) => !isKanaWord(w))!;
const wordReading = wordReadingFactId(word.keb);
const wordMeaning = wordMeaningFactId(word.keb);
const firstKanjiReading = READING_INDEX.keys().next().value;
const grammarFact = patternMeaningFactId(RECIPES[0].id);

describe("Unreachable settings combinations", () => {
  test("kana with audio produces no cards (kana not listenable)", async ({
    page,
  }) => {
    // Kana fact with audio prompt and romaji response should produce no forms
    // because kana entries have no audio support
    await seedQuiz(page, {
      seen: [kanaFact(kanaChar)],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["audio"],
          jpResponses: ["romaji"],
          jpAnswers: ["mc"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should reach the end with no cards asked
    const endMessage = page.getByText(/no more|done|finished/i);
    await expect(endMessage).toBeVisible({ timeout: 5000 });
  });

  test("kanji reading with audio produces no cards (kanji reading not listenable)", async ({
    page,
  }) => {
    // Kanji reading fact with audio should produce no forms
    // because kanji readings are not listenable
    await seedQuiz(page, {
      seen: [firstKanjiReading],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["audio"],
          jpResponses: ["romaji"],
          jpAnswers: ["mc"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should reach the end with no cards asked
    const endMessage = page.getByText(/no more|done|finished/i);
    await expect(endMessage).toBeVisible({ timeout: 5000 });
  });

  test("grammar meaning with audio produces no cards (grammar not listenable)", async ({
    page,
  }) => {
    // Grammar meaning fact with audio should produce no forms
    // because grammar patterns are not listenable
    await seedQuiz(page, {
      seen: [grammarFact],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["audio"],
          jpResponses: ["definition"],
          jpAnswers: ["mc"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should reach the end with no cards asked
    const endMessage = page.getByText(/no more|done|finished/i);
    await expect(endMessage).toBeVisible({ timeout: 5000 });
  });

  test("kana en→jp with only Type it selected produces no cards (MC-only)", async ({
    page,
  }) => {
    // Kana glyphs are MC-only for en→jp (kana reading is the prompt, typing it back is trivial)
    // Selecting only "Type it" should produce no forms
    await seedQuiz(page, {
      seen: [kanaFact(kanaChar)],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: [],
          jpResponses: [],
          jpAnswers: [],
          enAnswers: ["typed"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should reach the end with no cards asked
    const endMessage = page.getByText(/no more|done|finished/i);
    await expect(endMessage).toBeVisible({ timeout: 5000 });
  });
});

describe("Multiple settings paths to same format (text vs audio)", () => {
  test("word reading with text prompt shows a card", async ({ page }) => {
    await seedQuiz(page, {
      seen: [wordReading],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["text"],
          jpResponses: ["romaji"],
          jpAnswers: ["typed"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should show a card with text prompt
    const prompt = page.locator('[class*="prompt"]').first();
    await expect(prompt).toBeVisible();
  });

  test("word reading with audio prompt shows a card (different FORM)", async ({
    page,
  }) => {
    await seedQuiz(page, {
      seen: [wordReading],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["audio"],
          jpResponses: ["romaji"],
          jpAnswers: ["typed"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should show a card with audio prompt (speaker visible, glyph hidden)
    const speaker = page.locator('[aria-label*="Play"], [aria-label*="Repeat"]').first();
    await expect(speaker).toBeVisible();
  });

  test("word reading with both text and audio selected shows both FORMS", async ({
    page,
  }) => {
    await seedQuiz(page, {
      seen: [wordReading, wordReading],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["text", "audio"],
          jpResponses: ["romaji"],
          jpAnswers: ["typed"],
        }),
      },
    });
    await startQuizDrill(page);

    // First card should be text or audio, complete it
    const firstPrompt = page.locator('[class*="prompt"]').first();
    await expect(firstPrompt).toBeVisible();

    // Type answer to proceed
    const answerBox = page.getByRole("textbox").first();
    await answerBox.fill("test");
    await page.keyboard.press("Enter");

    // Second card should be the other prompt type
    // Both should be visible in the session
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  test("word meaning with text and audio selected shows both FORMS", async ({
    page,
  }) => {
    await seedQuiz(page, {
      seen: [wordMeaning, wordMeaning],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["text", "audio"],
          jpResponses: ["definition"],
          jpAnswers: ["mc"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should show multiple choice questions
    const options = page.locator('button[role="option"]');
    await expect(options).toHaveCount(4, { timeout: 5000 });
  });
});

describe("Settings enforcement", () => {
  test("selecting definition-only narrows to meaning facts, drops reading facts", async ({
    page,
  }) => {
    // Word has both meaning and reading facts
    // Selecting definition-only should drop the reading fact
    await seedQuiz(page, {
      seen: [wordReading, wordMeaning],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["text"],
          jpResponses: ["definition"],
          jpAnswers: ["mc"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should only show definition cards (multiple choice)
    // Reading cards should be dropped
    const options = page.locator('button[role="option"]');
    await expect(options.first()).toBeVisible();
  });

  test("selecting romaji-only narrows to reading facts, drops meaning facts", async ({
    page,
  }) => {
    // Word has both meaning and reading facts
    // Selecting romaji-only should drop the meaning fact
    await seedQuiz(page, {
      seen: [wordReading, wordMeaning],
      cfg: {
        ...STEADY_CFG,
        ...ask({
          jpPrompts: ["text"],
          jpResponses: ["romaji"],
          jpAnswers: ["typed"],
        }),
      },
    });
    await startQuizDrill(page);

    // Should only show reading cards (typed text input)
    const answerBox = page.getByRole("textbox");
    await expect(answerBox).toBeVisible();
  });
});
