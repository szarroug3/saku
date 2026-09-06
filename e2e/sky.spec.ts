// The Sky's pages, end to end (SAK-348): each on the pretend learner or
// signed out, the way the suite runs. Not the look, which is Sam's, but
// that each page opens, its one main action works, and what it says it
// keeps, it keeps.

import { test, expect } from "./helpers/app";

test("practice builds a deck from a collection and starts it", async ({ page }) => {
  await page.goto("/dev/sky/practice?sample");
  await expect(page.getByRole("heading", { name: "What would you like to practice?" })).toBeVisible();
  await page.getByRole("button", { name: "Kana", exact: true }).click();
  await expect(page.getByText(/drawn at random from the/)).toBeVisible();
  const start = page.getByRole("button", { name: "Start" });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page).toHaveURL(/\/dev\/sky\/practice\/run/);
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
});

test("settings keep a change across a reload", async ({ page }) => {
  await page.goto("/dev/sky/settings");
  await expect(page.getByRole("heading", { name: "How should Saku behave?" })).toBeVisible();
  const timer = page.getByRole("switch", { name: "Timer" });
  await expect(timer).toHaveAttribute("aria-checked", "false");
  await timer.click();
  await expect(timer).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Timer" })).toHaveAttribute("aria-checked", "true");
});

test("the quiz grades a typed answer and reveals on giving up", async ({ page }) => {
  await page.goto("/dev/sky/quiz?sample");
  await expect(page.getByRole("heading", { name: "Quiz", exact: true })).toBeVisible();
  const box = page.getByPlaceholder(/The reading, in romaji|The meaning, in English|Your answer/);
  await box.fill("zzz");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/^Not that\./)).toBeVisible();
  await page.getByRole("button", { name: "I don't know" }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
});

test("a lesson's quiz rests between rounds", async ({ page }) => {
  await page.goto("/dev/sky/quiz?sample&picks=kana-row:h-vowels");
  await page.getByRole("button", { name: "End the quiz" }).click();
  await page.getByRole("button", { name: /Take a rest, then round 2 of 3/ }).click();
  await expect(page.getByRole("heading", { name: "Take a break and come back." })).toBeVisible();
  await expect(page.getByText(/Come back at/)).toBeVisible();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
});

test("the atlas opens on its question", async ({ page }) => {
  await page.goto("/dev/sky/atlas?sample");
  await expect(page.getByRole("heading", { name: "What would you like to know?" })).toBeVisible();
});

test("the account page, signed out, offers to keep the sky", async ({ page }) => {
  await page.goto("/dev/sky/account");
  await expect(page.getByRole("heading", { name: "Want to keep your sky?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my progress" })).toBeVisible();
});

test("recent sessions list the pretend learner's quizzes", async ({ page }) => {
  await page.goto("/dev/sky/sessions?sample");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run it again" })).toBeVisible();
});

test("a visitor's quiz is kept in the browser and shows up under sessions", async ({ page }) => {
  // signed out, no account: the Sky reads and writes the browser's own copy
  await page.goto("/dev/sky/quiz?picks=kana-row:h-vowels");
  await expect(page.getByRole("button", { name: "End the quiz" })).toBeVisible();
  await page.getByRole("button", { name: "I don't know" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "End the quiz" }).click();
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  await page.goto("/dev/sky/sessions");
  await expect(page.getByRole("heading", { name: "What have you done lately?" })).toBeVisible();
  await expect(page.getByText(/Quiz · 1 card/)).toBeVisible();
  await page.goto("/dev/sky/planetarium");
  await expect(page.getByText(/1 of [\d,]+ Discovered/)).toBeVisible();
});
