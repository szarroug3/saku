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
  // SAK-194: the Hint now shows the actual derivation instead of naming the
  // pattern — a card that used to offer NO hint at all (a FORM recipe, and
  // prenominal-form is one, has no form nudge of its own to give) still gets
  // this one, built from the recipe's own two steps (dictionary → the form
  // before a noun, then that form → the pattern). The equation spans
  // (DerivationRow, hint-content.tsx) sit flush against each other with no
  // text-node space — only CSS gap between them — so the rendered text runs
  // the pieces together with no space around "becomes" or "→".
  await hintButton(page).click();
  await expect(
    page.getByText("げんきbecomesげんきなみせ", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("な-adjective", { exact: true })).toBeVisible();
  await expect(
    page.getByText("げんき+ な→げんきな", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("げんきな+ みせ→げんきなみせ", { exact: true }),
  ).toBeVisible();
});

test("the first grammar form also quizzes the unchanged い-adjective", async ({ page }) => {
  await seedQuiz(page, { seen: [PRENOMINAL_ADJ_I], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    "Type this い-adjective describing みせ.",
  );
  await expect(page.locator(".kq-glyph").first()).toHaveText("たかい");
  // An い-adjective needs no conjugation before a noun (it already IS its own
  // prenominal form), so there is no step1 here — just the one equation that
  // attaches the noun straight onto the dictionary form.
  await hintButton(page).click();
  await expect(
    page.getByText("たかいbecomesたかいみせ", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("い-adjective", { exact: true })).toBeVisible();
  await expect(
    page.getByText("たかい+ みせ→たかいみせ", { exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByText("げんきbecomesげんきで", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("な-adjective", { exact: true })).toBeVisible();
  await expect(
    page.getByText("げんき+ で→げんきで", { exact: true }),
  ).toBeVisible();
});

test("an unchanged adjective attachment still gets its own quiz card", async ({ page }) => {
  await seedQuiz(page, { seen: [NODE_ADJ_I], cfg: EN2JP_TYPED });
  await startQuizDrill(page);

  await expect(instruction(page)).toHaveText(
    'How do you say "because たかい" for this い-adjective?',
  );
  await hintButton(page).click();
  await expect(
    page.getByText("たかいbecomesたかいので", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("い-adjective", { exact: true })).toBeVisible();
  await expect(
    page.getByText("たかい+ ので→たかいので", { exact: true }),
  ).toBeVisible();
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
  // Known, so the derivation builds on the surface script 静か (not しずか) —
  // the same class reminder the old flat text carried ("静か is a
  // な-adjective") now shows as the derivation's own title instead.
  await hintButton(page).click();
  await expect(
    page.getByText("静かbecomes静かで", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("な-adjective", { exact: true })).toBeVisible();
  await expect(
    page.getByText("静か+ で→静かで", { exact: true }),
  ).toBeVisible();
});
