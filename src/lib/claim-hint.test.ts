// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/claim-hint.test.ts
//
// The claim explainer is shown once and then dismissed for good. That "for
// good" is the whole point — a flag that forgot on reload would put the sentence
// back under every lesson card, which is exactly the permanent narration the
// owner asked to remove. So these pin the persistence CONTRACT: a fresh store
// reads "show it", a dismissal is remembered, and a hostile store degrades to
// "show it" rather than throwing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAIM_HINT_KEY,
  dismissClaimHint,
  isClaimHintDismissed,
} from "./claim-hint.ts";

/** A minimal in-memory Storage — the same shape localStorage presents, so the
 * test exercises the real code path without a DOM. */
function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

describe("the claim-hint dismissal persists", () => {
  test("a fresh store reads as not dismissed — shown by default", () => {
    assert.equal(isClaimHintDismissed(fakeStore()), false);
  });

  test("dismissing is remembered — the round trip is stable", () => {
    const store = fakeStore();
    assert.equal(isClaimHintDismissed(store), false);
    dismissClaimHint(store);
    // Same store, later read (a "reload"): still dismissed.
    assert.equal(isClaimHintDismissed(store), true);
    // And it wrote under its own namespaced key, not clobbering the config.
    assert.equal(store._map.get(CLAIM_HINT_KEY), "dismissed");
  });

  test("a second store started from the persisted bytes stays dismissed", () => {
    const store = fakeStore();
    dismissClaimHint(store);
    const reloaded = fakeStore(Object.fromEntries(store._map));
    assert.equal(isClaimHintDismissed(reloaded), true);
  });

  test("a missing store degrades to shown, never throws", () => {
    assert.equal(isClaimHintDismissed(null), false);
    assert.equal(isClaimHintDismissed(undefined), false);
    // And a throwing store (private mode) is swallowed on both reads and writes.
    const hostile = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("SecurityError");
      },
    };
    assert.equal(isClaimHintDismissed(hostile), false);
    assert.doesNotThrow(() => dismissClaimHint(hostile));
  });
});
