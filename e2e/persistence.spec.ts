import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * empty, Practice at zero, and history.json still 33 bytes — because nothing was
 * written until a session was COMPLETED, and they had not completed one.
 *
 * So the assertions here are made against the file on disk, from Node, while the
 * session is still running. Nothing else can distinguish "saved" from "still in
 * the browser's localStorage, where the old code left it".
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

const HISTORY_PATH = join(process.cwd(), "history.json");

function history(): HistoryFile {
  return JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as HistoryFile;
}

/** Total showings recorded across the whole file, for the five seeded facts. */
function totalSeen(): number {
  const h = history();
  return VOWEL_FACTS.reduce(
    (n, f) => n + (h.facts[f as FactId]?.seen ?? 0),
    0,
  );
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
  for (let i = 1; i < VOWELS.length; i++) {
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
  // The starting state the bug report quoted: an empty file.
  expect(history().sessions).toEqual([]);

  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);
  await playRound(page, VOWELS.length);

  // STILL NOTHING, and that is correct: the round is not finished until you say
  // it is, and the fork is where you say it. The commit point is `closeRound`.
  expect(history().sessions).toEqual([]);

  await page.getByRole("button", { name: "Complete round", exact: true }).click();

  // THE FIX. One round, five facts, written while the session is still open —
  // the learner has pressed nothing that finishes anything.
  await expect.poll(() => history().sessions.length).toBe(1);
  expect(totalSeen()).toBe(VOWELS.length);

  // …and it is still there after the page goes away and comes back, which is
  // what "reloading or closing the page will not lose your progress" claims.
  await page.reload();
  expect(totalSeen()).toBe(VOWELS.length);
  await expect(page.locator("body")).toContainText(/Until round 2|Ready when/);
});

test("a round committed mid-session is not counted again at the end", async ({
  page,
  seed,
}) => {
  // The trap. Every round is written as it closes AND the session used to write
  // its totals at the end; doing both would double every count in the file.
  await seed({ seen: [], cfg: CFG });

  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
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
    await expect.poll(() => history().sessions.length).toBe(round);
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
  // "Complete session now" rather than "Done for now": the session HUD carries
  // its own "Done for now" and the two would be ambiguous. Both land on
  // endSession, so this tests the same path.
  await page
    .getByRole("button", { name: "Complete session now", exact: true })
    .click();
  await expect(page.locator("body")).toContainText("Session complete");
  await page
    .getByRole("button", { name: "Complete session", exact: true })
    .click();
  await page.waitForURL((url) => new URL(url).pathname === "/");

  // Two rounds of five, once each. Fifteen would mean the session was written
  // on top of its own rounds; five would mean a round went missing.
  await expect.poll(() => totalSeen()).toBe(2 * VOWELS.length);
  expect(history().sessions.length).toBe(2);
});
