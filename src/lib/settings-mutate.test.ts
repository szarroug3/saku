// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/settings-mutate.test.ts
//
// THE BUG THESE PIN (SAK-258)
// ===========================
// Settings writes had no concurrency guard — each one loaded the row, merged a
// patch into the loaded copy, and upserted the WHOLE blob back, so the later of
// two overlapping writes won and the earlier device's field was simply gone.
// Change one setting on device A and a DIFFERENT setting on device B in the
// same window and one of them silently disappears, with no error shown on
// either device.
//
// mutateSettingsWithRetry closes it with the same optimistic concurrency
// history and lists have: a write lands only if the row still carries the
// token the read saw, and a miss re-reads the winner and re-applies our patch.
// The first test is the two-device race itself — device A's field and device
// B's field must BOTH survive.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mergeSettings } from "@/lib/settings-merge";
import {
  mutateSettingsWithRetry,
  type SettingsStore,
  type SettingsVersionedRead,
} from "@/lib/settings-mutate";
import type { SettingsFile } from "@/types";

const USER = "user-1";

/**
 * An in-memory store that models the real compare-and-set exactly: a write
 * lands only if the row still carries the token the caller read (or, for the
 * first row, only if none exists yet). `onRead` fires ONCE, right after a read
 * snapshots the state and before it returns — the hook a test uses to run a
 * competing writer "in between", which is how a real overlap is reproduced
 * deterministically. Modelled on lists-mutate.test.ts's CasStore.
 */
class CasStore implements SettingsStore {
  state: { settings: SettingsFile; version: string | null; exists: boolean };
  seq = 0;
  reads = 0;
  writeAttempts = 0;
  conflicts = 0;
  onRead?: () => Promise<void>;

  constructor(seed?: { settings: SettingsFile; version: string }) {
    this.state = seed
      ? { settings: seed.settings, version: seed.version, exists: true }
      : { settings: {}, version: null, exists: false };
  }

  async read(): Promise<SettingsVersionedRead> {
    this.reads++;
    const snapshot: SettingsVersionedRead = {
      settings: structuredClone(this.state.settings),
      version: this.state.version,
      exists: this.state.exists,
    };
    const hook = this.onRead;
    if (hook) {
      this.onRead = undefined;
      await hook();
    }
    return snapshot;
  }

  async write(
    _userId: string,
    next: SettingsFile,
    expected: SettingsVersionedRead,
  ): Promise<boolean> {
    this.writeAttempts++;
    const wins = expected.exists
      ? this.state.exists && this.state.version === expected.version
      : !this.state.exists;
    if (!wins) {
      this.conflicts++;
      return false;
    }
    this.state = {
      settings: structuredClone(next),
      version: `v${++this.seq}`,
      exists: true,
    };
    return true;
  }
}

/** One device's write, exactly what settings.ts's saveSettings does: merge a
 * patch into whatever the row holds. */
function save(store: SettingsStore, patch: SettingsFile): Promise<SettingsFile> {
  return mutateSettingsWithRetry(store, USER, (settings) => mergeSettings(settings, patch));
}

describe("two devices changing different settings in the same window (SAK-258)", () => {
  test("device A's field and device B's field both survive", async () => {
    // No row yet — a brand-new account's first settings write from either side.
    const store = new CasStore();

    // Device B runs to completion between device A's read and its write.
    // Pre-fix, A's write was a blind upsert of its own merged copy over B's
    // row, and B's field was silently gone.
    store.onRead = async () => {
      await save(store, { theme: "dark" });
    };

    const result = await save(store, { claimHintDismissed: true });

    assert.deepEqual(
      result,
      { theme: "dark", claimHintDismissed: true },
      "the resolved file holds both devices' fields",
    );
    assert.deepEqual(store.state.settings, { theme: "dark", claimHintDismissed: true });
    assert.ok(store.conflicts >= 1, "device A lost the CAS at least once and retried");
  });

  test("a change to the SAME field: the later write wins that field, but not the other device's field", async () => {
    const store = new CasStore({ settings: { theme: "light" }, version: "seed" });
    store.onRead = async () => {
      await save(store, { theme: "dark", introShown: ["kana"] });
    };

    const result = await save(store, { theme: "dark", claimHintDismissed: true });

    // Both devices asked for theme "dark" here, so there is no real conflict to
    // observe on that field — the point is introShown (B's) and
    // claimHintDismissed (A's) both survive regardless of who touched theme.
    assert.deepEqual(result, {
      theme: "dark",
      introShown: ["kana"],
      claimHintDismissed: true,
    });
  });

  test("a write that can never land throws rather than reporting a false success", async () => {
    // Sustained contention: the route turns this into a 500, so the caller's
    // banner shows a failure instead of believing an unsaved change landed.
    const jammed: SettingsStore = {
      read: async () => ({ settings: {}, version: "x", exists: true }),
      write: async () => false,
    };
    await assert.rejects(
      () => mutateSettingsWithRetry(jammed, USER, (s) => mergeSettings(s, { theme: "dark" }), 3),
      /lost to concurrent writers 3 times/,
    );
  });

  test("the first write on an empty row inserts", async () => {
    const store = new CasStore();
    const result = await save(store, { theme: "dark" });
    assert.deepEqual(result, { theme: "dark" });
    assert.ok(store.state.exists, "the row now exists");
  });

  test("a later write to an existing row updates rather than duplicating", async () => {
    const store = new CasStore({ settings: { theme: "light" }, version: "seed" });
    const result = await save(store, { theme: "dark" });
    assert.deepEqual(result, { theme: "dark" });
    assert.equal(store.state.exists, true);
  });

  test("a patch never clobbers a field it doesn't name", async () => {
    const store = new CasStore({
      settings: { theme: "dark", claimHintDismissed: true },
      version: "seed",
    });
    const result = await save(store, { introShown: ["kana"] });
    assert.deepEqual(result, {
      theme: "dark",
      claimHintDismissed: true,
      introShown: ["kana"],
    });
  });
});
