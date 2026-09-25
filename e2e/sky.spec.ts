// The Sky's pages, end to end (SAK-348): each on the pretend learner or
// signed out, the way the suite runs. Not the look, which is Sam's, but
// that each page opens, its one main action works, and what it says it
// keeps, it keeps.

import { test, expect, type Locator, type Page } from "./helpers/app";

/**
 * Kana is the gate: every other track on the Observatory is behind it, so a
 * signed-out test that wants one of them claims kana first. The page's own
 * way of saying "I have this already": pick everything the Kana section lays
 * out, press "I already know these", and go again until the section is gone.
 */
async function claimAllKana(page: Page) {
  const kana = page.locator("section", { has: page.getByRole("heading", { name: "Kana", exact: true }) });
  await expect(kana).toBeVisible();
  const tiles = kana.locator("button[aria-pressed]");
  // a round claims what the section lays out, at most nine, and a row opens
  // the ones built on it, so the two scripts take about eight rounds
  for (let round = 0; round < 16; round++) {
    if (!(await kana.count())) return;
    const start = kana.getByRole("button", { name: "Start kana" });
    if (await start.count()) await start.click();
    await expect(tiles.first()).toBeVisible();
    const before = await tiles.allInnerTexts();
    for (let i = 0; i < before.length; i++) await tiles.nth(i).click();
    await page.getByRole("button", { name: "I already know these" }).click();
    // the claim is a server action and a redraw, so the rows just claimed are
    // still on screen for a moment; wait for the ones behind them, or for the
    // section to go when there are none
    await expect(async () => {
      const gone = (await kana.count()) === 0;
      const now = await tiles.allInnerTexts();
      expect(gone || (now.length > 0 && now.join() !== before.join())).toBe(true);
    }).toPass({ timeout: 20_000 });
  }
  throw new Error("kana is still on offer after sixteen rounds of claiming it");
}

test("practice builds a deck from a collection and starts it", async ({ page }) => {
  await page.goto("/practice?sample");
  await expect(page.getByRole("heading", { name: "What would you like to practice?" })).toBeVisible();
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  // items and questions are two different counts (SAK-428), and the number
  // a limited draw is set to counts questions (SAK-437): "10 questions,
  // drawn at random from the 106 items below"
  await expect(page.getByText(/[\d,]+ questions, drawn at random from the [\d,]+ items below/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Tonight's drill", exact: true })).toBeVisible();
  const box = page.getByPlaceholder(/In romaji, or how it sounds|The meaning, in English|Your answer/);
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
  const box = page.getByPlaceholder("In romaji, or how it sounds");
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

test("the quiz takes how the sound is spelled in English, not only the romaji", async ({ page }) => {
  // SAK-435. The same あ card, answered "ah", which is what an English speaker
  // types when asked how a character is said. The spelling is worked out on the
  // server and rides in the card's key, so this proves the whole chain.
  await page.goto("/quiz?sample");
  const box = page.getByPlaceholder("In romaji, or how it sounds");
  await box.fill("ah");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  // and the reveal answers in the spelling that was typed, with the card's own
  // romaji named under it (SAK-440): it used to print "a" over a PERFECT, an
  // answer the learner never gave. A right answer moves straight on, so the
  // reveal is reached by stepping back to the card (SAK-425).
  await page.getByRole("button", { name: "Back a card" }).click();
  // the big line itself, not the card under the sky, which also spells the
  // sound out
  await expect(page.getByRole("paragraph").filter({ hasText: /^ah$/ })).toBeVisible();
  await expect(page.getByText("Written a in romaji.")).toBeVisible();
});

test("the reveal answers in the card's own spelling when that is what was typed", async ({ page }) => {
  // SAK-440's other half: "a" is あ's own answer, so there is no second
  // spelling to name and the muted line is not there at all.
  await page.goto("/quiz?sample");
  await page.getByPlaceholder("In romaji, or how it sounds").fill("a");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Perfect", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back a card" }).click();
  // the reveal is open, and carries no second spelling
  await expect(page.getByText("You got it right without any help.")).toBeVisible();
  await expect(page.getByText("Written a in romaji.")).toHaveCount(0);
});

test("a lesson's quiz rests between rounds", async ({ page }) => {
  await page.goto("/quiz?sample&picks=kana-row:h-vowels");
  await page.getByRole("button", { name: "End the quiz" }).click();
  await page.getByRole("button", { name: /Take a rest, then round 2 of 3/ }).click();
  await expect(page.getByRole("heading", { name: "A break between rounds" })).toBeVisible();
  await expect(page.getByText(/Come back at/)).toBeVisible();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
});

test("the deck is dealt: two quizzes of the same picks are not asked in the same order", async ({ page }) => {
  // SAK-388. The five vowels are ten cards now, written and by ear (SAK-447),
  // and ten cards deal more ways than four loads could ever land on twice, so
  // a run that never differs is the fixed order coming back, not a
  // coincidence.
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

test("the quiz card is centered in the space the list leaves, and never cut off", async ({ page }) => {
  // SAK-396. 1024 is the tightest width the list opens beside the card at,
  // and the width the card used to be squeezed and clipped at.
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.goto("/quiz?sample");
  await expect(page.getByRole("complementary", { name: "The cards" })).toBeVisible();
  const measured = await page.evaluate(() => {
    const panel = document.querySelector('aside[aria-label="The cards"]')!;
    const box = panel.parentElement!;
    const card = box.firstElementChild!;
    // the row that holds the question beside its help bar, which is what used
    // to spill past the clip: the card holds one surface, and the row is the
    // last thing on it, under the two arrows. Walked rather than picked out by
    // a class, so renaming a Tailwind utility cannot quietly pass this test.
    const row = card.firstElementChild!.lastElementChild!;
    const b = box.getBoundingClientRect(), c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return { spilled: row.scrollWidth - row.clientWidth, left: Math.round(c.left - b.left), right: Math.round(Math.min(p.left, b.right) - c.right) };
  });
  // nothing of the card is outside the box that clips it
  expect(measured.spilled).toBe(0);
  // and it sits in the middle of what is left of the row, not held to one side
  expect(Math.abs(measured.left - measured.right)).toBeLessThanOrEqual(2);
});

test("loading a page does not fetch every other page behind your back", async ({ page }) => {
  // SAK-382. The bar's links prefetched on load, and with every route dynamic
  // a prefetch is a function call that carries nothing: twenty of them per
  // home load on the deployed app, and a click afterwards fetched the page
  // again regardless.
  const prefetched: string[] = [];
  page.on("request", (r) => {
    if (r.headers()["next-router-prefetch"] || r.headers()["purpose"] === "prefetch") prefetched.push(new URL(r.url()).pathname);
  });
  await page.goto("/?sample");
  await expect(page.getByRole("heading", { name: "What have you discovered?" })).toBeVisible();
  await page.waitForTimeout(2500);
  expect(prefetched, `prefetched: ${prefetched.join(", ")}`).toEqual([]);
});

test("the wash is a small bitmap the browser may keep", async ({ page }) => {
  // SAK-383. It was 611 KB, because the bake wrote filter 0 on all 900 rows
  // and deflate never saw a delta, and it was served max-age=0, so a browser
  // could not paint the background without revalidating it first: a 304 on
  // every navigation of every page. The url comes off the painted element
  // rather than out of the CSS file, so a stale hand-edited hash fails here.
  await page.goto("/?sample");
  const url = await page.evaluate(() => {
    const el = document.querySelector(".sky-wash");
    const m = el && getComputedStyle(el).backgroundImage.match(/url\("([^"]*wash-baked[^"]*)"\)/);
    return m ? m[1] : null;
  });
  expect(url, "the wash element should paint a baked bitmap").toBeTruthy();
  expect(url).toMatch(/\/sky\/wash-baked-[0-9a-f]+\.png$/);

  const res = await page.request.get(url!);
  expect(res.status()).toBe(200);
  const bytes = (await res.body()).length;
  expect(bytes, `the wash is ${(bytes / 1024).toFixed(0)} KB`).toBeLessThan(400_000);
  expect(res.headers()["cache-control"]).toContain("immutable");
});

test("a signed-out page is one document and one action, not two of anything", async ({ page }) => {
  // SAK-383 called this "the signed-out path loads every page twice". It does
  // not: the page comes down once and then asks a server action for the data
  // that lives in this browser, which is what "sign-in preferred, never
  // required" costs. What would be a real regression is a second document or
  // an RSC fetch of the page it is already on.
  const documents: string[] = [];
  const actions: string[] = [];
  const rsc: string[] = [];
  page.on("request", (r) => {
    const h = r.headers();
    const where = new URL(r.url()).pathname;
    if (r.resourceType() === "document") documents.push(where);
    else if (h["next-action"]) actions.push(where);
    else if (h["rsc"]) rsc.push(where);
  });
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await page.waitForTimeout(2000);
  expect(documents, `documents: ${documents.join(", ")}`).toEqual(["/sessions"]);
  expect(actions.length, `actions: ${actions.join(", ")}`).toBeLessThanOrEqual(1);
  expect(rsc, `rsc: ${rsc.join(", ")}`).toEqual([]);
});

test("the home draws its sky from a cached catalogue, not from its own response", async ({ page }) => {
  // SAK-381. The stars used to ride in every response, 2.2 MB of them. Now
  // the response carries the learner's difference and the stars come from
  // /api/sky-catalogue, once, cached under a content hash.
  const asked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/sky-catalogue/")) asked.push(r.url()); });

  await page.goto("/?sample");
  const sky = page.getByLabel("Every constellation in the sky, scattered across it, lit as you learn them");
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

test("the lesson's order holds only what it teaches, and the references what it rests on", async ({ page }) => {
  // SAK-416. "Tonight, in order" used to run the terms and intros the walk
  // slots in among the stars, so 電車 read "Step 1 of 8" with four of the
  // eight being a term or an intro, and 田, already in the sky under 電, was
  // on the constellation and in no list at all.
  await page.goto(`/lesson?sample&picks=${encodeURIComponent("word:電車")}`);
  const order = page.getByRole("list").first();
  const references = page.getByRole("list").nth(1);
  await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();

  // the order is the stars: 雨, 電, 車, 電車, and nothing wearing a TERM or
  // an INTRO beside it
  await expect(page.getByText(/Step \d+ of 4/)).toBeVisible();
  await expect(order.getByRole("listitem")).toHaveCount(4);
  await expect(order.getByText(/^(Term|Intro)$/i)).toHaveCount(0);

  // and the references hold 田 with the terms and the intro behind tonight
  await expect(references.getByRole("listitem").filter({ hasText: "In your sky" })).toHaveCount(1);
  await expect(references.getByText("Kanji", { exact: true })).toBeVisible();
  await expect(references.getByText("How a kanji is built")).toBeVisible();

  // Every page in the list wears its KIND word, the one the Atlas and the
  // Observatory use for it (SAK-432). "How a kanji is built" is an intro and
  // the Atlas files it under Terms, so the row reads "term", not "Intro".
  await expect(references.getByText("Intro", { exact: true })).toHaveCount(0);
  const intro = references.getByRole("listitem").filter({ hasText: "How a kanji is built" });
  await expect(intro.getByText("term", { exact: true })).toBeVisible();

  // opening one shows it and leaves the lesson where it was
  await page.getByRole("button", { name: "Next" }).first().click();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  const built = references.getByRole("button").filter({ hasText: "How a kanji is built" });
  await built.click();
  // its name is on the page twice now: its row, and the head of the card
  await expect(page.getByText("How a kanji is built")).toHaveCount(2);
  await expect(built).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
});

test("what tonight teaches is settled when the lesson starts, and holds", async ({ page }) => {
  // SAK-446. Opening a star marks its facts seen, and seen is also what makes
  // a star one the learner already has, so the star just opened jumped out of
  // "Tonight, in order" into References and "Step 1 of 5" became "Step 1 of
  // 4". Signed out, because that is where the write and the rebuild both
  // happen: the sample learner's lesson never writes anything.
  // Straight to the first star: a fresh lesson opens on the reference pages
  // nobody has read (SAK-467), and this test is about the order.
  await lessonOnStepOne(page, "/lesson?picks=kana-row:h-vowels");
  const order = page.getByRole("list").first();
  const references = page.getByRole("list").nth(1);
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  // N is the number of rows in the order, always
  await expect(order.getByRole("listitem")).toHaveCount(5);
  const rested = await references.getByRole("listitem").count();
  expect(rested).toBeGreaterThan(0);

  // Next advances n and leaves N alone
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  // the mark is a round trip through a server action and back into the
  // browser's copy, so this waits for the write rather than for a paint: the
  // rail used to move when it landed, not when the button was pressed
  await expect
    .poll(() => page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("saku-local-history");
        return raw ? Object.keys(JSON.parse(raw).seen ?? {}).length : 0;
      } catch {
        return 0;
      }
    }))
    .toBeGreaterThan(0);
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await expect(order.getByRole("listitem")).toHaveCount(5);
  await expect(references.getByRole("listitem")).toHaveCount(rested);
  // nothing tonight teaches is listed as something the learner already has
  await expect(references.getByText("In your sky")).toHaveCount(0);

  // and a reload does not move any of it either: the same five, opened on
  // the step that was left (SAK-444 keeps the lesson's place)
  await page.reload();
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await expect(order.getByRole("listitem")).toHaveCount(5);
  await expect(references.getByRole("listitem")).toHaveCount(rested);
  await expect(references.getByText("In your sky")).toHaveCount(0);
});

test("a reference page nobody has read opens the lesson, and is listed ever after", async ({ page }) => {
  // SAK-467. Sam: "when an unseen before reference page is in a lesson, when
  // the lesson opens, it should show the first reference page." And a page
  // counts as read once it has been in a lesson at all, clicked or not, so
  // the next lesson listing it opens on step one. Signed out, because the
  // mark and the lesson that reads it both live in this browser.
  const order = page.getByRole("list").first();
  const references = page.getByRole("list").nth(1);
  const step = page.getByText(/^Step \d+ of \d+$/);
  const current = page.locator('[aria-current="true"]');

  await page.goto("/lesson?picks=kana-row:h-vowels");
  await expect(step).toHaveText("Step 1 of 5");
  // the first page of the list is what is showing, and it is a page of the
  // list and not a sixth step: the counter has not moved
  const pages = await references.getByRole("listitem").allInnerTexts();
  expect(pages.length).toBeGreaterThan(0);
  await expect(current).toHaveCount(1);
  await expect(references.getByRole("button").first()).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-lesson-cell="card"]')).toContainText("Kana");

  // Next walks the rest of the pages, still on step one, and then opens the
  // first star
  for (let i = 1; i < pages.length; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(step).toHaveText("Step 1 of 5");
    await expect(references.getByRole("button").nth(i)).toHaveAttribute("aria-current", "true");
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).toHaveText("Step 1 of 5");
  await expect(references.locator('[aria-current="true"]')).toHaveCount(0);
  await expect(order.getByRole("button").first()).toHaveAttribute("aria-current", "step");

  // the next lesson lists every one of them again, and opens on step one with
  // nothing picked out under References
  await page.goto("/lesson?picks=kana-row:h-k");
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  await expect(references.getByRole("listitem")).toHaveCount(pages.length);
  expect(await references.getByRole("listitem").allInnerTexts()).toEqual(pages);
  await expect(references.locator('[aria-current="true"]')).toHaveCount(0);
  await expect(order.getByRole("button").first()).toHaveAttribute("aria-current", "step");
});

test("the lesson is a two by two, and each row's two panels are one height", async ({ page }) => {
  // SAK-446. References sits beside the constellation and the order beside
  // the card, in one grid with two rows, so the heights agree exactly rather
  // than by eye.
  const cell = async (name: string) => {
    const box = await page.locator(`[data-lesson-cell="${name}"]`).boundingBox();
    if (!box) throw new Error(`no ${name} cell`);
    return box;
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/lesson?sample&picks=${encodeURIComponent("word:電車")}`);
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();
  const sky = await cell("sky");
  const references = await cell("references");
  const card = await cell("card");
  const order = await cell("order");
  // top right, beside the sky and level with it
  expect(references.x).toBeGreaterThanOrEqual(sky.x + sky.width);
  expect(Math.abs(references.y - sky.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(references.height - sky.height)).toBeLessThanOrEqual(1);
  // bottom right, beside the card and as tall
  expect(order.x).toBeGreaterThanOrEqual(card.x + card.width);
  expect(order.y).toBeGreaterThanOrEqual(sky.y + sky.height);
  expect(Math.abs(order.height - card.height)).toBeLessThanOrEqual(1);
  // the right column keeps the rail's width
  expect(Math.abs(references.width - order.width)).toBeLessThanOrEqual(1);

  // a lesson that rests on nothing leaves no hole: the sky keeps the left
  // column and the order takes the whole right one (SAK-478; it used to be
  // the sky across both columns and a short order panel under a hole)
  await page.goto(`/lesson?sample&picks=${encodeURIComponent("primitive:圭")}`);
  await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
  await expect(page.locator('[data-lesson-cell="references"]')).toHaveCount(0);
  const same = await cell("sky");
  const alone = await cell("order");
  expect(Math.abs(same.width - sky.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(alone.y - same.y)).toBeLessThanOrEqual(1);
  expect(alone.height).toBeGreaterThan(order.height);

  // narrow, the four are a stack in the order they are read: the sky, the
  // details, Tonight, References, and the body scrolls to the end of it
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto(`/lesson?sample&picks=${encodeURIComponent("word:電車")}`);
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();
  const stack = [await cell("sky"), await cell("card"), await cell("order"), await cell("references")];
  for (let i = 1; i < stack.length; i++) {
    expect(stack[i].y).toBeGreaterThanOrEqual(stack[i - 1].y + stack[i - 1].height);
    expect(Math.abs(stack[i].x - stack[0].x)).toBeLessThanOrEqual(1);
  }
  const heading = page.getByRole("heading", { name: "References", exact: true });
  await heading.scrollIntoViewIfNeeded();
  const seen = await heading.boundingBox();
  expect(seen && seen.y).toBeLessThan(900);
});

test("with no References, the order takes the whole right column (SAK-478)", async ({ page }) => {
  // Sam, 2026-09-24, on a lesson of は, Simple and を: "this looks awkward.
  // if there's no reference, just make the tonight, in order bar full
  // height." The sky spanned both columns and the order was a short panel at
  // the bottom right with a hole above it.
  const cell = async (name: string) => {
    const box = await page.locator(`[data-lesson-cell="${name}"]`).boundingBox();
    if (!box) throw new Error(`no ${name} cell`);
    return box;
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/lesson?sample&picks=${encodeURIComponent("grammar:wa,grammar:wo")}`);
  await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "References", exact: true })).toHaveCount(0);
  const sky = await cell("sky");
  const card = await cell("card");
  const order = await cell("order");
  // the sky keeps the left column
  expect(sky.x + sky.width).toBeLessThanOrEqual(order.x);
  // and the order runs from the sky's top to the card's bottom
  expect(Math.abs(order.y - sky.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(order.y + order.height - (card.y + card.height))).toBeLessThanOrEqual(1);
});

