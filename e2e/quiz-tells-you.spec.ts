import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  startPractice,
  drillReady,
  answerBox,
  answeredPill,
  answeredText,
  progressPill,
  reveal,
} from "./helpers/app";

/**
 * WHAT THE DRILL SAYS BESIDE THE QUESTION.
 *
 * A beginner answered eighteen cards without ever being told what kind of
 * answer the box wanted, without being told they had confused あ with お, and
 * without knowing whether the quiz was nearly over. Three absences, and all
 * three are things the app already knew and did not say.
 *
 * These are e2e and not unit tests because every one of them is a claim about
 * what is ON SCREEN. The copy itself is unit-tested in
 * src/lib/drill-guidance.test.ts; what cannot be tested there is that the drill
 * actually renders it, at the moment it is supposed to.
 *
 * EVERY FIXTURE HERE LEAVES A CARD UP. `retries: "none"` (from STEADY_CFG) plus
 * `showAnswer: true` means one wrong answer exhausts the goes and the reveal
 * holds until Enter — nothing auto-advances a miss in any mode. A driver that
 * resolved cards immediately would let all of these pass against a drill that
 * renders none of it.
 */

// ---------------------------------------------------------------------------
// 1 · what kind of answer the box wants
// ---------------------------------------------------------------------------

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

/** The standing line under the box. Not the placeholder — that one is gone from
 * the first keystroke, which is the whole reason the line exists. */
function answerNote(page: Parameters<typeof answerBox>[0]) {
  return page.getByText(
    /^(Romaji turns into kana as you type\.|Romaji is the sound written in English letters\.|Answer in English\.)$/,
  );
}

/**
 * あ asked jp2en wants "a" — romaji, in latin letters, and NOT English.
 *
 * This is the card the probe was actually on. It is the one case
 * `answerIsJapanese` alone gets wrong: the answer is latin, so the box does not
 * convert, but calling it English would be a worse lie than the silence it
 * replaced.
 */
test("a kana card says the answer is romaji, and never calls it English", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["kana:あ/reading"], cfg: JP2EN_TYPED });
  await startPractice(page);
  await drillReady(page);

  await expect(answerBox(page)).toHaveAttribute(
    "placeholder",
    "Type romaji, Enter to submit",
  );
  await expect(answerNote(page)).toHaveText(
    "Romaji is the sound written in English letters.",
  );
});

/** The line SURVIVES typing. The placeholder does not, and a beginner who has
 * started typing is exactly the person still wondering what to type. */
test("the line is still there once the box has something in it", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["kana:あ/reading"], cfg: JP2EN_TYPED });
  await startPractice(page);
  await drillReady(page);

  await answerBox(page).fill("x");
  await expect(answerNote(page)).toHaveText(
    "Romaji is the sound written in English letters.",
  );
});

/** A kanji reading converts as you type, and says so. */
test("a card whose box converts says the romaji turns into kana", async ({
  page,
  seed,
}) => {
  await seed({ seen: ["word:明白/reading"], cfg: JP2EN_TYPED });
  await startPractice(page);
  await drillReady(page);

  await expect(answerNote(page)).toHaveText(
    "Romaji turns into kana as you type.",
  );
});

/** A meaning card wants English, and is the only kind that says so. */
test("a meaning card asks for English", async ({ page, seed }) => {
  await seed({ seen: ["kanji:一/meaning"], cfg: JP2EN_TYPED });
  await startPractice(page);
  await drillReady(page);

  await expect(answerBox(page)).toHaveAttribute(
    "placeholder",
    "Type English, Enter to submit",
  );
  await expect(answerNote(page)).toHaveText("Answer in English.");
});

// ---------------------------------------------------------------------------
// 2 · naming the mix-up when the goes run out
// ---------------------------------------------------------------------------

/**
 * THE PROBE'S CASE, EXACTLY. あ answered for お, which is a pair the app has
 * predicted since the character data was written, and about which it said
 * nothing.
 *
 * Both kana are seeded because `confusedWith` resolves a typed answer WITHIN
 * THE DECK — "a" names あ only if あ is a card in this run. Whichever of the
 * two is drawn first, the other's romaji is the wrong answer to give, so the
 * test reads the glyph rather than assuming the order.
 */
test("running out of goes on あ / お names the mix-up", async ({
  page,
  seed,
}) => {
  await seed({
    seen: ["kana:あ/reading", "kana:お/reading"],
    cfg: JP2EN_TYPED,
  });
  await startPractice(page);
  await drillReady(page);

  const shown = (await page.locator(".kq-glyph").first().innerText()).trim();
  const other = shown === "あ" ? "お" : "あ";
  const wrong = shown === "あ" ? "o" : "a";

  const box = answerBox(page);
  await box.fill(wrong);
  await box.press("Enter");

  // The reveal is up and holding — no timer takes it away.
  await expect(reveal(page).answer).toBeVisible();
  await expect(
    page.getByText(`You answered ${other}. Those two get mixed up a lot.`),
  ).toBeVisible();
});

/**
 * SILENCE IS THE DEFAULT, and it has to be tested or the feature degenerates
 * into a line on every miss. Nonsense names no entry in the deck, so there is
 * no mix-up to report and the reveal is the two lines it has always been.
 */
test("a miss that names nothing says nothing about mix-ups", async ({
  page,
  seed,
}) => {
  await seed({
    seen: ["kana:あ/reading", "kana:お/reading"],
    cfg: JP2EN_TYPED,
  });
  await startPractice(page);
  await drillReady(page);

  const box = answerBox(page);
  await box.fill("zzz");
  await box.press("Enter");

  await expect(reveal(page).answer).toBeVisible();
  await expect(page.getByText(/get mixed up a lot/)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 3 · how long the quiz is
// ---------------------------------------------------------------------------

/** An endless quiz says so. The bare count it used to show read like an x-of-y
 * whose y had gone missing. */
test("an endless quiz says it is endless", async ({ page, seed }) => {
  await seed({ seen: ["kana:あ/reading"], cfg: JP2EN_TYPED });
  await startPractice(page);
  await drillReady(page);

  await expect(answeredPill(page)).toHaveText(answeredText(0));
});

/** A limited quiz shows how far off the end is, on the drill itself rather than
 * only in the sidebar. */
test("a limited quiz shows x / y on the drill", async ({ page, seed }) => {
  await seed({
    seen: ["kana:あ/reading", "kana:お/reading"],
    cfg: { ...JP2EN_TYPED, length: "limited", limType: "cov" },
  });
  await startPractice(page);
  await drillReady(page);

  await expect(progressPill(page)).toHaveText("0 / 2");
  // And it is the loud one: the accent colour is what makes it read before the
  // quiet chips beside it.
  await expect(progressPill(page)).toHaveClass(/text-accent/);
});
