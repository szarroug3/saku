import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  drillReady,
  progressPill,
  startPractice,
  startVowelLessonDrill,
  answerDrillCard,
} from "./helpers/app";

/**
 * QUIZ-FLOW PERFORMANCE.
 *
 * e2e/page-load-performance.spec.ts measures plain URL loads (navigate →
 * networkidle → assert ms). The quiz RESULTS and round-complete screens can't be
 * reached that way — they need real session/run state — so these guard the same
 * thing as FLOW timings: drive the run, then measure from the resolving action
 * to the destination screen being interactive.
 *
 * THRESHOLDS ARE DELIBERATELY GENEROUS. Like the sibling file, these run against
 * a production build and are sensitive to machine load (the lists-import page-
 * load test already flaked once at 2272ms against a 2000ms limit). Each window
 * here also spans a real user transition — the 650ms correct-answer settle, a
 * client navigation, and in one case a dynamically imported screen chunk — so a
 * tight bound would flake without catching anything. These budgets guard against
 * GROSS regressions (a screen that suddenly takes seconds), not micro-latency,
 * and each logs the actual ms the way the sibling file does.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);
const FORMS = VOWELS.length;

// jp2en typed, one showing per form, no requeue — the same deterministic drill
// the round-state specs drive.
const FLOW_CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
  requeue: false,
};

// Round-complete is dynamically imported, so its first paint pays for a chunk
// fetch on top of the answer settle and the navigation.
const ROUND_COMPLETE_BUDGET_MS = 6000;
// A retry leg rebuilds a deck and routes to /quiz; drillReady waits for the
// provider to hydrate and the first card to paint.
const RETRY_START_BUDGET_MS = 6000;
// The results screen commits the run record (locally, signed out) and renders a
// summary board.
const RESULTS_BUDGET_MS = 6000;

test("round-complete renders quickly after the last answer", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: FLOW_CFG });
  await startVowelLessonDrill(page);

  // Answer all but the last card, OFF the clock — only the final resolving
  // action and the transition it triggers are what we measure.
  for (let i = 0; i < FORMS - 1; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {});
  }

  const started = Date.now();
  await answerDrillCard(page, VOWEL_FACTS, { last: true, finishUrl: "**/session" });
  // Interactive = the round-complete fork is on screen and its primary button
  // can be pressed.
  await expect(
    page.getByRole("button", { name: "Complete round", exact: true }),
  ).toBeVisible();
  const ms = Date.now() - started;

  console.log(
    `round-complete render: ${ms}ms (budget: ${ROUND_COMPLETE_BUDGET_MS}ms)`,
  );
  expect(
    ms,
    `round-complete render took ${ms}ms (budget ${ROUND_COMPLETE_BUDGET_MS}ms)`,
  ).toBeLessThanOrEqual(ROUND_COMPLETE_BUDGET_MS);
});

test("starting the retry drill from round-complete is quick", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: FLOW_CFG });
  await startVowelLessonDrill(page);

  // Miss the first card so the fork has something to retry, then finish the
  // round to reach the round-complete screen.
  for (let i = 0; i < FORMS; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {
      wrong: i === 0,
      last: i === FORMS - 1,
      finishUrl: "**/session",
    });
  }

  const retry = page.getByRole("button", { name: /^Retry/ });
  await expect(retry).toBeVisible();

  // Measure from clicking the button that starts the next quiz to the retry
  // drill being ready (first card painted).
  const started = Date.now();
  await retry.click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  const ms = Date.now() - started;

  console.log(`retry drill start: ${ms}ms (budget: ${RETRY_START_BUDGET_MS}ms)`);
  expect(
    ms,
    `retry drill start took ${ms}ms (budget ${RETRY_START_BUDGET_MS}ms)`,
  ).toBeLessThanOrEqual(RETRY_START_BUDGET_MS);
});

test("the practice results screen renders quickly after a drill", async ({
  page,
  seed,
}) => {
  // A PLAIN practice run (not a lesson): a finished one-off quiz lands on
  // /results, the distinct results board this measures. Seed the vowels as seen
  // so they are the drillable pool.
  await seed({ seen: VOWEL_FACTS, cfg: FLOW_CFG });
  await startPractice(page);
  await expect(progressPill(page)).toHaveText(`0 / ${FORMS}`);

  for (let i = 0; i < FORMS - 1; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {});
  }

  const started = Date.now();
  await answerDrillCard(page, VOWEL_FACTS, { last: true, finishUrl: "**/results" });
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
  const ms = Date.now() - started;

  console.log(`results render: ${ms}ms (budget: ${RESULTS_BUDGET_MS}ms)`);
  expect(
    ms,
    `results render took ${ms}ms (budget ${RESULTS_BUDGET_MS}ms)`,
  ).toBeLessThanOrEqual(RESULTS_BUDGET_MS);
});
