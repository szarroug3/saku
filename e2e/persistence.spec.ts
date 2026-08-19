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
  type Page,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import type { FactId, HistoryFile } from "@/types";

/**
 * DOES THE WORK SURVIVE THE TAB?
 *
 * This is the one thing a unit test cannot show. The reported bug was a tester
 * answering eighteen questions correctly across two rounds and finding Progress
 * empty, Practice at zero, and nothing saved — because nothing was written until
 * a session was COMPLETED, and they had not completed one.
 *
 * The suite runs SIGNED OUT, so "saved" means written to this browser's
 * localStorage (`saku-local-history`, the 401→local fallback), not to a server.
 * So the assertions here read that key straight out of the page while the session
 * is still running — the only thing that can distinguish "saved" from "still only
 * in React state, gone the moment the tab closes".
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
};

// This browser's signed-out history, read straight out of localStorage — the
// same `saku-local-history` key the app writes finished rounds into and the
// HistoryProvider reads back (store/local-progress.ts). Async because it crosses
// into the page; every caller is already in an async test.
async function history(page: Page): Promise<HistoryFile> {
  const raw = await page.evaluate(() =>
    window.localStorage.getItem("saku-local-history"),
  );
  return raw
    ? (JSON.parse(raw) as HistoryFile)
    : { sessions: [], facts: {}, claims: {}, seen: {} };
}

/** Total showings recorded across the whole history, for the five seeded facts. */
async function totalSeen(page: Page): Promise<number> {
  const h = await history(page);
  return VOWEL_FACTS.reduce((n, f) => n + (h.facts[f as FactId]?.seen ?? 0), 0);
}

/** Answer every card of a full-coverage round, ending on the last one without
 * waiting for a next card that is never drawn. Same shape as session-loop's. */
async function playRound(page: Page, size: number) {
  await drillReady(page);
  await expect(progressPill(page)).toHaveText(`0 / ${size}`);
  for (let i = 1; i < size; i++) {
    await answerTypedCorrectly(page, VOWEL_FACTS, i);
  }
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const last = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const box = answerBox(page);
  await box.fill(factInfo(last as FactId)!.answers[0]);
  await box.press("Enter");
  await page.waitForURL("**/session");
}

async function teachThenQuiz(page: Page) {
  // Day one opens on the hiragana track intro, so the walk is the five vowels
  // plus that one card: VOWELS Next clicks step past the card and the first four
  // vowels. See src/data/track-intros.ts.
  for (let i = 0; i < VOWELS.length; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
}

test("a completed round is on disk before the session ends", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });

  await page.goto("/learn");
  // The starting state the bug report quoted: an empty history.
  expect((await history(page)).sessions).toEqual([]);
  // From empty history the kana track's card-0 teaser (SAK-28) shows first, in
  // place of the ordinary lesson card; its "Start track" button leads straight
  // into the same session "Start" always did.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);
  await playRound(page, VOWELS.length);

  // STILL NOTHING, and that is correct: the round is not finished until you say
  // it is, and the fork is where you say it. The commit point is `closeRound`.
  expect((await history(page)).sessions).toEqual([]);

  await page
    .getByRole("button", { name: "Complete round", exact: true })
    .click();

  // THE FIX. One round, five facts, written while the session is still open —
  // the learner has pressed nothing that finishes anything.
  await expect.poll(async () => (await history(page)).sessions.length).toBe(1);
  expect(await totalSeen(page)).toBe(VOWELS.length);

  // …and it is still there after the page goes away and comes back, which is
  // what "reloading or closing the page will not lose your progress" claims.
  await page.reload();
  expect(await totalSeen(page)).toBe(VOWELS.length);
  await expect(page.locator("body")).toContainText(/Until round 2|Ready when/);
});

