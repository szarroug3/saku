// SAK-102: the "Before you start" (SRS intro) banner reappeared after being
// dismissed. Root cause: markIntroShown wrote the local flag but never told
// the server, so the next reconcile-down (applyServerSettings, run by
// SettingsProvider on every fresh mount) saw a server `introShown` list
// without "intro-srs" and REMOVED the local flag again — see the "field-level
// REPLACE" contract in settings-merge.ts and the reconcile in
// settings-local.ts. This file pins the fix: a dismissal must survive a
// reconcile-down.

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { applyServerSettings, type SettingsStore } from "./settings-local";
import { isIntroShown, markConceptCardsShown, markIntroShown } from "./intro-shown";
import { registerSettingsPusher, unregisterSettingsPusher } from "./settings-sync";
import type { SettingsFile } from "@/types";

/** An in-memory Storage stand-in with the methods these modules need. */
function fakeStore(): SettingsStore {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("markIntroShown pushes the dismissal to the server", () => {
  let installed: ((patch: SettingsFile) => void) | undefined;

  afterEach(() => {
    if (installed) unregisterSettingsPusher(installed);
    installed = undefined;
  });

  test("a single card's dismissal is pushed, not just written locally", () => {
    const pushed: SettingsFile[] = [];
    installed = (patch) => pushed.push(patch);
    registerSettingsPusher(installed);

    const store = fakeStore();
    markIntroShown(store, "intro-srs");

    assert.equal(pushed.length, 1);
    assert.ok(pushed[0].introShown?.includes("intro-srs"));
  });

  test(
    "regression: dismissing the card survives a reconcile-down " +
      "(the SAK-102 bug — it used to be wiped out again)",
    () => {
      // Simulate the server: whatever gets pushed becomes what a fresh mount
      // would read back as `initial` and reconcile down.
      let serverIntroShown: string[] = [];
      installed = (patch) => {
        if (patch.introShown !== undefined) serverIntroShown = patch.introShown;
      };
      registerSettingsPusher(installed);

      const store = fakeStore();

      // Learner dismisses the "Before you start" banner.
      markIntroShown(store, "intro-srs");
      assert.equal(isIntroShown(store, "intro-srs"), true);

      // A fresh page load: SettingsProvider fetches the server's settings and
      // reconciles them down onto a brand-new local store (applyServerSettings
      // in settings-local.ts, driven by settings-provider.tsx on mount).
      const freshStore = fakeStore();
      applyServerSettings(freshStore, { introShown: serverIntroShown });

      // Before the fix, serverIntroShown was still [] here (markIntroShown
      // never pushed), so this would fail and the banner would reappear.
      assert.equal(isIntroShown(freshStore, "intro-srs"), true);
    },
  );

  test("markConceptCardsShown still pushes once per batch, not once per card", () => {
    const pushed: SettingsFile[] = [];
    installed = (patch) => pushed.push(patch);
    registerSettingsPusher(installed);

    const store = fakeStore();
    markConceptCardsShown(store, ["track-radical", "track-kanji", "not-a-real-id"]);

    assert.equal(pushed.length, 1);
    assert.deepEqual(
      new Set(pushed[0].introShown),
      new Set(["track-radical", "track-kanji"]),
    );
  });
});
