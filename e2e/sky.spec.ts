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
  await expect(page.getByText(/Same character, and the company it keeps decides\./)).toBeVisible();
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
  await expect(page.getByText(/Same character, and the company it keeps decides/)).toHaveCount(0);
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

test("a visitor's quiz is where they left it after a reload", async ({ page }) => {
  // SAK-404. The run is written down after every answer, and the same page
  // opened again picks it up: the deck it dealt, in the order it dealt it,
  // and the card that was next.
  await page.goto("/quiz?picks=kana-row:h-vowels");
  const count = page.getByText(/^\d+ of \d+$/);
  await expect(count).toHaveText("1 of 5");

  // two cards answered, so the third is the one waiting
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "I don't know" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(count).toHaveText("3 of 5");
  // and the run really is in the browser by then, not only on the screen
  await expect
    .poll(() => page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem("sky:quiz:run");
        return raw ? (JSON.parse(raw).answers?.length ?? 0) : 0;
      } catch {
        return 0;
      }
    }))
    .toBe(2);

  await page.reload();
  // the third card, open, with the two answers still counted against the deck
  await expect(count).toHaveText("3 of 5");
  await expect(page.getByRole("button", { name: "I don't know" })).toBeVisible();

  // the two places a learner lands offer it back, and the offer walks
  await page.goto("/");
  const offer = page.getByRole("link", { name: "5 cards, 2 answered" });
  await expect(page.getByText("Continue where you left off?")).toBeVisible();
  await page.goto("/observatory");
  await expect(page.getByText("Continue where you left off?")).toBeVisible();
  await offer.click();
  await expect(count).toHaveText("3 of 5");

  // and finishing it clears the run: there is nothing left to come back to
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("sky:quiz:run")))
    .toBe(null);
  await page.goto("/");
  await expect(page.getByText("Continue where you left off?")).toHaveCount(0);
});

// ONE WAY TO OPEN AND CLOSE THINGS (SAK-412). Every fold in the Sky is now the
// same round chevron button, ⌄ closed and ⌃ open, wired to what it opens. None
// of these folds had a test before, so each gets one: open it, see the content,
// close it, see it gone.

test("the home's details fold opens and closes on its round button", async ({ page }) => {
  await page.goto("/?sample");
  const fold = page.getByRole("button", { name: "Show the details" });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#sky-home-details")).toHaveCount(0);

  await fold.click();
  await expect(page.locator("#sky-home-details")).toBeVisible();

  await page.getByRole("button", { name: "Hide the details" }).click();
  await expect(page.locator("#sky-home-details")).toHaveCount(0);
});

test("a lesson card's sections fold and unfold on their round buttons", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  const open = page.getByRole("button", { name: "Open Readings" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  // what the button says it controls is the panel, and it is not there yet
  const panel = page.locator(`[id="${await open.getAttribute("aria-controls")}"]`);
  await expect(panel).toHaveCount(0);

  await open.click();
  await expect(panel).toBeVisible();
  await expect(panel).not.toBeEmpty();

  await page.getByRole("button", { name: "Close Readings" }).click();
  await expect(panel).toHaveCount(0);
});

test("the why behind writing early folds open under the card that raises it", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:日")}`);
  await page.getByRole("button", { name: "Open How it's written" }).click();
  const why = page.getByRole("button", { name: "Show the reason why" }).first();
  await expect(why).toHaveAttribute("aria-expanded", "false");

  await why.click();
  await expect(page.getByRole("button", { name: "Hide the reason why" }).first()).toBeVisible();
  await expect(page.getByText("Every character has a correct order").first()).toBeVisible();

  await page.getByRole("button", { name: "Hide the reason why" }).first().click();
  await expect(page.getByText("Every character has a correct order")).toHaveCount(0);
});

test("the stroke chart shows all its frames and folds them back", async ({ page }) => {
  await page.goto(`/atlas?sample&entry=${encodeURIComponent("kanji:曜")}`);
  await page.getByRole("button", { name: "Open How it's written" }).click();
  const all = page.getByRole("button", { name: /Show all \d+ strokes/ });
  await expect(all).toBeVisible();
  await expect(all).toHaveAttribute("aria-expanded", "false");

  await all.click();
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

test("the built-from filter picks several parts at once and keeps only the kanji carrying them all", async ({ page }) => {
  // SAK-413. The filter was fifty-odd chips in four rows; it is one control
  // now, and it takes more than one part, because naming a second piece of a
  // character you are staring at should narrow the answer.
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

  // a second part narrows again rather than widening, and both are named
  const second = list.getByRole("option", { selected: false }).nth(3);
  const secondText = (await second.innerText()).trim();
  await second.click();
  await expect(list.getByRole("option", { selected: true })).toHaveCount(2);
  expect(await count()).toBeLessThanOrEqual(afterOne);
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
  await page.goto(`/lesson?picks=${encodeURIComponent("kanji:日")}`);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).first().click();
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
  expect(lines.widths).toEqual(["1"]);
  // structure, or fog into what has not been discovered. Nothing else.
  for (const o of lines.opacities) expect(["0.45", "0.18"], `line opacity ${o}`).toContain(o);
});

test("the legend's key draws the real stars, tonight among them", async ({ page }) => {
  // SAK-338. The key used to be flat coloured dots beside the words, which
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
