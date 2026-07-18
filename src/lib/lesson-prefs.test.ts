// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-prefs.test.ts
//
// The "how it's written" and "readings" sections default CLOSED and remember
// being opened — a preference, not lesson state (see lesson-prefs.ts). The
// hook is React and untestable here, but the storage read/write it stands on is
// pure, and that is where the behaviour lives: default closed, "1" for open, the
// key removed for closed, and a blocked store degrading to closed rather than
// throwing. These pin exactly that.

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  LESSON_PREF_KEYS,
  readLessonPref,
  writeLessonPref,
} from "./lesson-prefs.ts";

/** A minimal localStorage, since node has none. `throwing` flips it into the
 * private-mode / disabled-storage case the code must survive. */
function installStorage(opts: { throwing?: boolean } = {}) {
  const map = new Map<string, string>();
  const store = {
    getItem(k: string) {
      if (opts.throwing) throw new Error("storage disabled");
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      if (opts.throwing) throw new Error("storage disabled");
      map.set(k, v);
    },
    removeItem(k: string) {
      if (opts.throwing) throw new Error("storage disabled");
      map.delete(k);
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = store;
  return map;
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("lesson prefs", () => {
  test("default is closed for both sections", () => {
    installStorage();
    assert.equal(readLessonPref("writing"), false);
    assert.equal(readLessonPref("readings"), false);
  });

  test("opening stores '1' under the section's key and reads back open", () => {
    const map = installStorage();
    writeLessonPref("writing", true);
    assert.equal(map.get(LESSON_PREF_KEYS.writing), "1");
    assert.equal(readLessonPref("writing"), true);
  });

  test("closing removes the key and reads back closed", () => {
    const map = installStorage();
    writeLessonPref("readings", true);
    assert.equal(readLessonPref("readings"), true);
    writeLessonPref("readings", false);
    assert.equal(map.has(LESSON_PREF_KEYS.readings), false);
    assert.equal(readLessonPref("readings"), false);
  });

  test("the two sections are independent", () => {
    installStorage();
    writeLessonPref("writing", true);
    assert.equal(readLessonPref("writing"), true);
    assert.equal(readLessonPref("readings"), false);
  });

  test("blocked storage degrades to closed rather than throwing", () => {
    installStorage({ throwing: true });
    assert.equal(readLessonPref("writing"), false);
    // Writing must not throw either — the toggle still works for the session.
    assert.doesNotThrow(() => writeLessonPref("writing", true));
  });
});
