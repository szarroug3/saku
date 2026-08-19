import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  answeredText,
} from "./helpers/app";
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
 * The hint lives in one column below the answer control (drill-screen.tsx): a
 * flex-col that holds the Skip/Hint button row before the hint is taken and the
 * rendered hint itself afterward. Matching that column keeps the assertions
 * agnostic to which shape the hint takes (formula pieces, a text line, an
 * image), which differ by card.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

/** The hint column — the Skip/Hint button row before it is taken, the rendered
 * hint after. One locator for every hint shape (see the file header). */
function hintSlot(page: Parameters<typeof hintButton>[0]) {
  return page.locator("span.flex-col.items-center.gap-3").first();
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
  // The button stays but goes DISABLED once the hint is taken (drill-screen.tsx
  // renders it with `disabled={q.hinted}`), so there is nothing to press twice —
  // and takeHint's own `q.hinted` guard makes a second "?" inert too.
  await expect(hintButton(page)).toBeDisabled();
});

test("SAK-56: '?' stays inert while typing an answer that itself needs '?'", async ({
  page,
}) => {
  // ね's own meaning gloss set IS a question — "right?" / "isn't it?" /
  // "doesn't it?" / "don't you?" (vocab.json) — and unlike a grammar pattern's
  // meaning (always a selection board — see engine/index.ts's
  // answerContainsQuestionMark doc comment), this is an ordinary TYPED jp→en
  // word-meaning card. Being kana-only, ね also gets NO hint at all
  // (wordHint needs ≥2 kanji to break down — hint.ts), so there is no Hint
  // button here to assert on; the whole bug is that the pre-fix code called
  // `e.preventDefault()` on "?" unconditionally, which swallows the keystroke
  // whether or not a hint exists behind it. Contrast with the test above:
  // 電話's gloss has no "?", so that card still takes the hint on "?" even
  // with the box focused.
  const fact = wordMeaningFactId("ね");
  await seedQuiz(page, { seen: [fact], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  const input = page.locator("input.kq-material");
  await expect(input).toBeFocused();
  await page.keyboard.type("right?");
  // The whole string, "?" included, landed in the box — the key was never
  // swallowed. Pre-fix, `e.preventDefault()` on the "?" keydown would have
  // dropped it, leaving "right" in the box instead.
  await expect(input).toHaveValue("right?");

  // The typed answer still grades correct, "?" and all — the fix didn't turn
  // grading stricter, only the key binding.
  await page.keyboard.press("Enter");
  await expect(page.getByText(answeredText(1))).toBeVisible();
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
  // The board is up (options rendered), and there is no Hint button on it. The
  // MC board moved to a uniform grid of min-h-[60px] cells (drill-screen.tsx),
  // so the old min-w-[74px] row styling is gone.
  await expect(page.locator("button.min-h-\\[60px\\]").first()).toBeVisible();
  await expect(hintButton(page)).toHaveCount(0);
});
