import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  drillReady,
  progressPill,
  progressText,
  teachPosition,
  teachPositionText,
  answerBox,
  answerTypedCorrectly,
  isVisibleSoon,
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

  await page.goto("/learn");
  // From wholly empty history the kana track's card-0 teaser (SAK-28) is what
  // shows first, in place of the ordinary lesson card: Sam's approved copy in
  // place of the usual "Hiragana 1–5 of 107" position line and あ…お tiles.
  // Its "Start track" button only dismisses the teaser, revealing the normal
  // lesson card whose own "Start" button leads to the same place "Start"
  // always did.
  await expect(page.locator("body")).toContainText("Kana");
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // THE FIRST SCREEN IS THE "KANA" CONCEPT PAGE, NOT あ.
  //
  // Day one opens on the term page that introduces kana (what the two sound-based
  // scripts are), and the content-model walk interleaves a couple of concept cards
  // among the five vowels, so the group is eight steps in all. The HUD counts the
  // position through the walk. Asserted by what the intro TEACHES.
  await expect(teachPosition(page)).toHaveText(teachPositionText(1, 8));
  await expect(page.locator("body")).toContainText("kana");
  await expect(page.locator("body")).toContainText("sound-based scripts");

  // Walk to each vowel's teach card in turn — concept/term cards may sit between
  // them, so step forward until each vowel's page is on screen rather than assume a
  // fixed position. The hero glyph on a kana card is the character it teaches; this
  // proves every vowel of the group is taught before the quiz.
  for (const v of VOWELS) {
    const hero = page
      .locator("article .font-light.leading-none")
      .filter({ hasText: new RegExp(`^${v}$`) });
    for (let i = 0; i < 12 && !(await isVisibleSoon(hero.first())); i++) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(hero.first(), `the walk never taught ${v}`).toBeVisible();
  }

  // Advance to the last card, where the forward button becomes "Quiz me" and Next
  // is gone (any trailing concept card is stepped through here).
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole("button", { name: "Next", exact: true });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  await expect(progressPill(page)).toHaveText(progressText(0, 5));

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
  //
  // The old literal "N forms · N solid · N needs work" header is gone —
  // round-complete.tsx shares results-card.tsx's ring/headline/counts sentence
  // with every other results screen now (see round-complete-states.spec.ts's
  // comment for the full story). All five first-try is the "Perfect run"
  // headline; Needs work never renders (Board returns null on an empty facts
  // list), and Solid carries all five as unselected cells (Solid starts
  // untouched).
  await expect(page.locator("body")).toContainText("Round 1 of 3 · Done");
  await expect(page.locator("body")).toContainText("Perfect run");
  await expect(page.locator("body")).toContainText("5 shown · 5 correct · 0 incorrect · 0 not answered");
  const solid = page.getByText(/^Solid/);
  await expect(solid).toBeVisible();
  await expect(page.getByText(/^Needs work/)).toHaveCount(0);
  await expect(page.locator("body")).toContainText("Solid · 0 selected");
  const solidCells = solid.locator("xpath=ancestor::div[2]").locator("button[aria-pressed]");
  await expect(solidCells).toHaveCount(VOWELS.length);
});
