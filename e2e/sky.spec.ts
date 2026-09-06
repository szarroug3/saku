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
  expect(res?.headers()["server-timing"], "the header should name where the request landed").toMatch(/edge;.*desc="this request landed in /);
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

test("the settings steppers keep focus while you type in them", async ({ page }) => {
  // SAK-352. The row was a component declared inside another, so every render
  // made a new type, React remounted the subtree, and the field you were
  // typing in went away under you.
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Timer" }).click();
  const seconds = page.getByRole("spinbutton", { name: /seconds/i }).first();
  await expect(seconds).toBeVisible();
  await seconds.click();
  await seconds.press("ControlOrMeta+a");
  await seconds.press("4");
  await seconds.press("5");
  // still the same field, still focused, and it took both keystrokes: before
  // the fix the first one remounted the input and the second went nowhere
  await expect(seconds).toBeFocused();
  await expect(seconds).toHaveValue("45");
});

test("a lesson with nothing to teach says so and offers a way on", async ({ page }) => {
  // SAK-351. Picks that are all already in the sky used to show "Step 0 of 0"
  // with a live Next, which indexed past the end of an empty list and threw.
  const broke: string[] = [];
  page.on("pageerror", (e) => broke.push(e.message));

  await page.goto("/lesson?sample&picks=kana-row:h-k");
  await expect(page.getByText("Nothing to teach")).toBeVisible();
  // no step counter, because there are no steps
  await expect(page.getByText(/Step \d+ of/)).toHaveCount(0);
  // and no Next to press
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  // a way on instead
  await expect(page.getByRole("link", { name: "Pick something to learn" })).toBeVisible();

  // the right arrow used to throw too
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  expect(broke, `the page threw: ${broke.join(", ")}`).toEqual([]);
});

test("a button that is a link walks there instead of reloading the page", async ({ page }) => {
  // SAK-362. SkyButton with an href rendered a plain anchor, so every one of
  // them threw the loaded app away and fetched the whole page again.
  await page.goto("/quiz?sample");
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  // a mark on the window survives a client-side navigation and not a reload
  await page.evaluate(() => { (window as unknown as { kept?: boolean }).kept = true; });
  await page.getByRole("button", { name: "End the quiz" }).click();
  await page.getByRole("link", { name: /observatory/i }).first().click();
  await expect(page).toHaveURL(/\/observatory/);
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept ?? false)).toBe(true);
});

test("a Japanese choice fits its tile instead of breaking in half", async ({ page }) => {
  // SAK-390 and SAK-391. Prompts stepped from 64px to 36px at three
  // characters, and a choice longer than its tile wrapped mid-word, since
  // Japanese has no spaces to break on.
  await page.goto("/quiz?sample");
  await page.getByRole("button", { name: "Multiple choice" }).click();
  const measured = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll("main button")].filter((b) => b.getAttribute("aria-pressed") !== null);
    return tiles.map((t) => {
      const style = getComputedStyle(t);
      return {
        text: (t.textContent ?? "").trim(),
        nowrap: style.whiteSpace === "nowrap",
        overflows: t.scrollWidth > t.clientWidth + 1,
        height: Math.round(t.getBoundingClientRect().height),
      };
    });
  });
  expect(measured.length).toBeGreaterThan(1);
  for (const tile of measured) {
    expect(tile.overflows, `"${tile.text}" spills out of its tile`).toBe(false);
  }
  // and the board is one height, so it does not jump as options light up
  expect(new Set(measured.map((t) => t.height)).size, "tiles differ in height").toBe(1);
});

test("a missed card says what you said, all of it", async ({ page }) => {
  // SAK-387. It read "You put" and showed only the last guess, so missing a
  // card twice hid the two things you confused, which is what the line is for.
  await page.goto("/quiz?sample");
  const box = page.getByPlaceholder(/The reading, in romaji|The meaning, in English|Your answer/);
  await box.fill("zzz");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/^Not that\./)).toBeVisible();
  await box.fill("qqq");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/^Not that\./)).toBeVisible();
  await box.fill("wwww");
  await page.getByRole("button", { name: "Check" }).click();

  // out of tries: both earlier guesses are still there, and it is "said"
  const line = page.getByText(/^You said/);
  await expect(line).toBeVisible();
  await expect(line).toContainText("zzz");
  await expect(line).toContainText("qqq");
  await expect(line).toContainText("wwww");
  await expect(page.getByText(/You put/)).toHaveCount(0);
});

test("reading the reveal does not carry the card off the top", async ({ page }) => {
  // SAK-392. One scroller held both, so reading a long lesson took the card,
  // the verdict, the answer and Next away with it.
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/quiz?sample");
  await page.getByRole("button", { name: "I don't know" }).click();
  const next = page.getByRole("button", { name: /^(Next|Finish)$/ });
  await expect(next).toBeVisible();
  const before = await next.boundingBox();

  // the reveal must actually have somewhere to scroll, or this proves nothing
  const reveal = page.locator("main section").last();
  const scrollable = await reveal.evaluate((el) => el.scrollHeight > el.clientHeight + 4);
  expect(scrollable, "the reveal should be taller than the room it has").toBe(true);
  await reveal.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(150);
  expect(await reveal.evaluate((el) => el.scrollTop), "it should have scrolled").toBeGreaterThan(0);

  const after = await next.boundingBox();
  expect(after, "Next should still be on screen").not.toBeNull();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0)), "the card moved when the reveal scrolled").toBeLessThan(4);
});

test("practice keeps a recipe on the results, without leaving them", async ({ page }) => {
  // SAK-395. It used to navigate back to Practice with the recipe in the
  // query, so the counts, the misses and the other two buttons all vanished
  // to do something that had nothing to do with any of them.
  await page.goto("/practice?sample");
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page).toHaveURL(/\/practice\/run/);
  await page.getByRole("button", { name: "End the quiz" }).click();

  const keep = page.getByRole("button", { name: "Keep this recipe" });
  await expect(keep).toBeVisible();
  await keep.click();
  await page.getByPlaceholder("A name for this recipe").fill("Evening drill");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // still on the results, and it says what it kept
  await expect(page).toHaveURL(/\/practice\/run/);
  await expect(page.getByText(/Kept as/)).toBeVisible();
  await expect(page.getByText("Evening drill")).toBeVisible();
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

test("a session's time is the reader's own, and carries the instant regardless", async ({ page }) => {
  // SAK-355. Signed in, this page renders on the server, and formatting there
  // printed the server's timezone into the HTML. The instant is in dateTime
  // from the first byte; the readable time is the browser's own.
  await page.goto("/sessions?sample");
  const when = page.locator("time[datetime]").first();
  await expect(when).toBeVisible();
  await expect(when).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
  await expect(when).not.toBeEmpty();
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
