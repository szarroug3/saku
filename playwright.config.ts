import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 *
 * Port 3249 is used deliberately: port 3000 is reserved for manual use.
 *
 * The dev server is started by Playwright itself. `reuseExistingServer` is off
 * so that every run starts from a server whose on-disk state the fixtures
 * control, rather than whatever a previously running server had mutated.
 */
const PORT = 3249;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // The app renders Japanese text. Pin the locale and timezone so that any
    // date/number formatting in the UI is identical on every machine.
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Tests run against a PRODUCTION build, which is what the Next.js docs in
  // node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md
  // recommend ("we recommend running your tests against your production code").
  //
  // Here it is not merely a recommendation, it is required: under `next dev`
  // the Turbopack HMR websocket cannot complete its handshake against a
  // Playwright-driven Chromium, and with the dev overlay's socket failing the
  // client never finishes hydrating. Every page still SERVER-renders, so the
  // markup looks right, but no effect ever runs: /api/history is never fetched,
  // the Practice pool reads 0, and no button does anything. `next start` has no
  // HMR socket and hydrates normally.
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    // A cold production build of this app is not fast.
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