test("the lesson's details card is dragged taller and nothing else moves (SAK-471)", async ({ page }) => {
  // SAK-471, after Sam's review: "i want the details panel to be the only
  // expandable panel. it should be draggable and have a button similar to how
  // the atlas can be dragged left. the references and tonight in order can
  // stay as they are and not expand."
  const cell = async (name: string) => {
    const box = await page.locator(`[data-lesson-cell="${name}"]`).boundingBox();
    if (!box) throw new Error(`no ${name} cell`);
    return box;
  };
  const lesson = `/lesson?sample&picks=${encodeURIComponent("word:電車")}`;
  const handle = page.getByRole("separator", { name: "Drag to make the details taller" });
  const up = page.getByRole("button", { name: "Pull the details all the way up" });
  const back = page.getByRole("button", { name: "Put the sky back" });
  // Which way the chevron points: "none" is upright and "180deg" is turned
  // over, since the ring rotates one glyph rather than drawing two (SAK-414).
  const turn = (button: Locator) =>
    button.locator("span[aria-hidden='true']").evaluate((el) => getComputedStyle(el).rotate);
  // The button is inside the card, in its top right corner, at the card's own
  // padding, and it covers nothing the card is showing. Sam, 2026-09-20: "it's
  // also hanging outside the panel."
  const inCorner = async () => {
    const card = await page.locator("#lesson-details > section").boundingBox();
    const button = await page.locator('#lesson-details button[aria-controls="lesson-details"]').boundingBox();
    if (!card || !button) throw new Error("no card or no button");
    // inside the card's box on every side
    expect(button.x).toBeGreaterThanOrEqual(card.x);
    expect(button.y).toBeGreaterThanOrEqual(card.y);
    expect(button.x + button.width).toBeLessThanOrEqual(card.x + card.width);
    expect(button.y + button.height).toBeLessThanOrEqual(card.y + card.height);
    // and at the corner of the card's padding box: 20px of padding inside a
    // 1px border, the same inset down from the top and in from the right
    expect(Math.abs(button.y - (card.y + 21))).toBeLessThanOrEqual(1);
    expect(Math.abs(button.x + button.width - (card.x + card.width - 21))).toBeLessThanOrEqual(1);
    // nothing the card draws is under it: not the heading row, not the
    // pager's "1 of 2", not a word of the lesson
    const under = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>('#lesson-details button[aria-controls="lesson-details"]');
      if (!button) return ["no button"];
      const b = button.getBoundingClientRect();
      const hit: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("#lesson-details *")) {
        if (button.contains(el) || el.contains(button) || el.childElementCount > 0) continue;
        const text = (el.textContent ?? "").trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) hit.push(text.slice(0, 24));
      }
      return hit;
    });
    expect(under).toEqual([]);
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(lesson);
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();
  const sky = await cell("sky");
  const wasCard = await cell("card");
  const wasReferences = await cell("references");
  const wasOrder = await cell("order");
  // at rest the two by two holds: each row's two panels are one height
  expect(Math.abs(wasReferences.height - sky.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(wasOrder.height - wasCard.height)).toBeLessThanOrEqual(1);
  await expect(handle).toHaveAttribute("aria-valuenow", "58");
  await expect(up).toHaveAttribute("aria-expanded", "false");
  // the chevron says where the press will send the card, so at rest it points
  // UP (Sam, 2026-09-20: "it should face up when it expands upward and down
  // when it collapses"). It was the other way round, read off `aria-expanded`.
  expect(await turn(up)).toBe("none");
  // and the button is in the card's own top right corner, inset by the card's
  // padding, rather than hanging over the panel's edge
  await inCorner();

  // dragging the handle up takes 150px from the sky and gives them to the card
  const grip = await handle.boundingBox();
  if (!grip) throw new Error("no handle");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 150, { steps: 10 });
  await page.mouse.up();
  const dragged = await cell("card");
  expect(Math.abs(dragged.height - (wasCard.height + 150))).toBeLessThanOrEqual(1);
  expect(Math.abs((await cell("sky")).height - (sky.height - 150))).toBeLessThanOrEqual(1);
  // the band is shorter and the sky has moved with it: every star of tonight's
  // constellation, the one the card is showing among them, is inside the band
  // rather than cropped below it
  const band = await cell("sky");
  const stars = page.locator('[data-lesson-cell="sky"] circle[data-hit]');
  const many = await stars.count();
  expect(many).toBeGreaterThan(0);
  for (let i = 0; i < many; i++) {
    const star = await stars.nth(i).boundingBox();
    if (!star) throw new Error("no star");
    expect(star.y).toBeGreaterThanOrEqual(band.y - 1);
    expect(star.y + star.height).toBeLessThanOrEqual(band.y + band.height + 1);
  }
  // and the right column has not moved by a pixel, which is the whole point
  expect(await cell("references")).toEqual(wasReferences);
  expect(await cell("order")).toEqual(wasOrder);

  // the height is this browser's, so the lesson opens at it again
  await page.reload();
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();
  expect(Math.abs((await cell("card")).height - dragged.height)).toBeLessThanOrEqual(1);
  expect(await cell("references")).toEqual(wasReferences);

  // one press takes the card all the way up: it starts where the sky started
  // and ends where it ended, and the right column is still where it was
  await up.click();
  await expect(page.locator('[data-lesson-cell="sky"]')).toBeHidden();
  const filled = await cell("card");
  expect(Math.abs(filled.y - sky.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(filled.y + filled.height - (wasCard.y + wasCard.height))).toBeLessThanOrEqual(1);
  expect(await cell("references")).toEqual(wasReferences);
  expect(await cell("order")).toEqual(wasOrder);
  await expect(handle).toHaveAttribute("aria-valuenow", "100");
  await expect(back).toHaveAttribute("aria-expanded", "true");
  // all the way up, the press brings the card back down, so the chevron is
  // turned over. The button has not left the card's corner to do it.
  expect(await turn(back)).toBe("180deg");
  await inCorner();
  // the step and the buttons that walk it are still in reach, unscrolled
  await expect(page.getByText(/^Step \d+ of \d+$/)).toBeVisible();
  const next = await page.getByRole("button", { name: "Next", exact: true }).boundingBox();
  expect(next && next.y + next.height).toBeLessThan(900);

  // a second press is the two by two again
  await back.click();
  await expect(page.locator('[data-lesson-cell="sky"]')).toBeVisible();
  expect(Math.abs((await cell("card")).height - wasCard.height)).toBeLessThanOrEqual(1);
  expect(await cell("references")).toEqual(wasReferences);

  // the arrow keys move the handle too, for anyone who cannot drag one
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  expect(Math.abs((await cell("card")).height - (wasCard.height + 24))).toBeLessThanOrEqual(1);
  await page.keyboard.press("ArrowDown");
  expect(Math.abs((await cell("card")).height - wasCard.height)).toBeLessThanOrEqual(1);
  expect(await cell("references")).toEqual(wasReferences);

  // narrow, where the four are a stack, there is no sky above the card to
  // take room from, so neither the handle nor the button is offered
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto(lesson);
  await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
  await expect(page.locator('[data-lesson-cell="sky"]')).toBeVisible();
  await expect(handle).toBeHidden();
  await expect(up).toBeHidden();
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
  const box = page.getByPlaceholder(/In romaji, or how it sounds|The meaning, in English|Your answer/);
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

test("deleting a saved recipe asks first, and Keep it keeps it", async ({ page }) => {
  // SAK-364. Delete fired on the click, with no ask and no undo, while
  // forgetting a session and wiping progress both asked inline.
  await page.goto("/practice?sample");
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await page.getByPlaceholder("A name for this recipe").fill("Evening drill");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved as Evening drill" })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  // SAK-443: the verb says the whole of it, so the sentence that used to sit
  // beside it is gone
  await expect(page.getByRole("button", { name: "Delete it forever" })).toBeVisible();
  await expect(page.getByText("This recipe goes for good.")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("button", { name: "Saved as Evening drill" })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete it forever" }).click();
  await expect(page.getByRole("button", { name: "Save this recipe" })).toBeVisible();
});

test("a quiz sends you back where you came from", async ({ page }) => {
  // SAK-353. Both the results and the rest screen offered "Back to the
  // observatory" whatever had sent you, and told practice apart by looking
  // for the word in the href.
  await page.goto("/quiz?sample&from=atlas");
  await page.getByRole("button", { name: "End the quiz" }).click();
  const backToAtlas = page.getByRole("link", { name: "Back to the Atlas" });
  await expect(backToAtlas).toBeVisible();
  await expect(backToAtlas).toHaveAttribute("href", /\/atlas/);

  await page.goto("/quiz?sample&from=sessions");
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("link", { name: "Back to your sessions" })).toBeVisible();

  // and with nobody saying, the Observatory is still the answer
  await page.goto("/quiz?sample");
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("link", { name: "Back to the observatory" })).toBeVisible();
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

test("a search the open collection has none of draws the other collections' matches (SAK-475)", async ({ page }) => {
  // Sam, 2026-09-20, with Sentences open: "search を doesn't bring up the
  // page". It said "0 Shown · Matching を. Nothing in Sentences matches. Also
  // found: 1 Kana, 17 Words, 1 Grammar", and the 〜を page sat behind a chip.
  await page.goto("/atlas?sample");
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  await page.getByRole("button", { name: /^Sentences/ }).first().click();
  await page.getByRole("searchbox").fill("を");

  // Sam, 2026-09-21: "this search should show the sentence result, right?"
  // 〜を is a tile on the Sentences shelf, so Sentences finds it
  await expect(page.getByText(/^\d+ Shown · Matching/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^〜を/ }).first()).toBeVisible();
  await expect(page.getByText("Nothing in Sentences matches.")).toHaveCount(0);

  // a collection with no を in it: the line and the chips are what they were
  await page.getByRole("button", { name: /^Radicals/ }).first().click();
  await expect(page.getByText("Nothing in Radicals matches.")).toBeVisible();
  await expect(page.getByRole("button", { name: "1 Grammar" })).toBeVisible();

  // the other collections' tiles are drawn under their names, Grammar first
  // because を is kana, then the shelves' own order
  const names = page.locator("p[class*='font-semibold'][class*='text-sky-muted']");
  await expect(names).toHaveText(["Grammar", "Kana", "Words"]);

  // and 〜を, the page the を was typed for, leads its group
  const wo = page.getByRole("button", { name: /^〜を/ });
  await expect(wo).toBeVisible();

  // the tile opens the particle's page in the panel, as any tile does
  await wo.click();
  const panel = page.locator("[data-atlas-panel]");
  await expect(panel.getByText("marks the direct object").first()).toBeVisible();
  await expect(panel.getByText("Take a noun, just as it is, and add を.")).toBeVisible();

  // a search this collection DOES have keeps today's view: its own tile, the
  // chips, and no other collection's tiles
  await page.getByRole("button", { name: /^Sentences/ }).first().click();
  await page.getByRole("searchbox").fill("because");
  await expect(page.getByText(/^\d+ Shown · Matching/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Because / so" })).toBeVisible();
  await expect(names).toHaveCount(0);
});

test("the atlas opens on the shelf that holds what you asked for", async ({ page }) => {
  // SAK-354. /atlas?entry=kanji:日 opened 日 in the panel with the middle
  // still showing Kana, so closing the panel left you on the wrong shelf.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  // the rail lights the shelf the entry is on
  const kanji = page.getByRole("button", { name: /^Kanji/ }).first();
  await expect(kanji).toHaveAttribute("aria-pressed", "true");
});

test("the atlas panel has the lesson's drag line, and the width it is left at holds (SAK-471)", async ({ page }) => {
  // Sam, 2026-09-20: "on the lesson page, the drag line is perfect. add it to
  // the atlas too since that's missing it." The panel's left edge was a bare
  // strip with a resize cursor and nothing to see, and the width was plain
  // state, so a reload was back at 360px.
  const entry = `/atlas?sample&entry=${encodeURIComponent("kanji:日")}`;
  const grip = page.getByRole("separator", { name: "Drag to make this panel wider" });
  const width = async () => {
    const box = await page.locator("[data-atlas-panel]").boundingBox();
    if (!box) throw new Error("no panel");
    return box.width;
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(entry);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  await expect(grip).toBeVisible();
  // the same tooltip the lesson's line has, and a line to see rather than an
  // invisible strip
  await expect(grip).toHaveAttribute("title", "Drag to resize");
  const line = grip.locator("span");
  const drawn = await line.boundingBox();
  expect(drawn && drawn.width).toBeGreaterThan(0);
  expect(drawn && drawn.height).toBeGreaterThan(0);
  // it lies down the panel's edge, so it is taller than it is wide
  expect(drawn && drawn.height).toBeGreaterThan(drawn!.width);
  const was = await width();
  expect(Math.round(was)).toBe(360);

  // dragging it left makes the panel 160px wider
  const box = await grip.boundingBox();
  if (!box) throw new Error("no grip");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  const dragged = await width();
  expect(Math.abs(dragged - (was + 160))).toBeLessThanOrEqual(1);

  // and the width is this browser's, so the panel opens at it again
  await page.reload();
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  await expect(grip).toBeVisible();
  expect(Math.abs((await width()) - dragged)).toBeLessThanOrEqual(1);

  // the arrow keys move it too, for anyone who cannot drag a line
  await grip.focus();
  await page.keyboard.press("ArrowLeft");
  expect(Math.abs((await width()) - (dragged + 32))).toBeLessThanOrEqual(1);
  await page.keyboard.press("ArrowRight");
  expect(Math.abs((await width()) - dragged)).toBeLessThanOrEqual(1);
});

test("a word's page says what kind of word it is, and the chip opens the page that explains it", async ({ page }) => {
  // SAK-428. 知れる listed every form it takes and never said it was a る-verb.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("word:知れる")}`);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  const kind = page.getByRole("button", { name: "る-verb", exact: true });
  await expect(kind).toBeVisible();
  await kind.click();
  // the group's own page, which traveled with the word
  await expect(page.getByText("Godan/ichidan")).toBeVisible();
});

test("the Particle page lists the particles, and a row opens that particle's page", async ({ page }) => {
  // SAK-466. The Particle term was two sentences about what a particle is,
  // next to a shelf that teaches seventeen of them one page at a time.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("term:particle")}`);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The particles Saku teaches" })).toBeVisible();
  // every row is the particle, what it does, and a sentence
  await expect(page.getByText("marks the direct object")).toBeVisible();
  const wa = page.getByRole("button", { name: "は", exact: true }).first();
  await expect(wa).toBeVisible();
  await wa.click();
  // は's own page, which traveled with the term (its "pattern: meaning"
  // heading is gone since SAK-464, so the build table's own line stands for it)
  await expect(page.getByText("Take a noun, just as it is, and add は.")).toBeVisible();
  // and it points back
  await expect(page.getByRole("button", { name: /Open Read about it/ })).toBeVisible();
});

test("a page shows its own heading while its body is still coming", async ({ page }) => {
  // SAK-356. Signed out, every page drew the loading line alone on an empty
  // wash, so when the data landed the eyebrow, title and panels all appeared
  // at once and the page jumped.
  await page.route("**/observatory", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/observatory");
  // the heading is there before the body is
  await expect(page.getByRole("heading", { name: "What would you like to learn next?" })).toBeVisible();
  await expect(page.getByText("Reading your sky…")).toBeVisible();
});

test("a lone button fills its row instead of leaving a hole beside it", async ({ page }) => {
  // SAK-360. The footer was a two-column grid, so an entry offering only
  // "I don't know this" put it in the left cell with an empty cell beside it.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:\u65e5")}`);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  const measured = await page.evaluate(() => {
    const footer = document.querySelector("section")?.lastElementChild as HTMLElement | null;
    if (!footer || footer.children.length !== 1) return null;
    return { button: Math.round((footer.firstElementChild as HTMLElement).getBoundingClientRect().width), row: footer.clientWidth };
  });
  expect(measured, "expected an entry panel with one action").not.toBeNull();
  // it takes the row, rather than half of it
  expect(measured!.button).toBeGreaterThan(measured!.row * 0.9);
});

test("a short panel stops at its content instead of pinning its buttons to the page's foot", async ({ page }) => {
  // SAK-359. The Observatory's "Tonight" panel was told to fill its column,
  // so with nothing picked its empty line sat at the top and the disabled
  // Start lesson at the very bottom of the page.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/observatory?sample");
  const empty = page.getByText("Nothing picked. Choose something to learn and it shows up here.");
  await expect(empty).toBeVisible();
  const line = await empty.boundingBox();
  const start = await page.getByText("Start lesson", { exact: true }).boundingBox();
  // the button follows the line it belongs to, rather than a screen below it.
  // Measured from the line's TOP: the empty line used to be the thing that
  // stretched, so its own box reached all the way down to the button.
  const gap = (start?.y ?? 0) - (line?.y ?? 0);
  expect(gap, `the panel left ${Math.round(gap)}px between the line and the button`).toBeLessThan(80);
});

test("about caps its prose and says when it changes the subject", async ({ page }) => {
  // SAK-361. The acknowledgment ran the panel's whole width, eleven lines at
  // about 200 characters, and the reading list was spliced on with no heading.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Where does the data come from?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Other places to learn" })).toBeVisible();
  const measure = () => page.evaluate(() => {
    const p = document.querySelector("main section p") as HTMLElement;
    const panels = [...document.querySelectorAll("main section")].map((el) => Math.round(el.getBoundingClientRect().left));
    return { line: Math.round(p.getBoundingClientRect().width), panel: Math.round((p.closest("section") as HTMLElement).clientWidth), columns: new Set(panels).size };
  });
  // On a wide window the sections flow in two columns (SAK-450): the line is
  // short because its panel is, and the words fill the panel they are in
  // rather than stopping half way across it.
  const wide = await measure();
  expect(wide.columns).toBe(2);
  expect(wide.line).toBeLessThan(720);
  expect(wide.panel - wide.line).toBeLessThan(80);
  // Below that width it is one column, and the 68 character cap is what keeps
  // the line short, well inside its panel.
  await page.setViewportSize({ width: 900, height: 900 });
  const narrow = await measure();
  expect(narrow.columns).toBe(1);
  expect(narrow.line).toBeLessThan(600);
  expect(narrow.panel).toBeGreaterThan(narrow.line + 200);
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
  // The results screen paints in the click that ends the quiz, before the
  // record it is describing has been written anywhere: the answers still have
  // to go through a server action to become a session record. So the record
  // reaching the browser's copy is a separate event, and this waits for it
  // rather than assuming the paint implies it (SAK-406: under a loaded suite
  // it did not, and the assertion below failed on a store that was still
  // empty). Waiting on the store itself, not on a longer timeout.
  await expect
    .poll(() => page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("saku-local-history");
        return raw ? (JSON.parse(raw).sessions?.length ?? 0) : 0;
      } catch {
        return 0;
      }
    }))
    .toBeGreaterThan(0);
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByText(/Quiz · 1 card/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/1 of [\d,]+ Discovered/)).toBeVisible();
});

