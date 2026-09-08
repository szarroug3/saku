import { test, expect, type Page } from "@playwright/test";

/**
 * The Sky suite's one import.
 *
 * It used to be a fixture library for the old app: a `seed` fixture that wrote
 * a signed-out history and a pinned config into localStorage before the first
 * navigation, plus the locators and answer-a-card walks the old drill specs
 * shared. The old app and its specs went at cutover (SAK-398), and
 * `e2e/sky.spec.ts` builds its own state through the app's own pages, so none
 * of that had a caller left.
 *
 * What is left is Playwright's own `test` and `expect`, re-exported so the
 * spec keeps a single import line and so anything the Sky's specs do come to
 * share has an obvious place to live.
 */

export { test, expect };
export type { Page };
