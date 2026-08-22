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
  //
  // DROPPED FROM 6 TO 3 (SAK-140/141). 6 workers against ONE dev-mode Next.js
  // server (not a production build — no build-time optimization, every route
  // still compiles/renders live) intermittently starved several tests: a bare
  // `page.goto` timing out at 60s, a progress pill still reading a stale
  // count a full 15s after an answer. All of that reproduced ONLY at the full
  // 6-worker default and disappeared entirely at 2-3 workers across repeated
  // full-suite runs — this is the dev server falling behind under concurrent
  // load, not a product race. 3 is the choice that kept most of the
  // parallelism speedup while never reproducing the starvation in testing;
  // drop further toward 1-2 if it resurfaces on a slower machine.
  fullyParallel: false,
  workers: 3,
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
    // The suite runs SIGNED OUT, saving progress to localStorage. Authentication
    // is disabled independently from the public Supabase connection because
    // Library detail pages fetch their public content_entries rows with those
    // same NEXT_PUBLIC_* variables. Next loads those from .env.local as usual;
    // SAKU_DISABLE_AUTH keeps middleware/session handling off and makes every
    // visitor the deterministic signed-out user these specs drive.
    env: {
      SAKU_DISABLE_AUTH: "1",
      // Do not let `next build` overwrite a concurrently running dev server's
      // `.next` artifacts. Both `build` and `start` read this through
      // next.config.ts, so the E2E server owns an isolated output directory.
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
