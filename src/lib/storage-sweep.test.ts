// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/storage-sweep.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { sweepDeadCookie, sweepDeadKeys, type SweepStore } from "./storage-sweep";

/** An in-memory Storage stand-in with the three members the sweep walks. */
function fakeStore(seed: Record<string, string> = {}): SweepStore & {
  data: Record<string, string>;
} {
  const data = { ...seed };
  return {
    data,
    get length() {
      return Object.keys(data).length;
    },
    key: (i) => Object.keys(data)[i] ?? null,
    removeItem: (k) => {
      delete data[k];
    },
  };
}

test("the keys of features that are gone are removed", () => {
  const store = fakeStore({
    "saku-theme": "aizome",
    "saku-appearance": "dark",
    "saku-accents": '{"kiri":"magenta"}',
    "saku-claim-hint": "dismissed",
    "saku-lesson-writing": "1",
    "saku-lesson-readings": "1",
    "saku-session": "{}",
    "saku-session-sync": "{}",
    "saku-pending-records": "[]",
    "saku-intro-track-kanji": "shown",
    "saku-intro-pitch": "shown",
    "kanaquiz-cfg": "{}",
    "kanaquiz-anything-at-all": "x",
  });
  assert.equal(sweepDeadKeys(store), 13);
  assert.deepEqual(store.data, {});
});

test("the keys the app still uses are left alone", () => {
  const live = {
    "saku-cfg": "{}",
    "saku-local-history": "{}",
    // a signed-out visitor's lists still live here (store/local-progress.ts)
    "saku-local-lists": "{}",
    "saku-history-cache:u1": "{}",
    "sky:practice:recipes": "[]",
    "sky:practice:misses": "{}",
    "sky:quiz:rest": "0",
  };
  const store = fakeStore(live);
  assert.equal(sweepDeadKeys(store), 0);
  assert.deepEqual(store.data, live);
});

test("every dead key goes in one pass, whatever order they sit in", () => {
  // Removing during the walk renumbers the keys under it; this is the case that
  // catches it, since the dead keys are adjacent.
  const store = fakeStore({
    "kanaquiz-a": "1",
    "kanaquiz-b": "2",
    "kanaquiz-c": "3",
    "saku-cfg": "{}",
  });
  assert.equal(sweepDeadKeys(store), 3);
  assert.deepEqual(Object.keys(store.data), ["saku-cfg"]);
});

test("a second load has nothing to do", () => {
  const store = fakeStore({ "saku-theme": "kiri", "saku-cfg": "{}" });
  assert.equal(sweepDeadKeys(store), 1);
  assert.equal(sweepDeadKeys(store), 0);
});

test("no store, or one that throws, is not an error", () => {
  assert.equal(sweepDeadKeys(null), 0);
  assert.equal(sweepDeadKeys(undefined), 0);
  const angry: SweepStore = {
    get length(): number {
      throw new Error("blocked");
    },
    key: () => null,
    removeItem: () => {},
  };
  assert.equal(sweepDeadKeys(angry), 0);
});

test("the run-count cookie is expired, and only when it is there", () => {
  const doc = { cookie: "saku-current-run-count=12; other=1" };
  sweepDeadCookie(doc);
  assert.match(doc.cookie, /^saku-current-run-count=; Max-Age=0/);

  const clean = { cookie: "other=1" };
  sweepDeadCookie(clean);
  assert.equal(clean.cookie, "other=1");

  sweepDeadCookie(null);
});
