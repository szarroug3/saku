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
  await expect(page.getByRole("heading", { name: "Tonight's drill", exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "A break between rounds" })).toBeVisible();
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

test("deleting a saved recipe asks first, and Keep it keeps it", async ({ page }) => {
  // SAK-364. Delete fired on the click, with no ask and no undo, while
  // forgetting a session and wiping progress both asked inline.
  await page.goto("/practice?sample");
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await page.getByPlaceholder("A name for this recipe").fill("Evening drill");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved as Evening drill" })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("This recipe goes for good.")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("button", { name: "Saved as Evening drill" })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete it" }).click();
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

test("the atlas opens on the shelf that holds what you asked for", async ({ page }) => {
  // SAK-354. /atlas?entry=kanji:日 opened 日 in the panel with the middle
  // still showing Kana, so closing the panel left you on the wrong shelf.
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  // the rail lights the shelf the entry is on
  const kanji = page.getByRole("button", { name: /^Kanji/ }).first();
  await expect(kanji).toHaveAttribute("aria-pressed", "true");
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
  const empty = page.getByText("Nothing picked. Choose something to learn and it lands here.");
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
  // SAK-361. The acknowledgement ran the panel's whole width, eleven lines at
  // about 200 characters, and the reading list was spliced on with no heading.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Where does the data come from?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Other places to learn" })).toBeVisible();
  const measured = await page.evaluate(() => {
    const p = document.querySelector("main section p") as HTMLElement;
    return { line: Math.round(p.getBoundingClientRect().width), panel: Math.round((p.closest("section") as HTMLElement).clientWidth) };
  });
  // the words stop well short of the panel they sit in
  expect(measured.line).toBeLessThan(600);
  expect(measured.panel).toBeGreaterThan(measured.line + 200);
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
  // rather than assuming the paint implies it (SAK-406 — under a loaded suite
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
