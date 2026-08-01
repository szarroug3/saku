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
    "Type how this な-adjective is said in the 〜な form.",
  );
  await expect(hintButton(page)).toHaveCount(0);
});

test("an unknown adjective's class is part of the quiz instruction", async ({ page }) => {
  await seedQuiz(page, { seen: [TE_ADJ_NA], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    "Type how this な-adjective is said in the 〜て form.",
  );
  await expect(hintButton(page)).toHaveCount(0);
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

  await expect(instruction(page)).toHaveText(
    "Type how this word is said in the 〜て form.",
  );
  await hintButton(page).click();
  await expect(page.getByText("静か is a な-adjective", { exact: true })).toBeVisible();
});
