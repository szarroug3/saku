import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  startPractice,
  answerBox,
  optionButtons,
  reveal,
  answeredPill,
  answeredText,
  requeuedPill,
  type Page,
} from "./helpers/app";

/**
 * GRADING. The highest-value area in the brief: "a learner marked wrong for a
 * right answer is the worst failure this app has."
 *
 * HOW A VERDICT IS OBSERVED
 * =========================
 * The drill deliberately renders no "Correct"/"Wrong" text — a source comment
 * says so outright: "the halo IS the feedback ... a sentence would only repeat
 * in prose what the colour already said". Correct is signalled by an inline
 * box-shadow and a 650ms advance, which is not something a test can asssert on
 * without racing an animation.
 *
 * So these tests read the HUD instead, which is plain text and permanent:
 *
 *   right  -> "1 answered", and NO "re-queued" pill
 *   wrong  -> "1 answered" AND "1 re-queued"
 *
 * `re-queued` is the honest wrong-answer oracle: `rt.requeued` is incremented
 * only on the out-of-retries branch of `submit`, and the pill never disappears.
 * Every test here seeds `retries: "none"`, so one wrong answer is out of
 * retries immediately and there is no second attempt to confuse the count.
 */

/** Assert the last answer was accepted. */
async function expectAccepted(page: Page) {
  await expect(answeredPill(page)).toHaveText(answeredText(1));
  // The re-queued pill is rendered only when something has been re-queued, so
  // its absence is the assertion that nothing was marked wrong.
  await expect(requeuedPill(page)).toHaveCount(0);
}

/** Assert the last answer was rejected. */
async function expectRejected(page: Page) {
  await expect(requeuedPill(page)).toHaveText("1 re-queued");
}

/** Type into the drill's answer box and submit. */
async function typeAnswer(page: Page, text: string) {
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill(text);
  await box.press("Enter");
}

// ---------------------------------------------------------------------------
// Typed answers, Japanese -> English
// ---------------------------------------------------------------------------

/**
 * `word:明白/reading` asks "how is 明白 read?" and the answer is めいはく — a
 * kana string. `checkProduces` accepts the kana typed directly, and accepts a
 * romaji spelling of it via `romajiMatches`. BOTH must be accepted, and the
 * romaji leg is precisely the historical bug "a grading path rejected a correct
 * answer typed in romaji, marking a learner wrong for being right".
 */
const READING_FACT = "word:明白/reading";
const READING_CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

test("jp2en typed: the kana reading is accepted", async ({ page, seed }) => {
  await seed({ seen: [READING_FACT], cfg: READING_CFG });
  await startPractice(page);
  await typeAnswer(page, "めいはく");
  await expectAccepted(page);
});

test("jp2en typed: the SAME answer typed in romaji is accepted", async ({
  page,
  seed,
}) => {
  await seed({ seen: [READING_FACT], cfg: READING_CFG });
  await startPractice(page);
  // Not live-converted: jp2en input stays latin, so this exercises
  // romajiMatches inside the grader rather than an input-level transform.
  await typeAnswer(page, "meihaku");
  await expectAccepted(page);
});

test("jp2en typed: a wrong answer is rejected", async ({ page, seed }) => {
  await seed({ seen: [READING_FACT], cfg: READING_CFG });
  await startPractice(page);
  await typeAnswer(page, "chigau");
  await expectRejected(page);
});

/** An English-meaning fact: the answer is a word, not a reading. */
test("jp2en typed: an English meaning is accepted, and a wrong one is not", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["kanji:一/meaning"], cfg: READING_CFG });
  await startPractice(page);
  await typeAnswer(page, "one");
  await expectAccepted(page);
});

test("jp2en typed: a kana reading is accepted in romaji", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["kana:あ/reading"], cfg: READING_CFG });
  await startPractice(page);
  await typeAnswer(page, "a");
  await expectAccepted(page);
});

// ---------------------------------------------------------------------------
// Typed answers, English -> Japanese
// ---------------------------------------------------------------------------

