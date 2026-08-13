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

  await page.goto("/learn");
  // The content-model feed's kana card is the "Kana" track, its position line
  // "Hiragana 1–5 of 107" — the kana track split by script and counted in ITEMS
  // (see home-feed.tsx / lesson-position.ts), not the old "hiragana group 1 of
  // 27". (The de-box redesign dropped the "Up next" eyebrow; the heading is now
  // the track title.)
  await expect(page.locator("body")).toContainText("Kana");
  await expect(page.locator("body")).toContainText("Hiragana 1–5 of 107");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // THE FIRST SCREEN IS THE "KANA" CONCEPT PAGE, NOT あ.
  //
  // Day one opens on the term page that introduces kana (what the two sound-based
  // scripts are), and the content-model walk interleaves a couple of concept cards
  // among the five vowels, so the group is eight steps in all. The HUD counts the
  // position through the walk. Asserted by what the intro TEACHES.
  await expect(page.getByText(/^\d+ of \d+$/)).toHaveText("1 of 8");
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
    for (let i = 0; i < 12 && !(await hero.first().isVisible()); i++) {
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
  await expect(page.locator("body")).toContainText("5 forms");
  await expect(page.locator("body")).toContainText("5 solid");
  // The summary counts DISTINCT FORMS, not showings: five forms, all first-try,
  // so five Solid and none needing work. `needs work` is `total - solid`, so the
  // line adds up by construction.
  await expect(page.locator("body")).toContainText("0 needs work");
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

  await page.goto("/learn");
  await expect(page.locator("body")).toContainText("Hiragana 1–5 of 107");

  await page
    .getByRole("button", { name: "I already know these 5", exact: true })
    .click();

  // The curriculum recomputes from history, so the next group is now up.
  await expect(page.locator("body")).toContainText("Hiragana 6–10 of 107");
});