test("a visitor's practice run is recorded, and lands under sessions as practice", async ({ page }) => {
  // SAK-441, which reverses SAK-318. Practice used to keep its answers in the
  // browser as miss counts and nothing else; a run now goes through the same
  // recorder a quiz uses, so it moves the schedule, moves a standing, and gets
  // a row of its own. Signed out, so the writes land in this browser's copy
  // and nowhere near an account.
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "What would you like to practice?" })).toBeVisible();
  await page.getByRole("button", { name: "Kana", exact: true }).click();

  // named, so the row can say what the learner called the deck
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await page.getByPlaceholder("A name for this recipe").fill("Evening drill");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved as Evening drill" })).toBeVisible();

  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page).toHaveURL(/\/practice\/run/);
  await page.getByRole("button", { name: "I don't know" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();

  // the record is a separate event from the paint (SAK-406), so wait on the
  // store itself rather than on the heading
  await expect
    .poll(() => page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("saku-local-history");
        return raw ? (JSON.parse(raw).sessions?.length ?? 0) : 0;
      } catch {
        return 0;
      }
    }))
    .toBeGreaterThan(0);

  await page.goto("/sessions");
  await expect(page.getByText(/Practice: Evening drill · 1 card/).first()).toBeVisible();
  // and a practice run runs again like any quiz
  await expect(page.getByRole("button", { name: "Run it again" })).toBeVisible();

  // the schedule moved: the card answered in practice is discovered now
  await page.goto("/");
  await expect(page.getByText(/1 of [\d,]+ Discovered/)).toBeVisible();
});

