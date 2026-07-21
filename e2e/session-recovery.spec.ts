import { test, expect, drillReady, type Page } from "./helpers/app";

/**
 * THE SESSION MUST ALWAYS BE ESCAPABLE.
 *
 * A learner who cannot finish a lesson and cannot abandon it either has no way
 * forward from inside the app, which is what happened: the drill stopped
 * counting, End quiz and Discard did nothing, and Clear knowledge base left the
 * session standing. These are the guards on the three things that failed —
 * the cross-tab loop that caused it, and the two hatches that should have got
 * them out of it regardless.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const SESSION_KEY = "kanaquiz-session";

/** Start the day-one lesson and step through to a live drill. */
async function intoTheDrill(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  for (let i = 1; i < VOWELS.length; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
}

/** Count writes to the session snapshot from here on. */
async function countWrites(page: Page) {
  await page.evaluate((key: string) => {
    const w = window as unknown as { __writes?: number };
    w.__writes = 0;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) w.__writes = (w.__writes ?? 0) + 1;
      return orig.call(this, k, v);
    };
  }, SESSION_KEY);
}

async function writes(page: Page): Promise<number> {
  return await page.evaluate(
    () => (window as unknown as { __writes?: number }).__writes ?? 0,
  );
}

async function storedSession(page: Page) {
  return await page.evaluate(
    (key: string) => localStorage.getItem(key),
    SESSION_KEY,
  );
}

/**
 * TWO OPEN TABS MUST NOT WRITE TO EACH OTHER FOREVER.
 *
 * The brick was a feedback loop: adopting the other tab's snapshot remounted
 * the drill, whose onMount published the snapshot back, which the other tab
 * adopted, and so on — ~14,000 writes in 3 seconds with nobody touching either
 * tab. The number to assert on is the write count while IDLE, because that is
 * the loop itself rather than any symptom of it; a healthy pair of tabs writes
 * nothing at all when nothing is happening.
 */
test("two open tabs in one drill do not write to each other in a loop", async ({
  page,
  seed,
  context,
}) => {
  const loops: string[] = [];
  const watch = (p: Page, tag: string) => {
    p.on("console", (m) => {
      if (m.type() === "error" && /Maximum update depth/.test(m.text())) {
        loops.push(`${tag}: ${m.text()}`);
      }
    });
  };

  watch(page, "tab A");
  await seed({ seen: [], cfg: {} });
  await intoTheDrill(page);

  // A second tab on the same origin, restoring the same session.
  const tabB = await context.newPage();
  watch(tabB, "tab B");
  await tabB.goto("/quiz");
  await drillReady(tabB);

  await countWrites(page);
  await countWrites(tabB);
  await tabB.locator("body").click();
  await page.waitForTimeout(3000);

  expect(loops).toEqual([]);
  // Idle means idle. Anything above a handful is the loop coming back.
  expect(await writes(page)).toBeLessThan(5);
  expect(await writes(tabB)).toBeLessThan(5);

  // And the drill still WORKS in the surviving tab: the runtime must move.
  const pulse = async () =>
    await page.evaluate((key: string) => {
      const s = JSON.parse(localStorage.getItem(key) ?? "null");
      const rt = s?.active?.runtime ?? {};
      return `${rt.asked}/${rt.resolved}/${rt.q?.tries}`;
    }, SESSION_KEY);
  const before = await pulse();
  const box = page.locator('input[placeholder^="Type"]').first();
  await box.fill("a");
  await box.press("Enter");
  await page.waitForTimeout(1000);
  expect(await pulse()).not.toBe(before);
});

/**
 * DISCARD MUST ACTUALLY DISCARD — including the parked runs behind it. The
 * seeded snapshot is deliberately a MESS: a live session plus two parked runs,
 * which is the state a learner who has bounced between lessons ends up in and
 * the state the hatches were never exercised against.
 */
test("Discard clears a run and does not leave it in the snapshot", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await intoTheDrill(page);

  await page.goto("/current");
  await expect(page.getByText("Nothing in progress")).toHaveCount(0);

  await page.getByRole("button", { name: "Discard ✕" }).first().click();
  await expect(page.getByText("Nothing in progress")).toBeVisible();

  // Gone from the snapshot too, not just from the screen.
  const raw = await storedSession(page);
  const parsed = raw ? JSON.parse(raw) : null;
  expect(parsed?.active ?? null).toBeNull();
  expect(parsed?.session ?? null).toBeNull();

  // And it stays gone across a reload, which is where a half-discard shows up.
  await page.reload();
  await expect(page.getByText("Nothing in progress")).toBeVisible();
});

/**
 * CLEAR KNOWLEDGE BASE MUST MEAN WHAT IT SAYS.
 *
 * The card promises "the app starts over from its first lesson, as if you had
 * just installed it". It wiped the server's history and left every run in
 * localStorage, so the session a learner was trying to escape survived the
 * app's own nuclear option. A fresh install has nothing in progress.
 */
test("Clear knowledge base clears the session in progress", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await intoTheDrill(page);
  expect(await storedSession(page)).not.toBeNull();

  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Clear knowledge base", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear everything", exact: true })
    .click();
  await expect(page.getByText(/Knowledge base cleared/)).toBeVisible();

  // The run in progress is gone, not merely hidden.
  const raw = await storedSession(page);
  expect(raw === null || JSON.parse(raw).session === null).toBe(true);

  await page.goto("/current");
  await expect(page.getByText("Nothing in progress")).toBeVisible();

  // Home is back to lesson one, which is the promise in full.
  await page.goto("/");
  await expect(page.locator("body")).toContainText("group 1 of 27");
});

/**
 * DISCARD MUST NOT BE UNDONE BY ANOTHER TAB.
 *
 * Discarding always worked on its own — with one tab open it clears the run and
 * always did. What it could not survive was a second tab that still held the
 * session and published it back, which is why the tester pressed Discard, saw
 * nothing happen, and had no way to tell those two cases apart. The run has to
 * stay discarded.
 */
test("a discarded run is not resurrected by a second tab", async ({
  page,
  seed,
  context,
}) => {
  await seed({ seen: [], cfg: {} });
  await intoTheDrill(page);

  // A second tab holding the same live session.
  const tabB = await context.newPage();
  await tabB.goto("/quiz");
  await drillReady(tabB);

  // Tab A discards from the Current sessions list.
  await page.goto("/current");
  await page.getByRole("button", { name: "Discard ✕" }).first().click();
  await expect(page.getByText("Nothing in progress")).toBeVisible();

  // Give the other tab every chance to write it back.
  await tabB.locator("body").click();
  await page.waitForTimeout(2000);

  await expect(page.getByText("Nothing in progress")).toBeVisible();
  const raw = await storedSession(page);
  expect(raw === null || JSON.parse(raw).session === null).toBe(true);
});

/**
 * The other half of the clear: a SECOND tab must let go too. A surviving tab
 * that still holds the session will write it back the next time anything
 * changes, which is how the reset looked like it had done nothing.
 */
test("clearing in one tab drops the session in the other", async ({
  page,
  seed,
  context,
}) => {
  await seed({ seen: [], cfg: {} });
  await intoTheDrill(page);

  const tabB = await context.newPage();
  await tabB.goto("/current");
  await expect(tabB.getByText("Nothing in progress")).toHaveCount(0);

  // Tab A pulls the lever.
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Clear knowledge base", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear everything", exact: true })
    .click();
  await expect(page.getByText(/Knowledge base cleared/)).toBeVisible();

  // Tab B lets go on its own, without being reloaded.
  await expect(tabB.getByText("Nothing in progress")).toBeVisible({
    timeout: 10000,
  });
});
