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
 * Kana has three deliberate shapes. This file keeps the visible kana → Romaji
 * typed path covered; ask-forms-settings covers audio → kana, and the form
 * generator unit test proves visible Romaji → kana is recognition-only.
 */

/** Hiragana with distinct romaji, so a prompt identifies exactly one fact. */
const KANA_POOL = ["あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ"].map(
  (k) => `kana:${k}/reading`,
);

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