test("a saved recipe stays saved when the same chips are clicked in another order", async ({ page }) => {
  // SAK-372. Recipes were compared by JSON.stringify, and the recipe is built
  // by appending, so turning a collection off and back on put it at the end of
  // the list: the same deck, a different string, and "Saved as X" flipped to
  // "Update X" with nothing on the page changed.
  await page.goto("/practice?sample");
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  await page.getByRole("button", { name: "Words", exact: true }).click();
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await page.getByPlaceholder("A name for this recipe").fill("Kana and words");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved as Kana and words" })).toBeVisible();

  // off and on again: the same two collections, in the other order
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  await expect(page.getByRole("button", { name: "Update Kana and words" })).toBeVisible();
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved as Kana and words" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update Kana and words" })).toHaveCount(0);

  // and the chip says what it draws from, so "Everything" is not a mystery
  await expect(page.getByRole("button", { name: "Kana and words", exact: true })).toHaveAttribute("title", /^Kana and Words, /);
});

test("the reveal says why each of the others was on the board", async ({ page }) => {
  // SAK-315. The board is already the confusable set, but nothing named the
  // confusion, so the escape hatch confirmed the answer and taught nothing.
  // 一 in 統一 is いつ; the other two choices are 一's own readings, which is
  // the mistake the card is actually about.
  const card = encodeURIComponent("kanji:一/reading@統一");
  await page.goto(`/quiz?sample&cards=${card}`);
  await expect(page.getByRole("button", { name: "Multiple choice" })).toBeVisible();

  // nothing is named until the board has been in front of you
  await page.getByRole("button", { name: "Multiple choice" }).click();
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByText("Why the others were there")).toBeVisible();
  await expect(page.getByText("another reading of the same character").first()).toBeVisible();

  // and a card answered without ever asking for the board names nothing:
  // choices you never saw are noise
  await page.goto(`/quiz?sample&cards=${card}`);
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
  await expect(page.getByText("Why the others were there")).toHaveCount(0);
});

test("the reveal explains which reading applies, and why", async ({ page }) => {
  // SAK-316. The quiz is mostly not asking what a thing means, it is asking
  // which reading applies: 水 is みず alone and すい in 水曜. The reveal used to
  // confirm the answer and show the lesson card; it explains the rule now.
  await page.goto(`/quiz?sample&cards=${encodeURIComponent("kanji:水/reading@水曜")}`);
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByText("On'yomi: the borrowed reading")).toBeVisible();
  await expect(page.getByText(/すい is an on'yomi/)).toBeVisible();
  await expect(page.getByText(/Same character, and the word it is in decides\./)).toBeVisible();
  // and the breakdown, so the reading that applies is read against the one
  // that did not: すい marked on'yomi, みず beside it as the kun'yomi
  await expect(page.getByText("on'yomi", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "みず" }).filter({ hasText: "kun'yomi" })).toHaveCount(1);

  // a card that exercises no rule the app can name says nothing rather than
  // inventing one
  await page.goto(`/quiz?sample&cards=${encodeURIComponent("kanji:一/meaning")}`);
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
  await expect(page.getByText(/is an on'yomi, a pronunciation borrowed/)).toHaveCount(0);
  await expect(page.getByText(/Same character, and the word it is in decides/)).toHaveCount(0);
});

test("a card answered after a retry still shows what was said before it was right", async ({ page }) => {
  // SAK-425. Every attempt has been on the answer since SAK-387 and in the
  // saved run since SAK-404, but the reveal only listed them on a MISSED card.
  // A card that got there in the end showed the right answer and nothing else,
  // so walking back to it with the arrow lost what the learner had said, which
  // is the part of that card worth looking at.
  // Two named cards, so the deck is exactly these two and neither is ever
  // asked by ear: a named deck carries no audio option, and a listening card
  // would hide the glyph this test reads. Signed out, so the run is written to
  // the browser and the reload below picks it up.
  await page.goto(`/quiz?cards=${encodeURIComponent("kana:あ/reading,kana:い/reading")}`);
  const count = page.getByText(/^\d+ of \d+$/);
  await expect(count).toHaveText("1 of 2");

  // the deck is dealt (SAK-388), so which vowel is in front of you is read off
  // the card rather than assumed
  const glyph = (await page.locator("p.font-sky-display").first().innerText()).trim();
  const box = page.getByPlaceholder("In romaji, or how it sounds");
  await box.fill("zzz");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/^Not that\./)).toBeVisible();
  await box.fill(glyph === "あ" ? "a" : "i");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(count).toHaveText("2 of 2");

  // back a card: the verdict, what was said before the answer, and the answer
  const backACard = page.getByRole("button", { name: "Back a card" });
  await backACard.click();
  await expect(count).toHaveText("1 of 2");
  // the deck list down the right says it too, so the card's own is the first
  await expect(page.getByText("With help", { exact: true }).first()).toBeVisible();
  const before = page.getByText("You said zzz before this.");
  await expect(before).toBeVisible();
  // and it is marked as wrong, not just listed
  await expect(page.getByText("zzz", { exact: true })).toHaveCSS("text-decoration-line", "line-through");

  // and it survives the tab being closed, because it is on the run and not on
  // the open card
  await page.reload();
  await expect(count).toHaveText("2 of 2");
  await backACard.click();
  await expect(before).toBeVisible();
});

test("the Family chip on a grammar card opens the family", async ({ page }) => {
  // SAK-425. The reveal draws the lesson card under a card that is answered,
  // and that card pages: 〜てから is taught over its own page and its family's,
  // "after", which it shares with たあとで. The Quiz passed no page and no way
  // to change one, so the pager drew a row of chips that were buttons and did
  // nothing. The card turns its own pages when nobody outside owns them.
  await page.goto(`/quiz?sample&cards=${encodeURIComponent("grammar:te-kara/meaning")}`);
  await page.getByRole("button", { name: "I don't know" }).click();
  const family = page.getByRole("button", { name: "Family", exact: true });
  await expect(family).toBeVisible();
  await expect(page.getByText("Ways to say this")).toHaveCount(0);

  await family.click();
  await expect(page.getByText("Ways to say this")).toBeVisible();
  // the family is the sibling patterns, and how each is built
  await expect(page.getByRole("cell", { name: "〜たあとで", exact: true })).toBeVisible();

  // and the chip that opened it says so, so the row reads as a pager
  await expect(family).toHaveAttribute("aria-current", "page");
});

test("a visitor's finished quiz says it is saving, and opens the way back once it is saved", async ({ page }) => {
  // SAK-410, the half SAK-406 left open. The results paint in the click that
  // ends the quiz, but signed out the record does not exist yet: the answers
  // have to go through a server action before anything reaches the browser's
  // own store. That window said nothing at all, and a visitor who walked out
  // of it lost the run. Now the screen says where it is, and the one control
  // that leaves the page is not a link until the record has landed.
  await page.goto("/quiz?picks=kana-row:h-vowels");
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  await page.getByRole("button", { name: "I don't know" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();

  // it reads as one of the two the moment the screen is up, and it settles
  await expect(page.getByText(/^(Saving this run\.|Saved\.)$/)).toBeVisible();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  // and by then the record really is in the browser, so leaving keeps it
  const kept = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("saku-local-history");
      return raw ? (JSON.parse(raw).sessions?.length ?? 0) : 0;
    } catch {
      return 0;
    }
  });
  expect(kept).toBeGreaterThan(0);

  // the way back is a link again, and walks
  const backOut = page.getByRole("link", { name: "Back to the observatory" });
  await expect(backOut).toBeVisible();
  await backOut.click();
  await expect(page.getByRole("heading", { name: "What would you like to learn next?" })).toBeVisible();
});

