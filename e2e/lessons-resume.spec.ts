import {
  test,
  expect,
  KANA_FACTS,
  lessonCard,
  stepToHeadword,
  headword,
} from "./helpers/lessons";

/**
 * A LESSON RESUMES AT THE EXACT STEP YOU LEFT IT ON.
 *
 * The teach walk's position lives on the session (session.teachStep), persisted
 * to localStorage, so leaving the walk and coming back should land on the same
 * card — not restart at item 1. `lesson-resume.test.ts` proves the CARD keeps
 * pointing at the resting lesson; this proves the WALK itself resumes its exact
 * position, which is a different mechanism (teachStep vs the frontier rebuild)
 * and has no unit coverage of the rendered step.
 *
 * Seeded kana-complete, so the frontier lesson is the first curriculum group
 * (人 · 一 · 亅 · 丁), which is long enough to leave mid-walk.
 */

test("leaving a lesson mid-walk and continuing resumes the same step", async ({
  page,
  seed,
}) => {
  await seed({ seen: KANA_FACTS, cfg: {} });

  await page.goto("/learn");
  const card = lessonCard(page, "人");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Walk a few steps in, to the 亅 card, and record the HUD position there.
  await stepToHeadword(page, "亅");
  const position = await page.getByText(/^\d+ of \d+$/).innerText();

  // Leave the walk for Home. The session is not ended — it rests where it is.
  await page.goto("/learn");
  const resumeCard = lessonCard(page, "人");
  await expect(
    resumeCard.getByRole("button", { name: "Continue session", exact: true }),
  ).toBeVisible();
  await resumeCard
    .getByRole("button", { name: "Continue session", exact: true })
    .click();
  await page.waitForURL("**/session");

  // Back on the EXACT card, not item 1: the 亅 headword is on screen and the HUD
  // reads the same "N of M" it did before.
  await expect(headword(page, "亅")).toBeVisible();
  await expect(page.getByText(/^\d+ of \d+$/)).toHaveText(position);
});
