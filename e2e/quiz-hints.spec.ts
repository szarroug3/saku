import { test, expect, STEADY_CFG, direction, style } from "./helpers/app";
import {
  seedQuiz,
  ask,
  subjectOnly,
  hintButton,
  startQuizDrill,
} from "./helpers/quiz";
import { readingFactId } from "@/data/kanji";
import { wordMeaningFactId } from "@/data/vocab";

/**
 * HINTS — opt-in, and never the answer.
 *
 * engine/hint.ts unit-tests what each hint IS; these prove the drill offers the
 * button, renders the hint when taken, and — the load-bearing claim — that the
 * hint on screen does not contain the answer the card is grading. A hint that
 * leaked the answer would be the worst possible regression here, so every case
 * asserts the answer's ABSENCE as well as the nudge's presence.
 *
 * The hint lives in one slot directly above the answer control (drill-screen.tsx),
 * holding the button before it is taken and the hint itself afterward.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

/** The hint slot — button before, hint after. */
function hintSlot(page: Parameters<typeof hintButton>[0]) {
  return page.locator("span.min-h-7").first();
}

test("a kanji-in-word reading card gets the FORMULA hint, not the asked reading", async ({
  page,
}) => {
  // 病 in 病院 → the nudge is [病] + [院 / いん] = 病院: the OTHER piece's reading
  // filled in, the asked piece blank. The answer (病 = びょう) is never shown.
  await seedQuiz(page, {
    seen: [readingFactId("病", "病院")],
    known: ["word:病院/meaning"],
    cfg: { ...JP2EN_TYPED, ...subjectOnly("kanji") },
  });
  await startQuizDrill(page);

  await hintButton(page).click();
  const slot = hintSlot(page);
  // The other piece and its reading are shown, and the word they assemble into.
  await expect(slot).toContainText("院");
  await expect(slot).toContainText("いん");
  await expect(slot).toContainText("病院");
  // The asked reading is NOT in the hint — this is the whole point of the formula.
  await expect(slot).not.toContainText("びょう");
});

test("a multi-kanji word MEANING card hints its components, not the gloss", async ({
  page,
}) => {
  // 電話 asked for its meaning → "電 is electricity, 話 is tale": a structural
  // nudge you still assemble into "telephone", which is never printed.
  await seedQuiz(page, {
    seen: [wordMeaningFactId("電話")],
    cfg: JP2EN_TYPED,
  });
  await startQuizDrill(page);

  await hintButton(page).click();
  const slot = hintSlot(page);
  await expect(slot).toContainText("電 is electricity, 話 is tale");
  // The English gloss the card is grading is never in the hint.
  await expect(slot).not.toContainText("telephone");
});

test("the '?' key takes the hint just like the button", async ({ page }) => {
  // The one binding that works with the answer box focused — a typed card is
  // exactly where the box IS focused, so a key-only affordance had to work there.
  await seedQuiz(page, { seen: [wordMeaningFactId("電話")], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  await expect(hintButton(page)).toBeVisible();
  await page.keyboard.press("?");
  const slot = hintSlot(page);
  await expect(slot).toContainText("電 is electricity, 話 is tale");
  // The button is gone once the hint is taken — nothing to press twice.
  await expect(hintButton(page)).toHaveCount(0);
});

test("multiple choice offers NO hint", async ({ page }) => {
  // A hint against six printed options usually IS the answer, so an mc showing
  // gets no button and the "?" key is inert. Five number-kanji meanings, asked
  // as a board.
  const pool = ["一", "二", "三", "四", "五"].map((k) => `kanji:${k}/meaning`);
  await seedQuiz(page, {
    seen: pool,
    cfg: { ...STEADY_CFG, ...ask({ jpAnswers: ["mc"] }) },
  });
  await startQuizDrill(page);
  // The board is up (options rendered), and there is no Hint button on it.
  await expect(page.locator("button.min-w-\\[74px\\]").first()).toBeVisible();
  await expect(hintButton(page)).toHaveCount(0);
});
