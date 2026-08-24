import {
  test,
  expect,
  seenToReachCurriculum,
  lessonCard,
  stepToHeadword,
  headword,
  teachPosition,
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
  await seed({ seen: seenToReachCurriculum("人"), cfg: {} });

  await page.goto("/learn");
  const card = lessonCard(page, "人");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Walk to the 人 card (past the intro card that precedes it) and record the
  // HUD position there.
  await stepToHeadword(page, "人");
  const position = await teachPosition(page).innerText();

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

  // Back on the EXACT card, not item 1: the 人 headword is on screen and the HUD
  // reads the same "N of M" it did before.
  await expect(headword(page, "人")).toBeVisible();
  await expect(teachPosition(page)).toHaveText(position);
});