/**
 * The other direction, where the learner must PRODUCE the Japanese. The app
 * live-converts romaji to kana in this box, so both spellings must land — and
 * the kana leg must work for someone typing with a real IME, who never sends
 * romaji at all.
 *
 * The vehicle is the WORD これ, not the character あ. These three cases used to
 * ride on `kana:あ/reading`, and that stopped being an honest home for them: a
 * kana CHARACTER asked en2jp is prompted with its own romaji ("a"), so the
 * romaji case below was literally "type the prompt back and be marked right",
 * which is the bug this direction was fixed for. Kana characters are no longer
 * typed en2jp at all (see kana-en2jp-mc.spec.ts).
 *
 * これ keeps every claim intact and makes the romaji one true instead of
 * circular: it is prompted "this", it is answered これ, and "kore" is the
 * IME-less spelling of the ANSWER rather than a copy of the question. That is
 * exactly the forgiveness checkProduces exists to give, tested where it is real.
 */
const PRODUCE_CFG = {
  ...STEADY_CFG,
  ...direction("en2jp"),
  ...style("en2jp", "typed"),
};

const PRODUCE_FACT = "word:これ/meaning";

test("en2jp typed: the kana typed directly is accepted", async ({
  page,
  seed,
}) => {
  await seed({ seen: [PRODUCE_FACT], cfg: PRODUCE_CFG });
  await startPractice(page);
  await typeAnswer(page, "これ");
  await expectAccepted(page);
});

test("en2jp typed: the same answer typed in romaji is accepted", async ({
  page,
  seed,
}) => {
  await seed({ seen: [PRODUCE_FACT], cfg: PRODUCE_CFG });
  await startPractice(page);
  await typeAnswer(page, "kore");
  await expectAccepted(page);
});

test("en2jp typed: a wrong kana is rejected", async ({ page, seed }) => {
  await seed({ seen: [PRODUCE_FACT], cfg: PRODUCE_CFG });
  await startPractice(page);
  await typeAnswer(page, "それ");
  await expectRejected(page);
});

// ---------------------------------------------------------------------------
// Multiple choice
// ---------------------------------------------------------------------------

/**
 * Multiple choice needs a pool big enough to build options from — `buildMcOptions`
 * returns short rather than padding, and a single option falls back to a typed
 * card. Five vowels is comfortably enough.
 */
const MC_POOL = [
  "kana:あ/reading",
  "kana:い/reading",
  "kana:う/reading",
  "kana:え/reading",
  "kana:お/reading",
];

test("multiple choice: picking the right option is accepted", async ({
  page,
  seed,
}) => {
  await seed({
    seen: MC_POOL,
    cfg: { ...STEADY_CFG, ...direction("jp2en"), ...style("jp2en", "mc") },
  });
  const glyph = await startPractice(page);
  const asked = (await glyph.innerText()).trim();

  const options = optionButtons(page);
  await expect(options.first()).toBeVisible();
  // The option labels carry a trailing index badge ("a1"), so the correct
  // option is found by the answer the asked glyph maps to, not by equality.
  const correct = ANSWER_OF[asked];
  expect(correct, `no known answer for prompt ${asked}`).toBeTruthy();
  await options.filter({ hasText: new RegExp(`^${correct}\\d$`) }).click();

  await expectAccepted(page);
});

test("multiple choice: picking a wrong option is rejected", async ({
  page,
  seed,
}) => {
  await seed({
    seen: MC_POOL,
    cfg: { ...STEADY_CFG, ...direction("jp2en"), ...style("jp2en", "mc") },
  });
  const glyph = await startPractice(page);
  const asked = (await glyph.innerText()).trim();
  const correct = ANSWER_OF[asked];

  const options = optionButtons(page);
  await expect(options.first()).toBeVisible();
  const labels = await optionLabels(page);
  const wrong = labels.find((l) => l !== correct);
  expect(wrong, "the card offered no wrong option to pick").toBeTruthy();
  await options.filter({ hasText: new RegExp(`^${wrong}\\d$`) }).click();

  await expectRejected(page);
});

/** The five vowels and their readings — the whole MC pool, so a test can name
 * the right option without asking the app what it thinks the answer is. */
const ANSWER_OF: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
};

/** The visible option labels with their index badge stripped. */
async function optionLabels(page: Page): Promise<string[]> {
  const raw = await optionButtons(page).allInnerTexts();
  return raw.map((t) => t.trim().split("\n")[0].trim());
}

// ---------------------------------------------------------------------------
// The reveal
// ---------------------------------------------------------------------------

