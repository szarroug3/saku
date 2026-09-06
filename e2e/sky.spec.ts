// The Sky's pages, end to end (SAK-348): each on the pretend learner or
// signed out, the way the suite runs. Not the look, which is Sam's, but
// that each page opens, its one main action works, and what it says it
// keeps, it keeps.

import { test, expect } from "./helpers/app";

test("practice builds a deck from a collection and starts it", async ({ page }) => {
  await page.goto("/practice?sample");
  await expect(page.getByRole("heading", { name: "What would you like to practice?" })).toBeVisible();
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  await expect(page.getByText(/drawn at random from the/)).toBeVisible();
  const start = page.getByRole("button", { name: "Start" });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page).toHaveURL(/\/practice\/run/);
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
});

test("settings keep a change across a reload", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "How should Saku behave?" })).toBeVisible();
  const timer = page.getByRole("switch", { name: "Timer" });
  await expect(timer).toHaveAttribute("aria-checked", "false");
  await timer.click();
  await expect(timer).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Timer" })).toHaveAttribute("aria-checked", "true");
});

test("the quiz grades a typed answer and reveals on giving up", async ({ page }) => {
  await page.goto("/quiz?sample");
  await expect(page.getByRole("heading", { name: "Quiz", exact: true })).toBeVisible();
  const box = page.getByPlaceholder(/The reading, in romaji|The meaning, in English|Your answer/);
  await box.fill("zzz");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/^Not that\./)).toBeVisible();
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
});

test("the quiz accepts a right answer typed in romaji, with the engine nowhere near the browser", async ({ page }) => {
  // SAK-380 moved grading off the engine and onto a key the server sends with
  // the card. The sample deck opens on あ asked for its reading, so "a" is
  // right and has to be graded right by the key alone.
  await page.goto("/quiz?sample");
  const box = page.getByPlaceholder("The reading, in romaji");
  await box.fill("a");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  // and the tables it used to need are not in the page
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src),
  );
  const sizes = await Promise.all(
    scripts.map(async (src) => (await (await page.request.get(src)).body()).length),
  );
  const total = sizes.reduce((a, b) => a + b, 0);
  expect(total, `the quiz shipped ${(total / 1024 / 1024).toFixed(1)} MB of script`).toBeLessThan(4 * 1024 * 1024);
});

test("a lesson's quiz rests between rounds", async ({ page }) => {
  await page.goto("/quiz?sample&picks=kana-row:h-vowels");
  await page.getByRole("button", { name: "End the quiz" }).click();
  await page.getByRole("button", { name: /Take a rest, then round 2 of 3/ }).click();
  await expect(page.getByRole("heading", { name: "Take a break and come back." })).toBeVisible();
  await expect(page.getByText(/Come back at/)).toBeVisible();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
});

test("the deck is dealt: two quizzes of the same picks are not asked in the same order", async ({ page }) => {
  // SAK-388. Five cards deal 120 ways, so a run that never differs across
  // four loads is the fixed order coming back, not a coincidence.
  const orderNow = async () => {
    await page.goto("/quiz?sample&picks=kana-row:h-vowels");
    const list = page.getByRole("complementary", { name: "The cards" }).getByRole("listitem");
    await expect(list.first()).toBeVisible();
    return (await list.allInnerTexts()).join("|");
  };
  const first = await orderNow();
  let differed = false;
  for (let i = 0; i < 3 && !differed; i++) differed = (await orderNow()) !== first;
  expect(differed).toBe(true);
});

test("the quiz card is centred in the space the list leaves, and never cut off", async ({ page }) => {
  // SAK-396. 1024 is the tightest width the list opens beside the card at,
  // and the width the card used to be squeezed and clipped at.
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.goto("/quiz?sample");
  await expect(page.getByRole("complementary", { name: "The cards" })).toBeVisible();
  const measured = await page.evaluate(() => {
    const panel = document.querySelector('aside[aria-label="The cards"]')!;
    const box = panel.parentElement!;
    const card = box.firstElementChild!;
    const row = card.querySelector('[class*="md:flex-row"]')!;
    const b = box.getBoundingClientRect(), c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return { spilled: row.scrollWidth - row.clientWidth, left: Math.round(c.left - b.left), right: Math.round(Math.min(p.left, b.right) - c.right) };
  });
  // nothing of the card is outside the box that clips it
  expect(measured.spilled).toBe(0);
  // and it sits in the middle of what is left of the row, not held to one side
  expect(Math.abs(measured.left - measured.right)).toBeLessThanOrEqual(2);
});

