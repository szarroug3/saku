import { copyFileSync, mkdirSync, rmSync } from "node:fs";

import {
  E2E_DATA_DIR,
  E2E_HISTORY_FIXTURE,
  E2E_HISTORY_PATH,
  E2E_LISTS_FIXTURE,
  E2E_LISTS_PATH,
} from "./data-dir";

/**
 * Build the isolated data directory the whole run lives in.
 *
 * Runs ONCE, before the server starts, and starts from a clean slate: a previous
 * run that crashed before its teardown could have left seeded test data behind,
 * and inheriting it would make the first spec's state depend on the last run's
 * failure. So the directory is removed and recreated, then seeded from the two
 * committed fixtures. Per-test seeding (see helpers/app.ts) overwrites the
 * history again for the specs that need a specific pool; this just guarantees a
 * valid file exists for the specs that don't.
 */
export default function globalSetup(): void {
  rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  mkdirSync(E2E_DATA_DIR, { recursive: true });
  copyFileSync(E2E_HISTORY_FIXTURE, E2E_HISTORY_PATH);
  copyFileSync(E2E_LISTS_FIXTURE, E2E_LISTS_PATH);
}