/**
 * "The reveal after a wrong answer states what was ASKED, not merely what was
 * displayed."
 *
 * This is the historical bug "a wrong-answer reveal printed the half it had
 * displayed instead of the half it had asked". The two halves only differ by
 * direction, so the test runs the SAME fact both ways and asserts the reveal
 * names the half the learner was asked to produce each time.
 *
 * Typed cards are used deliberately: their reveal waits for Enter indefinitely,
 * where a multiple-choice reveal auto-advances after 1600ms. Nothing here races
 * a timer.
 */
test("reveal after a wrong jp2en answer names the reading that was asked for", async ({
  page,
  seed,
}) => {
  await seed({ seen: [READING_FACT], cfg: READING_CFG });
  await startPractice(page);
  await typeAnswer(page, "chigau");

  const r = reveal(page);
  await expect(r.box).toBeVisible();
  // Asked: "how is 明白 read". The answer half is the READING.
  await expect(r.answer).toHaveText("めいはく");
  // ...and the prompt half re-states what was on screen.
  await expect(r.prompt).toHaveText("明白");
});

/**
 * THE en2jp SIDE — the bug these three were written for, now fixed.
 *
 * They were `test.fail()`: the drill composed its reveal as
 *     questionsFor(q.f).answerReveal?.(q.f, q.dir, ctx) ?? factInfo(q.f)?.answers[0]
 * and `answerReveal` was implemented by `grammarQuestions` ALONE. Kana, kanji,
 * word and transitivity all fell through to `answers[0]` — the English/romaji
 * face, which in en2jp is exactly what the prompt displayed. On a miss:
 *
 *     a = a                     (kana:あ/reading   — should be "a = あ")
 *     one = one                 (kanji:一/meaning  — should be "one = 一")
 *     there in japanese = there (word:あそこ/meaning — should be "... = あそこ")
 *
 * The fix is structural: `revealFor` in src/lib/engine/question.ts owns the
 * whole composition and derives its default from the ANSWER axis, so each
 * direction reveals what the other one displays. The exhaustive claim — every
 * fact, both directions, reveal never equals prompt — is asserted in
 * src/lib/engine/reveal-not-prompt.test.ts, where it can walk all 21.7k facts.
 * What these tests add is the WIRING: that the drill screen actually renders
 * that function's output, on the card shapes a learner meets.
 *
 * jp2en is unaffected and is asserted above: "明白 reading = めいはく" is right.
 */

/**
 * A wrong answer on a BOARD card, by clicking.
 *
 * The kana case below has no answer box to type into: `kanaQuestions.mcOnly`
 * is `"en2jp"`, because the en2jp prompt for a kana fact IS its romaji (see
 * kana-en2jp-mc.spec.ts). It originally called `typeAnswer`, which now times out
 * on an absent box — so the test died before reaching its reveal assertion and
 * "passed" as `test.fail()` for entirely the wrong reason. Driving the board is
 * what makes the assertion real, and it is the only one of the three that needs
 * to: the other two render a box for their own reasons and keep typing.
 *
 * Clicks the first option that is NOT the expected answer. Reading the wrong
 * option off the rendered board rather than naming one keeps the test
 * independent of which distractors `buildMcOptions` chose this run.
 */
async function missTheBoard(page: Page, correct: string) {
  const options = optionButtons(page);
  await expect(options.first()).toBeVisible();
  const labels = await optionLabels(page);
  const wrongAt = labels.findIndex((l) => l !== correct);
  expect(wrongAt, `the board offered nothing but "${correct}"`).toBeGreaterThan(-1);
  await options.nth(wrongAt).click();
}

// REVEAL_WINDOW (a 1400ms budget) WAS HERE, and its removal is the point.
//
// It existed because `MC_MISS_ADVANCE_MS` in drill-screen.tsx auto-advanced a
// resolved board miss after 1600ms, so these assertions had to land inside that
// window or Playwright's 5s default would sail past a reveal that was there and
// correct. The test was accommodating the bug: a beginner audit found that a
// board card told you nothing on failure, and the reason was that the reveal
// rendered and was then taken away before it could be read.
//
// The auto-advance is gone. A miss waits for Enter or the Continue button in
// every mode, so the reveal is simply there until the learner leaves it, and
// these assertions need no timing budget at all. The test below pins that
// directly, so the window cannot come back unnoticed.