test("the home draws its sky from a cached catalogue, not from its own response", async ({ page }) => {
  // SAK-381. The stars used to ride in every response, 2.2 MB of them. Now
  // the response carries the learner's difference and the stars come from
  // /api/sky-catalogue, once, cached under a content hash.
  const asked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/sky-catalogue/")) asked.push(r.url()); });

  await page.goto("/?sample");
  const sky = page.getByLabel("Every constellation the sky holds, scattered across it, lit as you learn them");
  await expect(sky).toBeVisible();
  // the sky is really drawn: stars, and something to aim at
  await expect(sky.locator("circle[data-hit]").first()).toBeVisible();
  expect(await sky.locator("circle[data-hit]").count()).toBeGreaterThan(50);

  // the page asked for it in its own HTML, so it starts downloading with the
  // page rather than after hydration
  const preload = page.locator('link[rel="preload"][href*="/api/sky-catalogue/"]');
  await expect(preload).toHaveCount(1);

  // it fetched the catalogue, and the path carries a version
  expect(asked.length).toBe(1);
  expect(asked[0]).toMatch(/\/api\/sky-catalogue\/[^/]+$/);

  // and the catalogue says it may be kept forever
  const answer = await page.request.get(asked[0]);
  expect(answer.headers()["cache-control"]).toContain("immutable");

  // the page's own response is now small
  const html = (await (await page.request.get("/?sample")).body()).length;
  expect(html, `the home sent ${(html / 1024).toFixed(0)} KB`).toBeLessThan(400 * 1024);
});

test("a response says where the server spent its time", async ({ page }) => {
  // SAK-382. The proxy's session refresh goes out as a real Server-Timing
  // header; a page cannot set one, so its own phases ride in a meta tag in
  // the same format. Both are read here so neither can quietly stop working.
  const res = await page.goto("/?sample");
  expect(res?.headers()["server-timing"]).toMatch(/session;dur=[\d.]+/);
  expect(res?.headers()["server-timing"], "the header should name the region").toMatch(/region;.*desc="this function runs in /);
  await expect(page.getByRole("heading", { name: "What have you discovered?" })).toBeVisible();
  const own = await page.locator('meta[name="server-timing"]').getAttribute("content");
  expect(own, "the page should report building the sky").toMatch(/sky;dur=[\d.]+/);
  // and whether this request hit a cold function, which looks identical from
  // the outside to slow code and wants the opposite fix
  expect(own, "the page should say how long the process has been up").toMatch(/(first|uptime);dur=[\d.]+/);
  // and the browser can read the header back, which is what the console snippet does
  const fromBrowser = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return (nav.serverTiming ?? []).map((s) => s.name);
  });
  expect(fromBrowser).toContain("session");
});

test("the atlas opens on its question, with its shelves from a cached catalogue", async ({ page }) => {
  // SAK-381, the same split the home got: the tiles and the shelves are the
  // same for everybody, so they come from /api/atlas-catalogue and what the
  // page sends is the standings and the counts.
  const asked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/atlas-catalogue/")) asked.push(r.url()); });

  await page.goto("/atlas?sample");
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  // the shelves really arrived
  for (const shelf of ["Kana", "Kanji", "Words", "Grammar", "Keigo"]) {
    await expect(page.getByText(shelf, { exact: true }).first()).toBeVisible();
  }

  expect(asked.length).toBe(1);
  const answer = await page.request.get(asked[0]);
  expect(answer.headers()["cache-control"]).toContain("immutable");

  const html = (await (await page.request.get("/atlas?sample")).body()).length;
  expect(html, `the atlas sent ${(html / 1024).toFixed(0)} KB`).toBeLessThan(200 * 1024);
});

test("the account page, signed out, offers to keep the sky", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Want to keep your sky?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my progress" })).toBeVisible();
});

test("recent sessions list the pretend learner's quizzes", async ({ page }) => {
  await page.goto("/sessions?sample");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run it again" })).toBeVisible();
});

test("a visitor's quiz is kept in the browser and shows up under sessions", async ({ page }) => {
  // signed out, no account: the Sky reads and writes the browser's own copy
  await page.goto("/quiz?picks=kana-row:h-vowels");
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  await page.getByRole("button", { name: "I don't know" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByText(/Quiz · 1 card/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/1 of [\d,]+ Discovered/)).toBeVisible();
});
