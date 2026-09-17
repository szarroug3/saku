import { defineConfig, devices } from "@playwright/test";

// The dev surfaces, off (SAK-445).
//
//   npx playwright test --config=playwright.dev-surfaces-off.config.ts
//
// Everything else in this repository tests the app as a developer runs it,
// which since SAK-445 means with SAKU_DEV_SURFACES=1 and the pretend learner
// answering. This config is the other half: the same production build, started
// without the variable, which is what Vercel runs. It is the only place the
// off state is proved in a real browser, and a unit test cannot do it, because
// what is being proved is that a real Next server, built for production, does
// not serve somebody else's history to a URL anyone can type.
//
// It is a separate config rather than a project in playwright.config.ts
// because the switch is in the web server's environment, not in the test: one
// config, one server, one answer. `reuseExistingServer` is off for the same
// reason as the main suite, and doubly so here, since reusing a server started
// WITH the variable would quietly pass every assertion in reverse.
//
// Its own port and its own output directory, so it can run beside the main
// suite (port 3249, .next-e2e) without either one waiting for the other. The
// port is up out of the way of 3249 and of the ports a hand-started server
// takes (3000 for a manual run, 3256 for the Planetarium's perf script).
const PORT = 3287;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "dev-surfaces-off.spec.ts",
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
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -rf .next/types .next-e2e-off && pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    // SAKU_DISABLE_AUTH for the same reason the main suite sets it: the specs
    // run as a deterministic signed-out visitor. And NO SAKU_DEV_SURFACES,
    // which is the whole point of this file. Anything the suite finds here is
    // what the deployed app would do.
    env: {
      SAKU_DISABLE_AUTH: "1",
      NEXT_DIST_DIR: ".next-e2e-off",
    },
  },
});
