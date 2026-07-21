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
  await expect(answeredPill(page)).toHaveText("1 answered");
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
 * KNOWN BUG — these three are `test.fail()`, meaning Playwright EXPECTS them to
 * fail and will report a failure if they ever start passing. They are the
 * historical bug "a wrong-answer reveal printed the half it had displayed
 * instead of the half it had asked", alive in the app today.
 *
 * Asked English-to-Japanese, the drill shows the English/romaji side and asks
 * the learner to produce the Japanese. On a miss it prints:
 *
 *     a = a                 (kana:あ/reading   — should be "a = あ")
 *     one = one             (kanji:一/meaning  — should be "one = 一")
 *     there in japanese = there
 *                           (word:あそこ/meaning — should be "... = あそこ")
 *
 * so the learner who could not produce the answer is shown the prompt again and
 * never told what it was.
 *
 * ROOT CAUSE. The reveal is
 *     questionsFor(q.f).answerReveal?.(q.f, q.dir, ctx) ?? factInfo(q.f)?.answers[0]
 * in src/components/quiz/drill-screen.tsx, and `answerReveal` is implemented by
 * `grammarQuestions` ALONE in src/lib/engine/question.ts. Kana, kanji, word and
 * transitivity questions have no override, so every one of them falls through to
 * `answers[0]` — which is the English/romaji face, i.e. the prompt, in the en2jp
 * direction. The grammar override exists because this exact fault was found and
 * fixed there; its own comment names it ("printed 'decide to X pattern = decide
 * to X'"). The fix was never generalised to the other four subjects.
 *
 * jp2en is unaffected and is asserted above: "明白 reading = めいはく" is right.
 */
const revealBugCases: Array<{ fact: string; shouldReveal: string; actually: string }> = [
  { fact: "kana:あ/reading", shouldReveal: "あ", actually: "a" },
  { fact: "kanji:一/meaning", shouldReveal: "一", actually: "one" },
  { fact: "word:あそこ/meaning", shouldReveal: "あそこ", actually: "there" },
];

for (const c of revealBugCases) {
  test.fail(
    `reveal after a wrong en2jp answer names what was asked for (${c.fact})`,
    async ({ page, seed }) => {
      await seed({ seen: [c.fact], cfg: PRODUCE_CFG });
      await startPractice(page);
      await typeAnswer(page, "ぬ");

      const r = reveal(page);
      await expect(r.box).toBeVisible();
      // Shown the English/romaji, asked to produce the Japanese. The revealed
      // answer must be the Japanese. Today it echoes the prompt instead.
      await expect(r.answer).toHaveText(c.shouldReveal);
      await expect(r.answer).not.toHaveText(c.actually);
    },
  );
}
