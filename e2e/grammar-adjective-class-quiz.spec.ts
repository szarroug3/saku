import { test, expect, STEADY_CFG } from "./helpers/app";
import {
  ask,
  hintButton,
  instruction,
  seedQuiz,
  startQuizDrill,
} from "./helpers/quiz";

import { patternProductionFactId } from "@/data/grammar";
import { wordMeaningFactId } from "@/data/vocab";

const TE_ADJ_NA = patternProductionFactId("te-sequence", "adj-na");
const NODE_ADJ_I = patternProductionFactId("node", "adj-i");
const PRENOMINAL_ADJ_I = patternProductionFactId("prenominal-form", "adj-i");
const PRENOMINAL_ADJ_NA = patternProductionFactId("prenominal-form", "adj-na");
const GRAMMAR_ONLY = {
  selection: {
    subjects: ["grammar"],
    list: null,
    states: [],
    text: "",
    session: null,
  },
};
const EN2JP_TYPED = {
  ...STEADY_CFG,
  ...ask({ enAnswers: ["typed"] }),
  ...GRAMMAR_ONLY,
};

test("the first grammar form quizzes な before a noun", async ({ page }) => {
  await seedQuiz(page, { seen: [PRENOMINAL_ADJ_NA], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    "Type this な-adjective describing みせ.",
  );
  // SAK-193: the Hint now always names the pattern itself, so a card that
  // used to offer NO hint at all (a FORM recipe, and prenominal-form is one,
  // has no form nudge of its own to give) still gets this one.
  await hintButton(page).click();
  await expect(page.getByText("This is the 〜な pattern", { exact: true })).toBeVisible();
});

test("the first grammar form also quizzes the unchanged い-adjective", async ({ page }) => {
  await seedQuiz(page, { seen: [PRENOMINAL_ADJ_I], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    "Type this い-adjective describing みせ.",
  );
  await expect(page.locator(".kq-glyph").first()).toHaveText("たかい");
  await hintButton(page).click();
  await expect(page.getByText("This is the 〜な pattern", { exact: true })).toBeVisible();
});

test("an unknown adjective's class is part of the quiz instruction", async ({ page }) => {
  await seedQuiz(page, { seen: [TE_ADJ_NA], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  // SAK-193: the instruction now asks in the pattern's own gloss terms, with
  // the vehicle's own (unknown, so kana) word filled into X, and its class
  // named at the end rather than swapped in for "word".
  await expect(instruction(page)).toHaveText(
    'How do you say "げんき, and then / because げんき" for this な-adjective?',
  );
  await hintButton(page).click();
  await expect(page.getByText("This is the 〜て pattern", { exact: true })).toBeVisible();
});

test("an unchanged adjective attachment still gets its own quiz card", async ({ page }) => {
  await seedQuiz(page, { seen: [NODE_ADJ_I], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    'How do you say "because たかい" for this い-adjective?',
  );
  await hintButton(page).click();
  await expect(page.getByText("This is the 〜ので pattern", { exact: true })).toBeVisible();
});

test("a known adjective keeps a plain instruction and offers its class as a hint", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [TE_ADJ_NA],
    claims: [wordMeaningFactId("静か")],
    cfg: EN2JP_TYPED,
  });
  await startQuizDrill(page);

  // Known, so no class tag on the instruction and the surface script (静か,
  // not しずか) fills X.
  await expect(instruction(page)).toHaveText(
    'How do you say "静か, and then / because 静か"?',
  );
  await hintButton(page).click();
  await expect(
    page.getByText("This is the 〜て pattern. 静か is a な-adjective", { exact: true }),
  ).toBeVisible();
});
