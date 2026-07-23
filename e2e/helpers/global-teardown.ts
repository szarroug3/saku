import { rmSync } from "node:fs";

import { E2E_DATA_DIR } from "./data-dir";

/**
 * Remove the isolated data directory once the run is over.
 *
 * Best-effort: the directory is gitignored and recreated from scratch by the
 * next run's global setup anyway, so a failure to delete it here is harmless. It
 * is cleaned up regardless so a passing run leaves the tree exactly as it found
 * it.
 */
export default function globalTeardown(): void {
  rmSync(E2E_DATA_DIR, { recursive: true, force: true });
}
