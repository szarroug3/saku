import { defineConfig, devices } from "@playwright/test";

import { E2E_DATA_DIR } from "./e2e/helpers/data-dir";

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
  // Create the isolated e2e/.tmp data directory (from the committed fixtures)
  // before anything runs, and remove it after. See e2e/helpers/global-setup.ts.
  globalSetup: "./e2e/helpers/global-setup.ts",
  globalTeardown: "./e2e/helpers/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A plain `pnpm run test:e2e` reports exactly as it always has: one line per
  // test, nothing written to disk, nothing that wants to open a browser.
  //
  // `pnpm run test:e2e:report` sets E2E_HTML_REPORT=1, which adds Playwright's
  // HTML reporter ALONGSIDE the list one — the terminal output is unchanged and
  // a browsable report is written to ./playwright-report (gitignored).
  // `open: "never"` matters: the HTML reporter's default is "on-failure", which
  // would start a web server and block the run the moment a test fails.
  // `pnpm run test:e2e:report:open` serves what was written.
  reporter: process.env.E2E_HTML_REPORT
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
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
    // The suite speaks to the FILE backend, so the server must run in file mode
    // no matter what .env.local says. The maintainer's .env.local sets
    // STORAGE_BACKEND=supabase for her own hosted testing, and next start would
    // otherwise inherit it and boot the app into a backend these specs cannot
    // drive (it needs auth and a database). Next's env loader does NOT override a
    // variable already present in the process environment, so setting it here
    // wins over .env.local without touching that file.
    //
    // SAKU_DATA_DIR redirects the file store off the repo root and into the
    // throwaway e2e/.tmp directory, so a run never opens the maintainer's real
    // history.json / lists.json. Passed to the whole `build && start` command,
    // which is fine: only runtime reads it.
    env: {
      STORAGE_BACKEND: "file",
      SAKU_DATA_DIR: E2E_DATA_DIR,
    },
  },
});