/** Open a lesson and go straight to its first star.
 *
 * A lesson opened fresh shows the reference pages nobody has read before the
 * order starts (SAK-467), so a test about the stars would otherwise begin on a
 * term page. Clicking the top row of "Tonight, in order" is what a learner who
 * wants to get on with it does, and it lands on step one whether or not there
 * were pages to read. */
async function lessonOnStepOne(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByText(/^Step \d+ of \d+$/)).toBeVisible();
  await page.getByRole("list").first().getByRole("button").first().click();
}

/** Miss `n` cards on whatever quiz is open, moving on after each. */
async function missCards(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.getByRole("button", { name: "I don't know" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
}

/** A quiz of its very own, unfinished: three cards recorded and then run
 * again, which is a quiz of named cards and one round.
 *
 * A drill of PICKS is not one of these. It runs the lesson's three rounds
 * with a break between them, so since SAK-444 it is one part of a lesson's
 * sitting and rides the lesson's slot, which is exactly what lets a learner
 * come back to a round or a break. */
async function unfinishedQuiz(page: Page): Promise<string> {
  await page.goto("/quiz?picks=kana-row:h-vowels");
  await missCards(page, 4);
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.goto("/sessions");
  await page.getByRole("button", { name: "Run it again" }).click();
  // however many of the four the session kept: a kana asked both ways is one
  // item, so the rerun's deck is its own size and the test reads it rather
  // than assuming one
  const count = page.getByText(/^\d+ of \d+$/);
  await expect(count).toHaveText(/^1 of [2-9]$/);
  const total = (await count.innerText()).split(" of ")[1];
  await missCards(page, 1);
  await expect(count).toHaveText(`2 of ${total}`);
  return `Quiz · 1 of ${total}`;
}

test("a visitor's drill is where they left it after a reload", async ({ page }) => {
  // SAK-404. The run is written down after every answer, and the same page
  // opened again picks it up: the deck it dealt, in the order it dealt it,
  // and the card that was next. Since SAK-444 a drill of a lesson's picks is
  // kept as that lesson's sitting, so the offer says which round and which
  // card rather than a bare count.
  await page.goto("/quiz?picks=kana-row:h-vowels");
  const count = page.getByText(/^\d+ of \d+$/);
  await expect(count).toHaveText("1 of 10");

  // two cards answered, so the third is the one waiting
  await missCards(page, 2);
  await expect(count).toHaveText("3 of 10");
  // and the run really is in the browser by then, not only on the screen.
  // Under the same key, in the round the lesson slot is holding.
  await expect
    .poll(() => page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("sky:quiz:run");
        return raw ? (JSON.parse(raw).lesson?.part?.run?.answers?.length ?? 0) : 0;
      } catch {
        return 0;
      }
    }))
    .toBe(2);

  await page.reload();
  // the third card, open, with the two answers still counted against the deck
  await expect(count).toHaveText("3 of 10");
  await expect(page.getByRole("button", { name: "I don't know" })).toBeVisible();

  // the two places a learner lands offer it back, and the offer walks
  // (one button since SAK-444, saying what it goes back to and how far in)
  await page.goto("/");
  const offer = page.getByRole("link", { name: "Continue your lesson (round 1, card 3 of 10)" });
  await expect(offer).toBeVisible();
  await page.goto("/observatory");
  await expect(page.getByRole("link", { name: "Continue your lesson (round 1, card 3 of 10)" })).toBeVisible();
  await offer.click();
  await expect(count).toHaveText("3 of 10");

  // and ending the round does not end the sitting: what is left is the break
  // before round two, and the offer follows it there
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Continue your lesson \(break before round 2 of 3, \d+ min left\)$/ })).toBeVisible();
});

test("a lesson is one sitting, offered back wherever it was left (SAK-444)", async ({ page }) => {
  // Sam, 2026-09-17: "when a lesson is started and stopped mid session, the
  // user's observatory should let you continue that lesson regardless of
  // where the user was, mid lesson, mid quiz, mid break." Three checkpoints
  // of one sitting, each left by walking away to the Observatory.
  const offer = page.getByRole("link", { name: /^Continue your lesson/ });
  const step = page.getByText(/^Step \d+ of \d+$/);
  const count = page.getByText(/^\d+ of \d+$/);

  // MID LESSON, on the very first step: opened and left, which used to be
  // kept nowhere at all, so the Observatory offered nothing.
  await page.goto("/lesson?picks=kana-row:h-w");
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  await page.goto("/observatory");
  await expect(offer).toHaveText(/^Continue your lesson \(step 1 of \d+\)$/);
  await offer.click();
  await expect(page.getByRole("heading", { name: "Tonight's lesson" })).toBeVisible();
  await expect(step).toHaveText(/^Step 1 of \d+$/);

  // MID QUIZ: walked to the end of the order and two cards into the drill.
  // Pressing Drill used to throw the lesson away on the spot.
  const drill = page.getByRole("link", { name: "Drill" });
  for (let i = 0; i < 40 && !(await drill.count()); i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  // The step just walked marks its star seen through a server action, and the
  // lesson redraws when that lands, which can swap the link out from under a
  // click. So the click is retried until the drill is really open.
  await expect(async () => {
    await drill.click();
    await expect(page).toHaveURL(/\/quiz\?/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(count).toHaveText(/^1 of \d+$/);
  const cards = (await count.innerText()).split(" of ")[1];
  await missCards(page, 2);
  await expect(count).toHaveText(`3 of ${cards}`);
  await page.goto("/observatory");
  await expect(offer).toHaveText(`Continue your lesson (round 1, card 3 of ${cards})`);
  await offer.click();
  await expect(count).toHaveText(`3 of ${cards}`);

  // MID BREAK: round one ended, resting before round two. A break was not
  // something the button knew about at all.
  await page.getByRole("button", { name: "End the quiz" }).click();
  await page.getByRole("button", { name: "Take a rest, then round 2 of 3" }).click();
  await expect(page.getByRole("heading", { name: "A break between rounds" })).toBeVisible();
  await page.goto("/observatory");
  await expect(offer).toHaveText(/^Continue your lesson \(break before round 2 of 3, \d+ min left\)$/);
  await offer.click();
  await expect(page.getByRole("heading", { name: "A break between rounds" })).toBeVisible();
  // the clock is where it really is, not started over
  await expect(page.getByText(/Come back at/)).toBeVisible();
});

test("a lesson's sitting ends with its last round (SAK-444)", async ({ page }) => {
  // The one thing that does end it, now that the drill does not: all three
  // rounds over. Each round is ended early, which is the same ending.
  await page.goto("/quiz?from=observatory&picks=kana-row:h-vowels");
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole("button", { name: "End the quiz" }).click();
    await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
    if (round === 3) break;
    await page.getByRole("button", { name: `Take a rest, then round ${round + 1} of 3` }).click();
    await page.getByRole("button", { name: "Start now" }).click();
    await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  }
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("sky:quiz:run")))
    .toBe(null);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Continue your/ })).toHaveCount(0);
});

test("an unfinished quiz does not get in the way of a lesson (SAK-444)", async ({ page }) => {
  // Sam's own sequence: a quiz left part way through, then a lesson started,
  // walked into and left. The one Continue button used to know only the quiz,
  // and the lesson's own place was kept nowhere, so there was no way back into
  // the lesson at all.
  const quizRow = await unfinishedQuiz(page);

  // a lesson, walked two steps in and left. Straight to the first star,
  // because this is about the place a lesson keeps and not about the pages it
  // opens on (SAK-467).
  await lessonOnStepOne(page, "/lesson?picks=kana-row:h-w");
  const step = page.getByText(/^Step \d+ of \d+$/);
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).toHaveText(/^Step 3 of \d+$/);

  // the home offers the LESSON, because it is the newer of the two, and
  // walking back in opens the lesson rather than the quiz
  await page.goto("/");
  const back = page.getByRole("link", { name: /^Continue your lesson \(step 3 of \d+\)$/ });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByRole("heading", { name: "Tonight's lesson" })).toBeVisible();
  // it opens on the step that was left, and is walkable from there (the
  // order no longer shrinks as stars are opened, SAK-446)
  await expect(step).toHaveText(/^Step 3 of \d+$/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).toHaveText(/^Step 4 of \d+$/);

  // the quiz is not lost: it waits in Sessions, and continues from there
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Unfinished" })).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: quizRow });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/^\d+ of \d+$/)).toHaveText(/^2 of \d+$/);
});

test("forgetting an unfinished quiz from Sessions asks first (SAK-444)", async ({ page }) => {
  const quizRow = await unfinishedQuiz(page);
  await page.goto("/sessions");
  const row = page.getByRole("listitem").filter({ hasText: quizRow });
  // the row says plainly that this one is still running (Sam, 2026-09-17)
  await expect(row.getByText("In progress")).toBeVisible();
  await row.getByRole("button", { name: "Forget", exact: true }).click();
  // the ask is the app's own delete, the verb saying the whole thing, and the
  // row still says the quiz is running while it is open
  await expect(row.getByRole("button", { name: "Forget it forever" })).toBeVisible();
  await expect(row.getByText("In progress")).toBeVisible();
  // backing out leaves the quiz where it was
  await row.getByRole("button", { name: "Keep it" }).click();
  await expect(row.getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  // and going through with it takes the row away
  await row.getByRole("button", { name: "Forget", exact: true }).click();
  await row.getByRole("button", { name: "Forget it forever" }).click();
  await expect(page.getByText(quizRow)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Continue your quiz/ })).toHaveCount(0);
});

// ONE WAY TO OPEN AND CLOSE THINGS (SAK-412). Every fold in the Sky is now the
// same round chevron button, one ⌃ turned over when shut (SAK-414), wired to
// what it opens. None
// of these folds had a test before, so each gets one: open it, see the content,
// close it, see it gone.
//
// And the WHOLE TITLE ROW opens it (SAK-432), not just the ring at its end, so
// each of these clicks the far left of the row rather than the chevron.

test("the home's details fold opens and closes anywhere along its bar", async ({ page }) => {
  await page.goto("/?sample");
  const fold = page.getByRole("button", { name: "Show the details" });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#sky-home-details")).toHaveCount(0);

  // the left end of the bar, a long way from the chevron: the bar IS the button
  await fold.click({ position: { x: 6, y: 6 } });
  await expect(page.locator("#sky-home-details")).toBeVisible();

  await page.getByRole("button", { name: "Hide the details" }).click({ position: { x: 6, y: 6 } });
  await expect(page.locator("#sky-home-details")).toHaveCount(0);
});

