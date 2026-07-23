import { join } from "node:path";

/**
 * WHERE THE E2E SUITE KEEPS ITS DATA — and, more to the point, where it does
 * NOT.
 *
 * The app's file store reads and writes history.json / lists.json in one
 * directory (see src/lib/history.ts), which is normally the repo root — i.e. the
 * MAINTAINER'S OWN local progress. A suite that seeds and rewrites that file is
 * one crash away from overwriting real work, so the suite never points at it.
 *
 * Instead the server is launched with SAKU_DATA_DIR set to E2E_DATA_DIR below
 * (see playwright.config.ts), and everything a run seeds or the app writes lands
 * under e2e/.tmp — a gitignored throwaway directory created fresh per run by the
 * global setup and removed by the global teardown. Both the test runner (which
 * seeds the files) and the app process (which reads and writes them) resolve the
 * same paths from here, so the two halves cannot drift onto different files.
 *
 * The repo-root history.json / lists.json are therefore never opened by a run.
 */
export const E2E_DATA_DIR = join(process.cwd(), "e2e", ".tmp");

/** The isolated history the app reads and the seed fixture writes. */
export const E2E_HISTORY_PATH = join(E2E_DATA_DIR, "history.json");

/** The isolated lists blob, kept beside the history exactly as the app expects. */
export const E2E_LISTS_PATH = join(E2E_DATA_DIR, "lists.json");

/** The committed pristine fixtures each run is seeded from. Named with a
 * `.seed.json` suffix on purpose: the repo's .gitignore excludes history.json /
 * lists.json by basename in ANY directory, so a fixture called history.json
 * would be silently untracked. These names dodge that and stay committed. */
export const E2E_HISTORY_FIXTURE = join(
  process.cwd(),
  "e2e",
  "fixtures",
  "history.seed.json",
);
export const E2E_LISTS_FIXTURE = join(
  process.cwd(),
  "e2e",
  "fixtures",
  "lists.seed.json",
);