test("a round committed mid-session is not counted again at the end", async ({
  page,
  seed,
}) => {
  // The trap. Every round is written as it closes AND the session used to write
  // its totals at the end; doing both would double every count in the file.
  await seed({ seen: [], cfg: CFG });

  await page.goto("/learn");
  // From empty history the kana track's card-0 teaser (SAK-28) shows first, in
  // place of the ordinary lesson card; its "Start track" button leads straight
  // into the same session "Start" always did.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);

  for (const round of [1, 2]) {
    await playRound(page, VOWELS.length);
    await expect(page.locator("body")).toContainText(
      `round ${round} of 3 · done`,
    );
    await page
      .getByRole("button", { name: "Complete round", exact: true })
      .click();
    await expect
      .poll(async () => (await history(page)).sessions.length)
      .toBe(round);
    if (round === 1) {
      await page
        .getByRole("button", { name: /^Start (now →|round \d)$/ })
        .click();
      await page.waitForURL("**/quiz");
    }
  }

  // Stop for good from the rest, then finish. Neither may add a third record:
  // the rest means round 2 is already banked (endSession does not close a round
  // twice), and finishSession writes nothing at all now.
  //
  // "End session" (SAK-55): the rest screen used to grow its own
  // "Complete session now" button, worded differently from the HUD's
  // "End session" purely so the two duplicate-function buttons wouldn't read
  // as the same thing. That's gone — Pause and End session each live once,
  // on the SessionHud strip, everywhere in the session flow. This click ends
  // the session (calls endSession); see the "Pause from the ... phase" tests
  // below for the other path (pauseSession).
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await expect(page.locator("body")).toContainText("Session complete");
  await page
    .getByRole("button", { name: "Complete session", exact: true })
    .click();
  // Complete session lands on /learn (finishSession → router.push("/learn"), the
  // next lesson), signed in or out. It used to bounce to "/" — a guard clobbered
  // the /learn push — which this line used to encode; that's the bug now fixed.
  await page.waitForURL("**/learn");

  // Two rounds of five, once each. Fifteen would mean the session was written
  // on top of its own rounds; five would mean a round went missing.
  await expect.poll(async () => await totalSeen(page)).toBe(2 * VOWELS.length);
  expect((await history(page)).sessions.length).toBe(2);
});

/**
 * "PAUSE" ALWAYS RETURNS TO LEARN, NOT HOME.
 *
 * pauseSession used to hardcode router.push("/") — the signed-out marketing
 * page — even though the session it just left is fully persisted and
 * resumable. The fix routes it to "/learn" instead. "Pause" (labelled "Done
 * for now" before SAK-55 collapsed the break screen's five differently
 * worded exits down to two) is wired to pauseSession from all three HUD
 * spots (teaching, round-complete, resting); each phase gets its own test,
 * freshly seeded, so a session left paused by one does not turn the next
 * lesson's "Start" button into "Continue session" underneath it.
 */

test("Pause from the teaching phase returns to Learn", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });
  await page.goto("/learn");
  // From empty history the kana track's card-0 teaser (SAK-28) shows first, in
  // place of the ordinary lesson card; its "Start track" button leads straight
  // into the same session "Start" always did.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.waitForURL("**/session");
  // Landed straight on the teach walk (phase "teaching"); its HUD carries its
  // own "Pause" beside "Quiz me", before the round has even started.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForURL("**/learn");
});

test("Pause from the round-complete phase returns to Learn", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });
  await page.goto("/learn");
  // From empty history the kana track's card-0 teaser (SAK-28) shows first, in
  // place of the ordinary lesson card; its "Start track" button leads straight
  // into the same session "Start" always did.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);
  await playRound(page, VOWELS.length);
  // The fork shown right after a round finishes, before "Complete round" is
  // pressed.
  await expect(page.locator("body")).toContainText("round 1 of 3 · done");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForURL("**/learn");
});

test("Pause from the resting phase returns to Learn", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: CFG });
  await page.goto("/learn");
  // From empty history the kana track's card-0 teaser (SAK-28) shows first, in
  // place of the ordinary lesson card; its "Start track" button leads straight
  // into the same session "Start" always did.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);
  await playRound(page, VOWELS.length);
  // Completing round 1 of 3 starts the rest before round 2, rather than
  // ending the session outright.
  await page
    .getByRole("button", { name: "Complete round", exact: true })
    .click();
  await expect(page.locator("body")).toContainText(/resting before round 2/);
  // The resting phase renders exactly one "Pause" now (SAK-55): the sticky
  // HUD's. RestScreen used to grow its own second, identical "Done for now"
  // button here — the literal duplicate the ticket called out — which is
  // why this test used to need .first().
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForURL("**/learn");
});