test("a lesson card's sections fold and unfold on their title rows", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  const open = page.getByRole("button", { name: "Open Readings" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  // what the button says it controls is the panel, and it is not there yet
  const panel = page.locator(`[id="${await open.getAttribute("aria-controls")}"]`);
  await expect(panel).toHaveCount(0);

  // on the word "Readings" itself, which is the left end of the row
  await open.click({ position: { x: 6, y: 6 } });
  await expect(panel).toBeVisible();
  await expect(panel).not.toBeEmpty();

  await page.getByRole("button", { name: "Close Readings" }).click({ position: { x: 6, y: 6 } });
  await expect(panel).toHaveCount(0);
});

test("a reading with no word behind it says so instead of showing a blank cell", async ({ page }) => {
  // SAK-295. 面 is おもて in the dictionary and in no word this app teaches, so
  // the third column of that row has nothing to hold. Six rows in the whole
  // set are like this; the rest name the words the reading is read in.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:面")}`);
  await page.getByRole("button", { name: "Open Readings" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "おもて" });
  // SAK-443: it says whose limit it is. "no word taught yet" read as a gap in
  // the learner's own progress, and the learner has nothing to do with it.
  await expect(row.getByText("No word in Saku uses this reading.")).toBeVisible();
  await expect(page.getByText("no word taught yet")).toHaveCount(0);
  // and the reading beside it keeps its words and its ink
  await expect(page.getByRole("listitem").filter({ hasText: "No word in Saku uses this reading." })).toHaveCount(1);
});

test("a word's example sentence underlines the word itself", async ({ page }) => {
  // SAK-443. 仕事's sentence, 今から仕事ですよ。, printed plain: the fold said
  // "In a sentence" and then left the learner to find the word in it. The span
  // is in the data and the payload used to drop it.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("word:仕事")}`);
  await page.getByRole("button", { name: "Open In a sentence" }).click();

  // the text without the furigana over it (SAK-481), which is what a reader sees
  const bare = (el: Element) => {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll("rt").forEach((rt) => rt.remove());
    return copy.textContent;
  };
  const underlined = page.locator("span.underline").filter({ hasText: "仕" });
  await expect(underlined).toHaveCount(1);
  expect(await underlined.evaluate(bare)).toBe("仕事");
  // the whole sentence is still there around it
  expect(await underlined.locator("xpath=ancestor::p[1]").evaluate(bare)).toBe("今から仕事ですよ。");

  // drawn in the accent, the color Sam keeps for the word being pointed at,
  // and really underlined rather than only carrying the class
  const drawn = await underlined.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--sky-accent)";
    el.parentElement!.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(el);
    return { color: style.color, accent, line: style.textDecorationLine };
  });
  expect(drawn.color).toBe(drawn.accent);
  expect(drawn.line).toContain("underline");
});

test("a word's example sentence has the furigana over its kanji", async ({ page }) => {
  // SAK-481. The readings were stored with the sentence and the payload
  // dropped them, so 今から仕事ですよ。 printed with its kanji bare.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("word:仕事")}`);
  // open the fold if it is folded, once the card has drawn it
  const fold = page.getByRole("button", { name: /^(Open|Close) In a sentence$/ });
  await expect(fold).toBeVisible();
  if ((await fold.getAttribute("aria-expanded")) !== "true") await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  const controls = await fold.getAttribute("aria-controls");
  const sentence = page.locator(`[id="${controls}"] p`).first();
  await expect(sentence.locator("ruby")).toHaveCount(3);
  await expect(sentence.locator("ruby rt")).toHaveText(["いま", "し", "ごと"]);
  // the reading sits over its kanji, not beside it
  const box = await sentence.locator("ruby").nth(1).evaluate((el) => {
    const rt = el.querySelector("rt")!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el.firstChild!);
    const base = range.getBoundingClientRect();
    return { above: base.top - rt.bottom, off: Math.abs((rt.left + rt.right) / 2 - (base.left + base.right) / 2) };
  });
  expect(box.above).toBeGreaterThanOrEqual(-2);
  expect(box.off).toBeLessThan(4);
});

test("the why behind writing early folds open under the card that raises it", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  await page.getByRole("button", { name: "Open How it's written" }).click();
  const why = page.getByRole("button", { name: "Show the reason why" }).first();
  await expect(why).toHaveAttribute("aria-expanded", "false");

  // on the word "Why?" rather than the chevron beside it (SAK-432)
  await why.click({ position: { x: 6, y: 6 } });
  await expect(page.getByRole("button", { name: "Hide the reason why" }).first()).toBeVisible();
  await expect(page.getByText("People don’t do much handwriting").first()).toBeVisible();

  await page.getByRole("button", { name: "Hide the reason why" }).first().click();
  await expect(page.getByText("People don’t do much handwriting")).toHaveCount(0);
});

test("the stroke section's two whys each open on their own answer", async ({ page }) => {
  // SAK-414. Both folds opened on the same stroke-order paragraph, so the
  // section made one case twice, in the same words, under two questions. "Why
  // not learn to write yet" and "why does the order matter" are two questions,
  // and the rationale answers the second.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  await page.getByRole("button", { name: "Open How it's written" }).click();
  const rationale = page.getByText("Every character has a correct order");
  const notYet = page.getByText("People don’t do much handwriting");

  // both whys are there once the strokes have loaded, and both are shut
  const shut = page.getByRole("button", { name: "Show the reason why" });
  await expect(shut).toHaveCount(2);

  // the "not yet" above the chart answers only itself
  await shut.first().click();
  await expect(notYet).toHaveCount(1);
  await expect(rationale).toHaveCount(0);

  // and the order's own why, under the chart, carries the rationale
  await page.getByRole("button", { name: "Show the reason why" }).first().click();
  await expect(rationale).toHaveCount(1);
  await expect(notYet).toHaveCount(1);
});

test("the stroke chart shows all its frames and folds them back", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:曜")}`);
  await page.getByRole("button", { name: "Open How it's written" }).click();
  const all = page.getByRole("button", { name: /Show all \d+ strokes/ });
  await expect(all).toBeVisible();
  await expect(all).toHaveAttribute("aria-expanded", "false");

  // on the words that carry the count, at the left end of the row (SAK-432)
  await all.click({ position: { x: 6, y: 6 } });
  const back = page.getByRole("button", { name: /Fold the \d+ strokes back/ });
  await expect(back).toBeVisible();

  await back.click();
  await expect(page.getByRole("button", { name: /Show all \d+ strokes/ })).toBeVisible();
});

test("on a phone the pages fold behind the same round button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample");
  const menu = page.getByRole("button", { name: "Show the pages" });
  await expect(menu).toHaveAttribute("aria-controls", "sky-menu");
  await expect(page.locator("#sky-menu")).toHaveCount(0);

  await menu.click();
  await expect(page.locator("#sky-menu")).toBeVisible();
  await expect(page.locator("#sky-menu").getByRole("link", { name: "Observatory" })).toBeVisible();

  await page.getByRole("button", { name: "Hide the pages" }).click();
  await expect(page.locator("#sky-menu")).toHaveCount(0);
});

test("the built-from filter picks several parts at once and keeps the kanji carrying any of them", async ({ page }) => {
  // SAK-413, corrected by SAK-414. The filter was fifty-odd chips in four rows;
  // it is one control now, and it takes more than one part. The picks are an
  // OR: two parts you can see in one character are almost never both in the
  // app's list for it, so an AND emptied the shelf on the second pick.
  await page.goto("/atlas?sample");
  await page.getByRole("button", { name: /^Kanji/ }).first().click();
  const shown = page.getByText(/^[\d,]+ Shown/);
  await expect(shown).toBeVisible();
  const count = async () => Number((await shown.innerText()).replace(/\D/g, ""));
  const all = await count();

  const control = page.getByRole("button", { name: "Choose the parts a kanji is built from" });
  await expect(control).toHaveText(/Any/);
  await control.click();
  const list = page.getByRole("listbox", { name: "Choose the parts a kanji is built from" });
  await expect(list).toHaveAttribute("aria-multiselectable", "true");

  // the keyboard alone reaches the list and toggles a row on it
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press(" ");
  const picked = list.getByRole("option", { selected: true });
  await expect(picked).toHaveCount(1);
  const first = (await picked.innerText()).trim();
  const afterOne = await count();
  expect(afterOne).toBeLessThan(all);

  // a second part ADDS its kanji rather than emptying the shelf, and the count
  // line says so: "built from X or Y", not "and"
  const second = list.getByRole("option", { selected: false }).nth(3);
  const secondText = (await second.innerText()).trim();
  await second.click();
  await expect(list.getByRole("option", { selected: true })).toHaveCount(2);
  expect(await count()).toBeGreaterThan(afterOne);
  await expect(shown).toHaveText(new RegExp(`built from ${first} or ${secondText}`));
  await expect(control).toHaveText(new RegExp(`${first}[\\s\\S]*${secondText}|${secondText}[\\s\\S]*${first}`));

  // Escape closes it, and the picks survive
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(control).toHaveAttribute("aria-expanded", "false");

  // "Any" is the empty selection, and it puts every kanji back
  await control.click();
  await page.getByRole("option", { name: "Any" }).click();
  await expect(control).toHaveText(/Any/);
  expect(await count()).toBe(all);
});

test("a lesson card's readings line up in three columns", async ({ page }) => {
  // SAK-413. The reading came first, so か and にち pushed the hear button and
  // the word list to a different x on every row.
  // 日 is the lesson's one step: the terms it rests on are references now
  // and not steps to walk past (SAK-416), and a fresh lesson opens on the
  // first of them (SAK-467), so this goes straight to the star.
  await lessonOnStepOne(page, `/lesson?picks=${encodeURIComponent("kanji:日")}`);
  await page.getByRole("button", { name: "Open Readings" }).first().click();
  const panel = page.locator(`[id="${await page.getByRole("button", { name: "Close Readings" }).first().getAttribute("aria-controls")}"]`);
  await expect(panel).toBeVisible();

  const columns = await panel.evaluate((box) => {
    const at = (el: Element | null | undefined) => (el ? Math.round(el.getBoundingClientRect().x) : null);
    return [...box.querySelectorAll("li")].map((li) => {
      const spans = [...li.children].filter((c) => c.tagName === "SPAN");
      return { hear: at(li.querySelector("button")), reading: at(spans[0]), words: at(spans[1]) };
    });
  });
  expect(columns.length).toBeGreaterThan(2);
  // one x for the hear buttons, one for the readings, one for the word lists
  for (const key of ["hear", "reading", "words"] as const) {
    expect([...new Set(columns.map((c) => c[key]))], `the ${key} column`).toHaveLength(1);
  }
  // and they run in that order across a row
  const [row] = columns;
  expect(row.hear!).toBeLessThan(row.reading!);
  expect(row.reading!).toBeLessThan(row.words!);
});

test("a kanji card's Readings fold puts on'yomi under its own heading and gives each word its furigana", async ({ page }) => {
  // SAK-482. Every reading on 日 sat under kun'yomi, and the words beside
  // them had no readings over their kanji.
  await lessonOnStepOne(page, `/lesson?picks=${encodeURIComponent("kanji:日")}`);
  await page.getByRole("button", { name: "Open Readings" }).first().click();
  const panel = page.locator(`[id="${await page.getByRole("button", { name: "Close Readings" }).first().getAttribute("aria-controls")}"]`);
  await expect(panel).toBeVisible();

  // the headings and the readings in the order the fold shows them
  const order = await panel.evaluate((box) => {
    const grid = box.querySelector(".grid");
    return [...(grid?.children ?? [])].flatMap((el) => el.tagName === "UL"
      ? [...el.querySelectorAll("li")].map((li) => li.querySelectorAll(":scope > span")[0]?.textContent ?? "")
      : [el.textContent ?? ""]);
  });
  const at = (text: string) => order.findIndex((t) => t.startsWith(text));
  expect(at("On'yomi")).toBe(0);
  expect(at("にち")).toBeLessThan(at("Kun'yomi"));
  expect(at("じつ")).toBeLessThan(at("Kun'yomi"));
  expect(at("ひ")).toBeGreaterThan(at("Kun'yomi"));

  // 休日 with きゅう over 休 and じつ over 日
  const kyuujitsu = panel.locator("span.whitespace-nowrap").filter({ hasText: "休" });
  await expect(kyuujitsu.locator("rt")).toHaveText(["きゅう", "じつ"]);
});

