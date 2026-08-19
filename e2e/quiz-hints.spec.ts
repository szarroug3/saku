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

test("the '?' key takes the hint when the answer box isn't focused", async ({
  page,
}) => {
  // "?" is Hint's keyboard shortcut, but — like the digit shortcuts just
  // below it in DrillScreen.onKeyDown — it stands off a focused text input.
  // Blur the box first, the same way a learner would after tabbing away or
  // between questions, and confirm the shortcut still fires.
  await seedQuiz(page, { seen: [wordMeaningFactId("電話")], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  const input = page.locator("input.kq-material");
  await expect(input).toBeFocused();
  await input.blur();

  await expect(hintButton(page)).toBeVisible();
  await page.keyboard.press("?");
  const slot = hintSlot(page);
  await expect(slot).toContainText("電 is electricity, 話 is tale");
  // The button stays but goes DISABLED once the hint is taken (drill-screen.tsx
  // renders it with `disabled={q.hinted}`), so there is nothing to press twice —
  // and takeHint's own `q.hinted` guard makes a second "?" inert too.
  await expect(hintButton(page)).toBeDisabled();
});

test("SAK-56: '?' stays inert while typing in a focused answer box, on any card", async ({
  page,
}) => {
  // Unconditional, not scoped to which card is on screen: "?" stands off ANY
  // focused text input, the same way the digit shortcuts do. 電話 is an
  // ORDINARY card — its gloss "telephone call" has no "?" in it — which is
  // exactly the point: the old code only stood off "?" when the current
  // card's own answer happened to contain one (e.g. ね's "right?"), so it
  // still misfired on every other card. Typing "?" here must land the
  // character AND leave the hint untaken, regardless of what the answer is.
  const fact = wordMeaningFactId("電話");
  await seedQuiz(page, { seen: [fact], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  const input = page.locator("input.kq-material");
  await expect(input).toBeFocused();
  await expect(hintButton(page)).toBeVisible();
  await page.keyboard.type("telephone call?");
  // The whole string, "?" included, landed in the box — the key was never
  // swallowed.
  await expect(input).toHaveValue("telephone call?");
  // No hint was taken by the keystroke: the button is still enabled and the
  // hint slot never rendered.
  await expect(hintButton(page)).toBeEnabled();
  await expect(hintSlot(page)).not.toContainText("電 is electricity");

  // The typed answer still grades correct, "?" and all — the fix didn't turn
  // grading stricter, only the key binding. ("telephone call?" isn't itself
  // the accepted answer, so clear the trailing "?" before submitting.)
  await input.fill("telephone call");
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
