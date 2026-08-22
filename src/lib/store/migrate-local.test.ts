// Run: node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/store/migrate-local.test.ts
//
// THE GUARDS, NOT THE HAPPY PATH.
// ================================
// migrateLocalProgress's actual replay (POSTing local history/lists to the
// account) reaches a live Supabase client and `fetch` with no injection seam
// (unlike pending-records.ts's deliberately-injected store) — there is no
// mocking convention for either in this codebase yet, so faking a convincing
// success path here would mean inventing new test infrastructure rather than
// using an established one. What IS cheaply, honestly testable without that:
// the three guards that decide whether it touches anything at all.
//
//   1. signed out never runs, full stop — checked before anything else.
//   2. no `window` (SSR) never runs — checked before hasLocalProgress().
//   3. a real attempt that fails (no Supabase env configured in this test
//      process, so createSupabaseBrowserClient()/auth.getUser() reliably
//      throws) must resolve to false WITHOUT clearing the local copy — the
//      one property the whole module exists to guarantee ("never lost by
//      clearing before the upload lands").

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { migrateLocalProgress } from "@/lib/store/migrate-local";
import { hasLocalProgress, localClaim } from "@/lib/store/local-progress";
import type { FactId } from "@/types";

const fid = (s: string) => s as unknown as FactId;

/** Same minimal fake browser local-progress.test.ts installs. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeStorage() };
});

test("signed out never runs — resolves false without even checking for local progress", async () => {
  // No window install needed for this one at all: the signed-out check is
  // the very first thing the function does.
  delete (globalThis as { window?: unknown }).window;
  assert.equal(await migrateLocalProgress(false), false);
});

test("signed in, but no window (SSR) — resolves false", async () => {
  delete (globalThis as { window?: unknown }).window;
  assert.equal(await migrateLocalProgress(true), false);
});

test("signed in, a real browser, nothing local to migrate — resolves false", async () => {
  assert.equal(hasLocalProgress(), false);
  assert.equal(await migrateLocalProgress(true), false);
});

test("a migration attempt that fails leaves the local copy in place, never clears early", async () => {
  // Real local progress present, and a real signed-in attempt — this reaches
  // createSupabaseBrowserClient()/auth.getUser(), which has nothing configured
  // to succeed against in this test process and throws. The outer try/catch
  // must swallow that and resolve false without ever having cleared anything.
  localClaim([fid("kana:あ/reading")], Date.now());
  assert.equal(hasLocalProgress(), true);

  const result = await migrateLocalProgress(true);

  assert.equal(result, false);
  assert.equal(
    hasLocalProgress(),
    true,
    "a failed migration must not clear the local copy it never actually landed",
  );
});