test("every line on the sky is the same line, and none of them is dashed", async ({ page }) => {
  // SAK-338. A line used to take its dash and its fade from the standing of
  // the star it pointed AT, so the same edge read differently depending on
  // which way round it was drawn. Lines carry the shape now; the state is
  // on the star.
  await page.goto("/?sample");
  await page.waitForFunction(() => document.querySelectorAll("[data-lines] line").length > 0);
  const lines = await page.evaluate(() => {
    const all = [...document.querySelectorAll("[data-lines] line")];
    return {
      count: all.length,
      dashed: all.filter((l) => l.getAttribute("stroke-dasharray")).length,
      strokes: [...new Set(all.map((l) => l.getAttribute("stroke")))].sort(),
      widths: [...new Set(all.map((l) => l.getAttribute("stroke-width")))].sort(),
      opacities: [...new Set(all.map((l) => l.getAttribute("opacity")))].sort(),
    };
  });
  expect(lines.count).toBeGreaterThan(0);
  expect(lines.dashed, "no line on the sky is dashed").toBe(0);
  expect(lines.strokes).toEqual(["var(--sky-link)"]);
  expect(lines.widths).toEqual(["1.25"]);
  // structure, or fog into what has not been discovered. Nothing else.
  for (const o of lines.opacities) expect(["0.8"], `line opacity ${o}`).toContain(o);
});

test("the legend's key draws the real stars, tonight among them", async ({ page }) => {
  // SAK-338. The key used to be flat colored dots beside the words, which
  // said nothing about the glows and marks the sky actually draws.
  await page.goto("/?sample");
  // the mark opens on hover; a click would toggle it shut again
  await page.getByRole("button", { name: "What the standings mean" }).hover();
  const key = page.locator("dl").filter({ hasText: "at least 8 of the last 10" }).first();
  await expect(key).toBeVisible();
  // six standings and tonight, each one drawn rather than described
  await expect(key.locator("svg")).toHaveCount(7);
  await expect(key.getByText("Tonight", { exact: true })).toBeVisible();
  await expect(key.getByText("Undiscovered", { exact: true })).toBeVisible();
});

test("what showing more of the sky costs is behind a warning mark, not written out", async ({ page }) => {
  // SAK-439. It was a sentence under the legend, which is a lot of room for
  // something you read once. It is the info mark's behavior in a warning tone
  // now: hover it or focus it and the sentence is there.
  await page.goto("/?sample");
  const mark = page.getByRole("button", { name: "Why showing more is slower" });
  await expect(mark).toBeVisible();
  const note = page.getByText("Showing more at once makes the sky slower to draw.");
  await expect(note).toHaveCount(0);

  await mark.hover();
  await expect(note).toBeVisible();
  // off it again, and it is gone
  await page.mouse.move(0, 0);
  await expect(note).toHaveCount(0);

  // and the keyboard reaches it without a pointer anywhere near it
  await mark.focus();
  await expect(note).toBeVisible();
  await expect(mark).toHaveAttribute("aria-expanded", "true");
});

/** What the pan test hangs on the window while it watches one drag. */
interface PanWatch { changes: number; was: string | null; group: Element; watch: MutationObserver }

test("a pan moves the sky without rebuilding it", async ({ page }) => {
  // SAK-411. Panning used to set React state on every pointer move, which
  // told the field what the window was showing, which crossed a cull cell,
  // which rebuilt thousands of constellations while the finger was still
  // down: 5,988 elements added and 6,128 removed in one 300px drag on the
  // whole sky, and a worst frame of 442ms. A drag writes the transform and
  // nothing else now, and the view is committed once, on release. This
  // holds that: the group moves, the group is the same element it was, and
  // not one node is added to it or taken out of it while the drag runs.
  await page.goto("/?sample");
  const sky = page.getByLabel("Every constellation in the sky, scattered across it, lit as you learn them");
  await expect(sky).toBeVisible();
  await expect(sky.locator("circle[data-hit]").first()).toBeVisible();
  const box = await sky.boundingBox();
  if (!box) throw new Error("the sky has no box");

  await page.evaluate(() => {
    const group = document.querySelector("svg[aria-label] [data-view]");
    if (!group) throw new Error("the sky has no pan and zoom group");
    const state = {
      changes: 0,
      was: group.getAttribute("transform"),
      group,
      watch: new MutationObserver((records) => {
        for (const r of records) state.changes += r.addedNodes.length + r.removedNodes.length;
      }),
    };
    state.watch.observe(group, { childList: true, subtree: true });
    (window as unknown as { __pan: typeof state }).__pan = state;
  });

  // leftward: the world is anchored to the window's top left and the clamp
  // pins the pan at zero, so a drag to the right would move nothing at all
  const x = box.x + box.width / 2 + 150, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(x - i * 15, y);
  const during = await page.evaluate(() => {
    const pan = (window as unknown as { __pan: PanWatch }).__pan;
    pan.watch.disconnect();
    return {
      changes: pan.changes,
      moved: pan.group.getAttribute("transform") !== pan.was,
      same: document.querySelector("svg[aria-label] [data-view]") === pan.group,
    };
  });
  await page.mouse.up();

  expect(during.moved, "the drag moved the sky").toBe(true);
  expect(during.same, "the same group, not a new one").toBe(true);
  expect(during.changes, "nothing was added to the sky or taken out of it mid-drag").toBe(0);
});

