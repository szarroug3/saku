import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  answeredText,
} from "../helpers/app";
import {
  seedQuiz,
  ask,
  subjectOnly,
  hintButton,
  startQuizDrill,
} from "../helpers/quiz";
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
  // MC board moved to a uniform grid of fixed-height cells (drill-screen.tsx);
  // SAK-207 round 3 replaced the old min-h-[60px] floor with a genuinely fixed
  // h-[6.25rem] tile (mc-option-grid.tsx), so this selector tracks that shape.
  await expect(page.locator("button.h-\\[6\\.25rem\\]").first()).toBeVisible();
  await expect(hintButton(page)).toHaveCount(0);
});

/**
 * SAK-289: PRESSING HINT MUST NOT DEAD-END THE CARD.
 *
 * Flagged as a follow-up to SAK-223 (same pattern: a plain <button> sibling
 * to the answer input, no focus-return handling). Clicking Hint focuses the
 * button; taking the hint then renders it `disabled={q.hinted}`
 * (drill-screen.tsx), and browsers blur a focused element the instant it goes
 * disabled — dropping focus to <body> with nothing to pick it back up. On a
 * TYPED card that leaves every following keystroke going nowhere: Enter no
 * longer submits (onKeyDown's Enter path only fires while the box itself is
 * focused).
 *
 * Typed here through the KEYBOARD, deliberately, for the same reason SAK-223's
 * regression test was: fill()/press() focus the box themselves and would pass
 * even with the bug in place.
 */
test("answering still works after clicking Hint", async ({ page }) => {
  await seedQuiz(page, { seen: [wordMeaningFactId("電話")], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  await hintButton(page).click();

  const input = page.locator("input.kq-material");
  await expect(input).toBeFocused();
  await page.keyboard.type("telephone");
  await expect(input).toHaveValue("telephone");
  await page.keyboard.press("Enter");
  await expect(page.getByText(answeredText(1))).toBeVisible();
});

/**
 * "CHOICES" — investigated alongside Hint and Show text for SAK-289 as the
 * same suspected bug class, but it does NOT reproduce, and this pins down
 * why: pressing Choices converts the card from a typed box into an MC board
 * (`rt.q.mc = board`, drill-screen.tsx), which has no answer box left to lose
 * focus FROM. Grading an MC option (click, or the digit-key shortcut in
 * onKeyDown) never depends on `document.activeElement` — the digit path is a
 * document-level keydown listener gated only on the event target not being an
 * INPUT/TEXTAREA, which <body> is not. So although the click does move focus
 * onto the (now-unmounted) button and it does end up on <body>, same as Hint
 * and Show text, nothing is left needing that focus back — there is no typed
 * answer to submit any more. No code change was needed here; this test is the
 * live confirmation the ticket asked for, typed through a real digit
 * KEYPRESS (not Playwright's click helpers) to exercise the exact path
 * onKeyDown uses.
 */
test("SAK-289: a real digit keypress still grades an option after Choices is pressed", async ({
  page,
}) => {
  await seedQuiz(page, { seen: [wordMeaningFactId("電話")], cfg: JP2EN_TYPED });
  await startQuizDrill(page);

  const choicesBtn = page.getByRole("button", { name: "Choices", exact: true });
  await expect(choicesBtn).toBeVisible();
  await choicesBtn.click();

  // The board is up, replacing the typed box, and focus has indeed dropped to
  // <body> — confirming the same click-steals-focus mechanics as the other
  // two buttons, before showing that it doesn't matter here.
  const board = page.locator("button.h-\\[6\\.25rem\\]");
  await expect(board.first()).toBeVisible();
  await expect(page.locator("input.kq-material")).toHaveCount(0);
  await expect(page.evaluate(() => document.activeElement?.tagName)).resolves.toBe(
    "BODY",
  );

  // "telephone" is 電話's own gloss, always option 1 for this fact/direction
  // (see the other hint tests above). A real keypress, not a click.
  await page.keyboard.press("1");
  await expect(page.getByText(answeredText(1))).toBeVisible();
});
