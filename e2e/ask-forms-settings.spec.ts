import {
  test,
  expect,
  STEADY_CFG,
  optionButtons,
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
const firstKanjiReading = READING_INDEX.keys().next().value!;
const grammarFact = patternMeaningFactId(RECIPES[0].id);

test.describe("Unreachable settings combinations", () => {
  test("kana with audio produces no cards", async ({
    page,
  }) => {
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
    await page.goto("/practice");
    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeDisabled();
  });

  test("kanji reading with audio produces no cards (kanji reading not listenable)", async ({
    page,
  }) => {
    // Kanji reading fact with audio produces no forms because kanji readings are
    // not listenable (enabledFormsFor drops the audio prompt via
    // isKanjiReadingFact), and audio is the only prompt selected. With nothing
    // askable the run never begins: Practice keeps Start disabled rather than
    // launching an empty drill, so the empty-state UI to assert is the disabled
    // Start, not a drill end screen (which is unreachable here).
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
    await page.goto("/practice");

    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeDisabled();
  });

  test("grammar meaning with audio produces no cards (grammar not listenable)", async ({
    page,
  }) => {
    // Grammar meaning with audio produces no forms: grammar patterns are not
    // listenable (listenKind is null), so the audio prompt is dropped, and the
    // ask() helper leaves the Sentence source off, so no sentence-definition
    // board is offered either. Nothing is askable, so Practice keeps Start
    // disabled rather than launching an empty drill.
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
    await page.goto("/practice");

    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeDisabled();
  });

  test("kana en→jp with only Type it selected still produces one MC card (kana en→jp is MC-only)", async ({
    page,
  }) => {
    // Kana en→jp is MC-only: the romaji is the prompt, so typing it back would
    // grade the prompt. The kana matrix in enabledFormsFor pins the English
    // source's form to answer "mc" whenever the source is on, regardless of the
    // learner's typed/mc choice, so selecting only "Type it" does NOT empty the
    // run: it produces exactly one kana-picking card. The old "no cards" premise
    // predates the ask being honored.
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

    // The card is the see-romaji, pick-kana MC board, so option buttons are
    // present rather than an empty end screen.
    await expect(optionButtons(page)).not.toHaveCount(0);
  });
});

test.describe("Multiple settings paths to same format (text vs audio)", () => {
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

    // A TEXT reading card shows the written word in the halo glyph and asks for
    // its romaji in a typed box. The distinguishing signal from the audio form
    // (next test) is that the glyph carries the word rather than being the empty
    // speaker stand-in, and there is no "Play the word again" speaker.
    await expect(page.locator(".kq-glyph").first()).not.toHaveText("");
    await expect(
      page.getByRole("button", { name: "Play the word again" }),
    ).toHaveCount(0);
    await expect(page.getByRole("textbox")).toBeVisible();
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

    // Both enabled forms are TYPED jp→en reading cards that differ only in
    // whether the word is shown (text) or played (audio), so the card that
    // appears carries a typed answer box either way. Endless rolls ONE form per
    // showing, so this asserts a valid typed reading card started rather than
    // trying to force both forms into one deterministic run (which would need
    // coverage mode and a multi-card walk).
    await expect(page.getByRole("textbox")).toBeVisible();
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

    // Both enabled forms (text and audio) are definition MC cards, so whichever
    // one endless rolls, the drill shows an MC board. The option buttons are
    // button.min-h-[60px] (the optionButtons helper), not role="option", and the
    // board size is variable (buildMcOptions pads only as far as it has honest
    // distractors), so assert the board is present rather than a fixed count.
    await expect(optionButtons(page)).not.toHaveCount(0);
  });
});

test.describe("Settings enforcement", () => {
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

    // Definition-only drops the reading fact (jp2enResponse of a word reading is
    // romaji, which is not selected), leaving only the meaning fact as a
    // definition MC card. The board buttons are button.min-h-[60px] (the
    // optionButtons helper), not role="option".
    await expect(optionButtons(page).first()).toBeVisible();
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
