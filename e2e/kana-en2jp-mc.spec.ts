import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  startPractice,
  answerBox,
  optionButtons,
  answeredPill,
  answeredText,
} from "./helpers/app";

/**
 * A kana card asked EN→JP is a board, not a box — even when the learner asked
 * for typing.
 *
 * The en2jp prompt for a kana fact is its romaji: あ is asked as "a". A typed
 * box under that prompt accepted "a", so the card graded its own prompt as the
 * answer and tested nothing, for all 214 kana. Picking あ off a board is a real
 * recall test, so kana opts out of typing in this direction
 * (`kanaQuestions.mcOnly === "en2jp"`).
 *
 * The other half of the claim matters just as much: JP→EN is a genuine question
 * (see あ, type "a") and must stay a typed box with romaji accepted. A change
 * that forced BOTH directions to MC would satisfy the first test here and
 * destroy the drill; the second test is what stops it.
 *
 * Asserted through the DOM the learner actually gets, not through the config,
 * because the config is exactly what this overrides.
 */

/** Hiragana with distinct romaji, so a prompt identifies exactly one fact. */
const KANA_POOL = ["あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ"].map(
  (k) => `kana:${k}/reading`,
);

test("kana en→jp renders a board even when the style setting says typed", async ({
  page,
  seed,
}) => {
  await seed({
    // styleEn2jp: "typed" is the setting the fix overrides. Seeding "mc" here
    // would pass without the fix and prove nothing.
    seen: KANA_POOL,
    cfg: { ...STEADY_CFG, ...direction("en2jp"), ...style("en2jp", "typed") },
  });
  await startPractice(page);

  await expect(optionButtons(page).first()).toBeVisible();
  expect(await optionButtons(page).count()).toBeGreaterThan(1);
  await expect(answerBox(page)).toHaveCount(0);
});

test("kana jp→en still renders a typed box and still accepts romaji", async ({
  page,
  seed,
}) => {
  await seed({
    seen: KANA_POOL,
    cfg: { ...STEADY_CFG, ...direction("jp2en"), ...style("jp2en", "typed") },
  });
  const glyph = await startPractice(page);

  const box = answerBox(page);
  await expect(box).toBeVisible();
  await expect(optionButtons(page)).toHaveCount(0);

  // And it grades: the romaji for whatever kana is on screen is correct. Read
  // off the rendered glyph rather than the registry, so the assertion is about
  // the card the learner is looking at.
  const shown = (await glyph.innerText()).trim();
  const romaji: Record<string, string> = {
    あ: "a", い: "i", う: "u", え: "e", お: "o",
    か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  };
  await box.fill(romaji[shown]);
  await box.press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredText(1));
});

test("the kana en→jp board never offers the romaji prompt as an option", async ({
  page,
  seed,
}) => {
  // The board's options are kana glyphs and the prompt is romaji, so the prompt
  // cannot appear among them. Cheap to assert and it is the whole point of the
  // change: mc-integrity.spec covers this generally, this pins it for the card
  // that was broken.
  await seed({
    seen: KANA_POOL,
    cfg: { ...STEADY_CFG, ...direction("en2jp"), ...style("en2jp", "typed") },
  });
  const glyph = await startPractice(page);

  const prompt = (await glyph.innerText()).trim();
  const labels = (await optionButtons(page).allInnerTexts()).map((t) => t.trim());
  expect(labels).not.toContain(prompt);
  expect(new Set(labels).size).toBe(labels.length);
});
