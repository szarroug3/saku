// The dev surfaces, off (SAK-445).
//
// This spec belongs to playwright.dev-surfaces-off.config.ts and runs nowhere
// else: it drives the same production build the main suite does, started
// WITHOUT SAKU_DEV_SURFACES, which is what Vercel runs. The main config
// ignores it by name, because under that server every assertion here would be
// false, and rightly so.
//
// What it holds is one sentence: with the switch off, nothing anybody can type
// or POST makes this server serve the pretend learner. The pages are the
// obvious half. The forged action call at the end is the half a URL test
// cannot reach, since a server action is a POST and a POST is not a link.
//
//   npx playwright test --config=playwright.dev-surfaces-off.config.ts

import { test, expect } from "./helpers/app";

test("the home serves the visitor's own empty sky, not the pretend learner's", async ({ page }) => {
  const res = await page.goto("/?sample");
  // ignored as if absent: the page is served, not redirected and not refused
  expect(res?.status()).toBe(200);
  expect(page.url()).toContain("?sample");
  await expect(page.getByRole("heading", { name: "What have you discovered?" })).toBeVisible();
  await expect(page.getByText("You haven't discovered anything yet.")).toBeVisible();
  await expect(page.getByText(/^0 of [\d,]+ Discovered$/)).toBeVisible();
  // and the flag does not survive into the page's own links, so a click
  // cannot carry it anywhere either
  await expect(page.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/observatory");
});

test("the atlas serves the visitor's own standings", async ({ page }) => {
  await page.goto("/atlas?sample");
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
  // the pretend learner has every kana, in every standing; this visitor has none
  await expect(page.getByText(/^0 of [\d,]+ Kana Known$/)).toBeVisible();
  await expect(page.getByLabel(/^kana: 0 of [\d,]+ seen/)).toBeVisible();
});

test("the quiz deals what a visitor is due, which is nothing", async ({ page }) => {
  // with the surfaces on, `?sample` with no picks deals one of every kind
  await page.goto("/quiz?sample");
  await expect(page.getByRole("heading", { name: "Nothing to quiz" })).toBeVisible();
  await expect(page.getByText(/^Nothing is due\./)).toBeVisible();
});

test("sessions are the visitor's own, which are none", async ({ page }) => {
  await page.goto("/sessions?sample");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByText("Nothing yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run it again" })).toHaveCount(0);
});

test("the showcase lesson is a lesson of nothing", async ({ page }) => {
  const res = await page.goto("/lesson?showcase");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Tonight's lesson" })).toBeVisible();
  await expect(page.getByText("Nothing to teach")).toBeVisible();
});

test("a forged action call gets the visitor's empty data", async ({ page }) => {
  // The page gate is a URL, and a server action is not reached through one.
  // So this takes the real POST the page makes, with its real action id, and
  // sends it again with the one thing a forger would change: a caller that
  // says it is the pretend learner. `loadSessions` answers because its two
  // answers cannot be mistaken for each other, and because every session the
  // pretend learner has is minted with an id starting "sample-".
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  page.on("request", (r) => {
    if (r.headers()["next-action"]) calls.push({ url: r.url(), headers: r.headers() });
  });
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect.poll(() => calls.length).toBeGreaterThan(0);

  const { url, headers } = calls[0];
  const send = async (who: string) => {
    const res = await page.request.post(url, {
      headers: { ...headers, "content-type": "text/plain;charset=UTF-8" },
      data: `[${who}]`,
    });
    expect(res.status()).toBe(200);
    return res.text();
  };

  const forged = await send(`{"sample":true}`);
  expect(forged, "the pretend learner's sessions are minted as sample-<ts>").not.toContain("sample-");
  // and it is not merely stripped of what gives it away: it is the same
  // answer the caller would have had without the claim
  expect(forged).toBe(await send("{}"));
});
