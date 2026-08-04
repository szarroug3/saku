import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  progressPill,
  startVowelLessonDrill,
  answerDrillCard,
} from "./helpers/app";

/**
 * ROUND-COMPLETE STATE COVERAGE.
 *
 * e2e/lesson.spec.ts already drives the day-one vowel lesson to the round-
 * complete screen answering EVERYTHING right, so the all-solid header ("5 forms
 * · 5 solid · 0 needs work") is covered. These two tests cover the other two
 * shapes of that screen: a COMBINATION (some solid, some needs work) and an
 * ALL-NEEDS-WORK round.
 *
 * They reuse the same driving helpers (startVowelLessonDrill / answerDrillCard)
 * so the walk to the drill stays in one place.
 *
 * DRIVING A MISS. A form goes into "needs work" when it was not answered right
 * on the FIRST try (word-table-keys.ts / outcomeForPhrase). With retries off, a
 * single wrong answer is out of retries immediately, so the form is scored as a
 * miss and the run moves on the moment Continue is pressed. Turning `requeue`
 * off on top of that means the missed card is NOT re-asked later in the round —
 * so a coverage round is exactly one showing per form, the header counts are
 * deterministic, and there is no retry/requeue race for the test to hit.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);
// Coverage asks each vowel once, so the round has exactly one form per vowel.
const FORMS = VOWELS.length;

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  // Reach the end of the round: bound the quiz by full coverage.
  length: "limited",
  limType: "cov",
  // A missed form must not come back this round. retries:none already resolves a
  // wrong answer on the first try; requeue:false keeps that miss from being
  // re-queued, so the round is one showing per form and the counts are exact.
  requeue: false,
};

test("round complete reports a mix of solid and needs-work forms", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });
  await startVowelLessonDrill(page);
  await expect(progressPill(page)).toHaveText(`0 / ${FORMS}`);

  // Miss the FIRST card, answer the other four correctly. One wrong first try is
  // enough to send that form to needs-work; the rest land solid.
  for (let i = 0; i < FORMS; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {
      wrong: i === 0,
      last: i === FORMS - 1,
      finishUrl: "**/session",
    });
  }

  const body = page.locator("body");

  // The header, in FORMS, is NOT the all-solid line: it must show both a solid
  // count and a needs-work count, each at least one. With five forms and one
  // miss the split is exactly 4 / 1.
  await expect(body).toContainText(`${FORMS} forms`);
  await expect(body).toContainText("4 solid");
  await expect(body).toContainText("1 needs work");

  // BOTH section headings are present — the two piles the header counts.
  await expect(page.getByText("Solid", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs work", { exact: true })).toBeVisible();

  // The missed form shows what the learner TYPED ("said xyz"), never the correct
  // reading — the whole point of a fork that is about to re-ask it.
  await expect(body).toContainText("said xyz");

  // And the retry affordance is there, ticked to the one outstanding miss.
  await expect(page.getByRole("button", { name: /^Retry/ })).toBeVisible();
});

test("round complete reports every form as needs work", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });
  await startVowelLessonDrill(page);
  await expect(progressPill(page)).toHaveText(`0 / ${FORMS}`);

  // Every card wrong on its first (and only) try.
  for (let i = 0; i < FORMS; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {
      wrong: true,
      last: i === FORMS - 1,
      finishUrl: "**/session",
    });
  }

  const body = page.locator("body");

  // No solid forms; every form needs work.
  await expect(body).toContainText(`${FORMS} forms`);
  await expect(body).toContainText("0 solid");
  await expect(body).toContainText(`${FORMS} needs work`);

  // Needs work is present; Solid must NOT be — nothing landed first try, so the
  // section (rendered only when it has cells) is absent entirely.
  await expect(page.getByText("Needs work", { exact: true })).toBeVisible();
  await expect(page.getByText("Solid", { exact: true })).toHaveCount(0);

  // Retry is offered for the misses.
  await expect(page.getByRole("button", { name: /^Retry/ })).toBeVisible();
});
