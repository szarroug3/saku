import { defineConfig, devices } from "@playwright/test";

// Codex and some terminals export NO_COLOR, while Playwright enables colour for
// its child processes. Node warns whenever both flags are present, even though
// Playwright resolves the conflict consistently. Drop the inherited opt-out
// before the web server and workers are spawned so test output stays quiet.
delete process.env.NO_COLOR;

/**
 * E2E config.
 *
 * Port 3249 is used deliberately: port 3000 is reserved for manual use.
 *
 * The dev server is started by Playwright itself. `reuseExistingServer` is off
 * so that every run starts from a fresh server, rather than whatever a
 * previously running one had mutated. The suite runs as a SIGNED-OUT visitor
 * whose progress lives in the browser's localStorage (there is no file store or
 * always-signed-in local user any more), so each test's state is seeded straight
 * into localStorage by the `seed` fixture (see e2e/helpers/app.ts) and isolated
 * automatically by Playwright's per-test browser context.
 */
const PORT = 3249;

export default defineConfig({
  testDir: "./e2e",
  // Run separate spec files concurrently. Tests within one file remain ordered,
  // while each worker still gets Playwright's isolated browser context and
  // localStorage state through the seed fixture described above.
  // Increased workers from 4 to 6 for better parallelization without excessive
  // browser context overhead.
  fullyParallel: false,
  workers: 6,
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
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    // A cold production build of this app is not fast.
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    // The suite runs SIGNED OUT, saving to localStorage — the app's default when
    // there is no Supabase session. Blanking the Supabase keys forces exactly
    // that regardless of what .env.local holds: isSupabaseStore() reads them as
    // "not configured", so the server never tries to reach Supabase, auth is off,
    // and every visitor is the signed-out-localStorage user these specs drive.
    // The maintainer's .env.local sets real keys for her own hosted testing;
    // Next's env loader does NOT override a variable already present in the
    // process environment, so setting them empty here wins without touching that
    // file. NEXT_PUBLIC_* are inlined at build time, which is why this is passed
    // to the whole `build && start` command.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      // Do not let `next build` overwrite a concurrently running dev server's
      // `.next` artifacts. Both `build` and `start` read this through
      // next.config.ts, so the E2E server owns an isolated output directory.
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
