import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  drillReady,
  progressPill,
  answerBox,
  answerTypedCorrectly,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * "A lesson can be completed end to end, stepping through to the quiz."
 *
 * The curriculum is a pure function of history: with an empty history the app
 * offers hiragana group 1, the five vowels. So this test seeds NOTHING and
 * walks the real day-one path a new learner takes — Home, teach all five, quiz,
 * results — which is the single longest flow in the app and the one most likely
 * to be broken by a route or provider change without any unit test noticing.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  // STEADY_CFG is endless, which is right for tests that only ever answer a
  // card or two. This one has to REACH the end, so the quiz is bounded by full
  // coverage: every fact in the lesson asked once, then results.
  length: "limited",
  limType: "cov",
};

test("a new learner can take the first lesson through to its quiz", async ({
  page,
  seed,
}) => {
  // Empty history on purpose: the lesson offered is whatever the curriculum
  // computes, and from nothing that is hiragana group 1.
  await seed({ seen: [], cfg: CFG });

  await page.goto("/");
  // The heading is upper-cased by CSS only, so the DOM text is lower case.
  await expect(page.locator("body")).toContainText("Up next");
  await expect(page.locator("body")).toContainText("hiragana");
  await expect(page.locator("body")).toContainText("group 1 of 27");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Step through all five characters. The counter is the contract: the lesson
  // must present exactly as many cards as the group has.
  for (let i = 1; i <= VOWELS.length; i++) {
    await expect(page.getByText(/^\d+ of \d+$/)).toHaveText(`${i} of 5`);
    // Each teach card shows the character it is teaching.
    await expect(page.locator("body")).toContainText(VOWELS[i - 1]);

    if (i < VOWELS.length) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
  }

  // On the last card "Next" is gone and the only way forward is the quiz.
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  await expect(progressPill(page)).toHaveText("0 / 5");

  // Answer the first four correctly, each waiting for the next card.
  for (let i = 1; i < VOWELS.length; i++) {
    await answerTypedCorrectly(page, VOWEL_FACTS, i);
  }

  // The last one is answered without waiting for a "next card" that is never
  // drawn: resolving the final card finishes the quiz and navigates to results.
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const last = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const box = answerBox(page);
  await box.fill(factInfo(last as FactId)!.answers[0]);
  await box.press("Enter");

  // A LESSON quiz does not end at /results — a lesson is a session, and a
  // finished round returns to the session loop for the retry/rest fork. That
  // is the designed destination ("the destination is the loop, not Home" in
  // src/app/quiz/page.tsx), so this is where end-to-end ends.
  await page.waitForURL("**/session");

  // The round is reported, and reported CORRECTLY: five asked, five right on
  // the first try, none missed. This is the end-to-end check that grading,
  // scoring and the session loop agree with each other — a unit test can prove
  // any one of them in isolation and still miss this.
  await expect(page.locator("body")).toContainText("round 1 of 3 · done");
  await expect(page.locator("body")).toContainText("5 questions");
  await expect(page.locator("body")).toContainText("5 right first try");
  await expect(page.locator("body")).toContainText("0 missed");
});

/**
 * The other door out of the same lesson: claiming the group instead of taking
 * it. This is a knowledge-base write, so it is asserted through the app rather
 * than the file — the point is that the claim reaches the curriculum and the
 * next group is offered.
 */
test("claiming the first group advances the curriculum to the next one", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });

  await page.goto("/");
  await expect(page.locator("body")).toContainText("group 1 of 27");

  await page
    .getByRole("button", { name: "I already know these 5", exact: true })
    .click();

  // The curriculum recomputes from history, so the next group is now up.
  await expect(page.locator("body")).toContainText("group 2 of 27");
});