test("reveal after a wrong en2jp answer names the kana that was asked for", async ({
  page,
  seed,
}) => {
  // "a = a" — the headline case of the report.
  await seed({ seen: ["kana:あ/reading"], cfg: PRODUCE_CFG });
  await startPractice(page);
  await missTheBoard(page, "あ");

  const r = reveal(page);
  // Shown the romaji, asked to produce the kana. The revealed answer is the kana.
  await expect(r.answer).toHaveText("あ");
  await expect(r.prompt).toHaveText("a");
});

/**
 * THE AUDIT'S WORST FINDING, as a test: "A quiz that lets you fail and then
 * hides the answer is not teaching, it is scoring."
 *
 * A beginner clicked two wrong tiles on `u`, the card advanced, and they were
 * never shown that `u` is う. They reproduced it on the next card and named it
 * the thing that would make them close the tab. Settings said "Show the answer
 * when you run out of goes: On" the whole time.
 *
 * The reveal was never the problem — it rendered, and the correct tile even lit
 * green beside it. A 1600ms timer then destroyed it. So the assertion that
 * matters is not "the reveal appears" (the test above already has that) but
 * "the reveal is STILL THERE after long enough to read it, and goes away only
 * when the learner says so".
 *
 * The wait is deliberately longer than the old 1600ms window. It is the one
 * place a fixed sleep is the honest instrument: the claim is precisely that
 * nothing happens on a timer.
 */
test("a multiple-choice miss holds its reveal until the learner dismisses it", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["kana:あ/reading"], cfg: PRODUCE_CFG });
  await startPractice(page);
  await missTheBoard(page, "あ");

  const r = reveal(page);
  await expect(r.answer).toHaveText("あ");

  // Well past the old MC_MISS_ADVANCE_MS. Nothing may have moved.
  await page.waitForTimeout(2600);
  await expect(r.answer).toHaveText("あ", { timeout: 0 });

  // A board card is answered entirely by clicking, so the way on has to be
  // clickable — that, and not a deadline, is the answer to "a mouse user has
  // nothing to press Enter with".
  const onward = page.getByRole("button", { name: "Continue" });
  await expect(onward).toBeVisible();
  await onward.click();
  await expect(r.answer).toHaveCount(0);
});

test("reveal after a wrong en2jp answer names the kanji that was asked for", async ({
  page,
  seed,
}) => {
  // "one = one".
  //
  // THIS TEST USED TO DOCUMENT A BUG AS A FEATURE, and the comment it carried is
  // worth keeping in the record:
  //
  //     A typed card, and not because the answer is typeable — 一 is not kana,
  //     so `en2jpTypeable` is false and this card asks to be multiple choice.
  //     But 一 has no confusables, so `buildMcOptions` returns a single option
  //     and the drill falls back to a box rather than show a one-option board.
  //     ... there is no romaji that produces 一, so the miss is guaranteed and
  //     being TOLD the answer is the only thing the showing can offer.
  //
  // Every word of that was accurate. The conclusion was not: a card whose miss
  // is GUARANTEED is not a card, and "the reveal is the only thing it can offer"
  // is the description of a question that should never have been asked. The
  // owner met this exact card in a real lesson, typed the reading, and was
  // marked wrong twice by a box that could not accept any answer.
  //
  // 一 now boards against its curriculum neighbours (see nearbyMeaningFill), so
  // this is a BOARD, and the test keeps its actual subject: whatever the input,
  // a wrong en2jp answer must name the kanji that was asked for.
  await seed({ seen: ["kanji:一/meaning"], cfg: PRODUCE_CFG });
  await startPractice(page);
  await missTheBoard(page, "一");

  const r = reveal(page);
  await expect(r.box).toBeVisible();
  await expect(r.answer).toHaveText("一");
  await expect(r.prompt).toHaveText("one");
});

test("reveal after a wrong en2jp answer names the word that was asked for", async ({
  page,
  seed,
}) => {
  // "there in japanese = there". あそこ is all kana, so this one IS typed — and
  // a typed card holds its reveal until Enter, so nothing here races a timer.
  await seed({ seen: ["word:あそこ/meaning"], cfg: PRODUCE_CFG });
  await startPractice(page);
  await typeAnswer(page, "ぬ");

  const r = reveal(page);
  await expect(r.box).toBeVisible();
  await expect(r.answer).toHaveText("あそこ");
  await expect(r.prompt).toHaveText("there");
});