test("sentence rules end on the sentence type they lead to, and it opens a lesson", async ({ page }) => {
  // SAK-430. The section was the grammar track in its own order: nine case
  // particles offered in one row, and not one of the ten sentence types ever
  // offered at all. It runs to the next type now and stops there.
  await page.goto("/observatory?sample");
  const cards = page.locator("section", { has: page.getByRole("heading", { name: "Sentences", exact: true }) }).getByRole("button");
  await expect(cards.last()).toContainText("sentence type");
  // the patterns that type needs come first, and nothing follows it. Each
  // says which it is, a particle or a pattern built on a verb form (SAK-464)
  await expect(cards.first()).toContainText(/particle|grammar pattern/);
  const type = cards.last();
  const name = ((await type.textContent()) ?? "").replace(/sentence type$/, "").trim();
  expect(name.length).toBeGreaterThan(0);

  // picking it takes it to the lesson, which teaches it
  await type.click();
  await expect(type).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Start lesson" }).click();
  await expect(page).toHaveURL(/\/lesson\?/);
  await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
  await expect(page.getByRole("list").first().getByText(name)).toBeVisible();
  await expect(page.getByText(/^Step \d+ of \d+$/)).toBeVisible();
  // and the type's own walk is what it teaches: the guide's intro and its steps
  await expect(page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Intro" })).toBeVisible();
});

test("a sentence type is off the page until what it needs is learned or picked (SAK-464)", async ({ page }) => {
  // Sam, 2026-09-17, on a dim "Simple" tile reading "Opens once you know は or
  // が": "let's not show things that aren't unlocked ... just let it open when
  // it opens."
  await page.goto("/observatory");
  await claimAllKana(page);
  // the whole row waits on 〜な now, the grammar track's first lesson, so it
  // is picked in Grammar before there is a Sentences row to read (SAK-468)
  const grammar = page.locator("section", { has: page.getByRole("heading", { name: "Grammar", exact: true }) });
  await grammar.getByRole("button", { name: "Start grammar" }).click();
  await grammar.locator("button[aria-pressed]").first().click();
  const row = page.locator("section", { has: page.getByRole("heading", { name: "Sentences", exact: true }) });
  await row.getByRole("button", { name: "Start sentences" }).click();
  const tile = (text: string) => row.getByRole("button").filter({ hasText: text });
  const wa = tile("marks the topic"), ga = tile("marks the subject"), simple = tile("Simple");

  // the row is the particles it leads with, and nothing that cannot be taken
  await expect(wa).toBeVisible();
  await expect(simple).toHaveCount(0);
  // and nothing anywhere on the page says a thing is shut
  const body = page.locator("body");
  await expect(body).not.toContainText("Opens once");
  await expect(body).not.toContainText(/\blocked\b/i);

  // one of the two is not enough; both bring it back
  await wa.click();
  await expect(simple).toHaveCount(0);
  await ga.click();
  await expect(simple).toHaveCount(1);
  await expect(simple).toContainText("sentence type");

  // and taking one of them out takes the type with it, pick and all
  await simple.click();
  await expect(page.getByText("4 Picks", { exact: true })).toBeVisible();
  await ga.click();
  await expect(simple).toHaveCount(0);
  await expect(page.getByText("2 Picks", { exact: true })).toBeVisible();
});

test("the Sentences row waits on 〜な, and opens with は first (SAK-468)", async ({ page }) => {
  // Sam, 2026-09-17, on 〜な leading the row: "if that's grammar but is
  // required, it's the first thing taught in grammar iirc. you can lock the
  // sentence track behind learning it in the grammar track." And on Simple
  // coming last: "why isn't simple sentences not after topic/subject? why
  // does it come after all these other particles".
  await page.goto("/observatory");
  await claimAllKana(page);
  const sentences = page.locator("section", { has: page.getByRole("heading", { name: "Sentences", exact: true }) });
  const grammar = page.locator("section", { has: page.getByRole("heading", { name: "Grammar", exact: true }) });
  // kana done and nothing else: there is no Sentences row at all, and the
  // page says nothing about what would open it
  await expect(grammar).toBeVisible();
  await expect(sentences).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Opens once");

  // 〜な is the first thing Grammar offers, and picking it opens the row
  await grammar.getByRole("button", { name: "Start grammar" }).click();
  const na = grammar.locator("button[aria-pressed]").first();
  await expect(na).toContainText("describe a noun");
  await na.click();
  await expect(sentences).toBeVisible();
  await sentences.getByRole("button", { name: "Start sentences" }).click();

  // the row leads with は, and the type it leads to is not drawn yet
  const tiles = sentences.locator("button[aria-pressed]");
  await expect(tiles.first()).toContainText("marks the topic");
  await expect(tiles.nth(1)).toContainText("marks the subject");
  await expect(tiles.nth(2)).toContainText("marks the direct object");

  // は and が bring Simple in as the third tile, before the particles its own
  // example sentences turn on
  await tiles.nth(0).click();
  await tiles.filter({ hasText: "marks the subject" }).click();
  await expect(tiles.nth(2)).toContainText("Simple");
  await expect(tiles.nth(2)).toContainText("sentence type");
  await expect(tiles.nth(3)).toContainText("marks the direct object");

  // and taking 〜な back out takes the row with it, picks and all
  await na.click();
  await expect(sentences).toHaveCount(0);
  await expect(page.getByText(/^\d+ Picks?$/)).toHaveCount(0);
});

test("the observatory takes every pick back out in one press", async ({ page }) => {
  // SAK-458. The only way to empty the picks was to take them out one at a
  // time, from the list or by clicking each card again.
  await page.goto("/observatory?sample");
  const cards = page.locator("section", { has: page.getByRole("heading", { name: "Sentences", exact: true }) }).getByRole("button");
  const unselect = page.getByRole("button", { name: "Unselect all" });
  // with nothing picked there is no button to press
  await expect(cards.first()).toBeVisible();
  await expect(unselect).toHaveCount(0);

  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect(page.getByText("2 Picks", { exact: true })).toBeVisible();
  await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(cards.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(unselect).toBeVisible();

  await unselect.click();
  // the count is gone, no card is marked as picked, and the panel is back to
  // its empty state with the Start lesson that cannot be pressed
  await expect(page.getByText(/^\d+ Picks?$/)).toHaveCount(0);
  // on Tonight and on This lesson both (SAK-477)
  await expect(page.getByText("Nothing yet")).toHaveCount(2);
  await expect(page.getByText("Nothing picked. Choose something to learn and it shows up here.")).toBeVisible();
  await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(cards.nth(1)).toHaveAttribute("aria-pressed", "false");
  await expect(unselect).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Start lesson" })).toHaveCount(0);
  await expect(page.getByText("Start lesson", { exact: true })).toBeVisible();
});

test("the lesson meter fills by how hard the picks are, with no count shown (SAK-477)", async ({ page }) => {
  // Sam, 2026-09-24: "learning simple sentences is not the simple ... its
  // difficulty is not worth the same as learning the definition of a word."
  // The panel said "7 of 12 Pieces", and a sentence type was one piece like
  // any word.
  await page.goto("/observatory?sample");
  const lesson = page.locator("section", { has: page.getByRole("heading", { name: "This lesson", exact: true }) });
  const fill = lesson.locator("[data-lesson-fill]");
  const width = () => fill.evaluate((el) => parseFloat((el as HTMLElement).style.width));
  await expect(lesson).toContainText("Nothing yet");
  await expect(lesson).toContainText("Pick anything to start.");
  expect(await width()).toBe(0);

  // one word: a little of the bar, and a word for it rather than a number
  const word = page.locator("section", { has: page.getByRole("heading", { name: "Words", exact: true }) }).locator("button[aria-pressed]").first();
  await word.click();
  await expect(word).toHaveAttribute("aria-pressed", "true");
  await expect(lesson).toContainText("Light");
  await expect(lesson).toContainText("Room for more.");
  const afterWord = await width();
  expect(afterWord).toBeGreaterThan(0);
  await expect(lesson).not.toContainText(/\d/);
  await word.click();
  await expect(lesson).toContainText("Nothing yet");
  await expect.poll(width).toBe(0);

  // one sentence type: one thing, like the word, and it fills more of the bar
  const type = page.locator("section", { has: page.getByRole("heading", { name: "Sentences", exact: true }) }).locator("button[aria-pressed]").last();
  await expect(type).toContainText("sentence type");
  await type.click();
  await expect(type).toHaveAttribute("aria-pressed", "true");
  await expect.poll(width).toBeGreaterThan(afterWord);
  // no digit anywhere in the panel, the meter's own name included, and none
  // on the pick's line in Tonight either
  await expect(lesson).not.toContainText(/\d/);
  await expect(lesson.getByRole("img")).toHaveAttribute("aria-label", /^\D+$/);
  const tonight = page.locator("section", { has: page.getByRole("heading", { name: "Tonight", exact: true }) });
  await expect(tonight.getByText("1 Pick", { exact: true })).toBeVisible();
  await expect(tonight.locator("li")).toHaveCount(1);
  await expect(tonight.locator("li")).not.toContainText(/\d/);
});

test("the atlas unselects everything in one press", async ({ page }) => {
  // SAK-458, the same press on the other page that picks things.
  await page.goto("/atlas?sample");
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  const tiles = page.locator("div[class*='gap-1.5'] > button[aria-pressed]");
  const picked = page.locator("div[class*='gap-1.5'] > button[aria-pressed='true']");
  await expect(tiles.first()).toBeVisible();
  await tiles.nth(0).click();
  await tiles.nth(1).click({ modifiers: ["Shift"] });
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await expect(picked).toHaveCount(2);

  const unselect = page.getByRole("button", { name: "Unselect all" });
  await unselect.click();
  await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);
  await expect(picked).toHaveCount(0);
  await expect(unselect).toHaveCount(0);
});

test("the particles picked for tonight are moons, and nothing there is a planet", async ({ page }) => {
  // SAK-465. Five particles picked used to be five ringed planets in one
  // cluster: the biggest body in the sky drawn on its most ordinary thing
  // (Sam: "planets should be rarer"). A particle is a moon now, a grammar
  // pattern a comet, and only a sentence type is still a planet.
  await page.goto("/observatory?sample");
  const cards = page.locator("section", { has: page.getByRole("heading", { name: "Sentences" }) }).getByRole("button");
  const particles = ["marks the topic", "marks the subject", "marks the direct object", "marks where something is or is going", "marks where an action happens"];
  for (const name of particles) await cards.filter({ hasText: name }).first().click();
  await expect(page.getByText("5 Picks", { exact: true })).toBeVisible();

  const sky = page.locator('svg[aria-label="Tonight\'s picks, as the constellations they will be"]');
  await expect(sky.locator('[data-body="moon"]')).toHaveCount(5);
  await expect(sky.locator('[data-body="planet"]')).toHaveCount(0);
  await expect(sky.locator('[data-body="comet"]')).toHaveCount(0);
  // a moon is a disc with a crescent of the night lying on it: two flat
  // tones, the standing's own color and the night behind it
  const moon = sky.locator('[data-body="moon"]').first();
  const crescent = moon.locator("path");
  await expect(crescent).toHaveCount(1);
  await expect(crescent).toHaveAttribute("fill", "var(--sky-ground-0)");
  await expect(moon.locator("circle").last()).toBeVisible();
});

test("a grammar pattern is a comet in the lesson sky, tail and all", async ({ page }) => {
  // SAK-465, the other half: 〜てから is a pattern and not a particle, so it
  // draws as a comet rather than as a moon or as a planet.
  await page.goto("/observatory?sample");
  const cards = page.locator("section", { has: page.getByRole("heading", { name: "Sentences" }) }).getByRole("button");
  await cards.filter({ hasText: "after doing X" }).first().click();
  await page.getByRole("link", { name: "Start lesson" }).click();
  await expect(page).toHaveURL(/\/lesson\?/);

  const sky = page.locator('svg[aria-label^="Tonight\'s constellations"]');
  const comet = sky.locator('[data-body="comet"]');
  await expect(comet).toHaveCount(1);
  await expect(sky.locator('[data-body="moon"]')).toHaveCount(0);
  await expect(sky.locator('[data-body="planet"]')).toHaveCount(0);
  // SAK-473: one tail, drawn along +x inside a group that turns it the way
  // the comet points, and filled with the sky's one tail gradient, which
  // fades it to nothing along its length. Two long sides and a round nose,
  // so it ends soft: no straight edge anywhere. The head is a dot in the
  // standing's own color, drawn last and brightest.
  const tail = comet.locator("path");
  await expect(tail).toHaveCount(1);
  await expect(tail).toHaveAttribute("d", /^M .* Q .* C .* Q .* Z$/);
  await expect(tail.locator("xpath=..")).toHaveAttribute("transform", /^rotate\(/);
  const fill = await tail.getAttribute("fill");
  expect(fill).toMatch(/^url\(#sky-tail-[A-Za-z0-9]+\)$/);
  // and the gradient it names is declared ONCE for the whole sky, however
  // many comets are up there
  const gradients = sky.locator("defs > linearGradient");
  await expect(gradients).toHaveCount(1);
  await expect(gradients).toHaveAttribute("id", fill!.slice(5, -1));
  await expect(gradients).toHaveAttribute("gradientUnits", "objectBoundingBox");
  await expect(gradients.locator("stop").last()).toHaveAttribute("stop-opacity", "0");
  await expect(comet.locator("circle").last()).toBeVisible();
});

test("every body a sky draws is inside the panel, at every height the band is dragged to (SAK-474)", async ({ page }) => {
  // SAK-474. A sky panel is a WINDOW onto a world larger than itself, so a
  // body near its edge used to be drawn half outside it and a pick further
  // down was not drawn at all: a lesson of 〜は and 〜てから drew the comet
  // thirty pixels below the band, behind the details card. SAK-471's centering
  // put the constellation the lesson was standing in inside the band and left
  // every other one where it fell, so it moved the case rather than fixing it.
  //
  // What is measured is the rule itself: every body's box inside the panel's,
  // and clear of the rounded corners, which are 16px squares at each end.
  const CORNER = 16;
  const bodies = (panel: string) => page.evaluate(([sel, corner]) => {
    const box = document.querySelector(sel as string);
    if (!box) return { error: `no ${sel}`, bodies: [] as Array<{ id: string; body: string; over: number; inCorner: boolean }> };
    const p = box.getBoundingClientRect();
    const c = corner as number;
    const out: Array<{ id: string; body: string; over: number; inCorner: boolean }> = [];
    for (const el of box.querySelectorAll("[data-star]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({
        id: el.getAttribute("data-star") ?? "?",
        body: el.getAttribute("data-body") ?? "?",
        // how far past the panel's edge it reaches, on its worst side
        over: Math.round(Math.max(p.left - r.left, p.top - r.top, r.right - p.right, r.bottom - p.bottom) * 10) / 10,
        // and whether any of it is in one of the four corner squares, where
        // the panel's own curve would take a bite out of it
        inCorner: (r.left < p.left + c || r.right > p.right - c) && (r.top < p.top + c || r.bottom > p.bottom - c),
      });
    }
    return { error: "", bodies: out };
  }, [panel, CORNER] as [string, number]);
  /** Every body that is not wholly inside, said in full so a failure names it. */
  const spilling = async (panel: string) => {
    const seen = await bodies(panel);
    if (seen.error) throw new Error(seen.error);
    expect(seen.bodies.length, `${panel} draws nothing`).toBeGreaterThan(0);
    return seen.bodies.filter((b) => b.over > 0 || b.inCorner).map((b) => `${b.id} (${b.body}) is ${b.over}px past the panel${b.inCorner ? " and in a corner" : ""}`);
  };

  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- the lesson, one pick and two, at 1440 and narrow ----
  const lesson = (picks: string) => `/lesson?sample&picks=${encodeURIComponent(picks)}`;
  const band = '[data-lesson-cell="sky"]';
  const handle = page.getByRole("separator", { name: "Drag to make the details taller" });
  // the band dragged to a height: the drag stops at 48px, which is `MIN_SKY`
  // in src/sky/lib/lesson-split.ts
  const dragTo = async (height: number) => {
    const grip = await handle.boundingBox();
    const was = await page.locator(band).boundingBox();
    if (!grip || !was) throw new Error("no handle or no band");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - (was.height - height), { steps: 8 });
    await page.mouse.up();
    const now = await page.locator(band).boundingBox();
    expect(Math.abs((now?.height ?? 0) - height)).toBeLessThanOrEqual(1);
  };

  // a particle (a moon), a grammar pattern (a comet), a lone piece (a star),
  // and the two picks together, which is the case the card was filed on
  for (const picks of ["grammar:wa", "grammar:te-kara", "radical:丨", "grammar:wa,grammar:te-kara"]) {
    await page.goto(lesson(picks));
    await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
    expect(await spilling(band), `${picks}, the band at rest`).toEqual([]);
    for (const height of [200, 120, 48]) {
      await dragTo(height);
      expect(await spilling(band), `${picks}, the band at ${height}px`).toEqual([]);
    }
  }

  // narrow, where the four cells are a stack and the band is a share of the
  // window rather than of the column
  await page.setViewportSize({ width: 760, height: 900 });
  for (const picks of ["grammar:wa", "grammar:wa,grammar:te-kara"]) {
    await page.goto(lesson(picks));
    await expect(page.getByRole("heading", { name: "Tonight, in order" })).toBeVisible();
    expect(await spilling(band), `${picks}, narrow`).toEqual([]);
  }

  // ---- "Your sky tonight" on the Observatory, one pick and two ----
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const picks of ["grammar:wa", "grammar:wa,grammar:te-kara"]) {
    await page.goto(`/observatory?sample&picks=${encodeURIComponent(picks)}`);
    await expect(page.getByRole("heading", { name: "Your sky tonight" })).toBeVisible();
    expect(await spilling('[data-sky="tonight"]'), `${picks}, your sky tonight`).toEqual([]);
  }
});
