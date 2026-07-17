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
  clearAllDismissedHints,
  dismissClaimHint,
  DISMISSIBLE_HINT_KEYS,
  isClaimHintDismissed,
} from "./claim-hint.ts";

/** A minimal in-memory Storage — the same shape localStorage presents, so the
 * test exercises the real code path without a DOM. */
function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
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

describe("the reset un-dismisses the intros", () => {
  test("clearAllDismissedHints removes the claim-hint flag — the intro returns", () => {
    const store = fakeStore();
    dismissClaimHint(store);
    assert.equal(isClaimHintDismissed(store), true);
    // The knowledge-base reset's client-side half.
    clearAllDismissedHints(store);
    // Flag gone entirely, and the explainer reads as shown again — day one.
    assert.equal(store._map.has(CLAIM_HINT_KEY), false);
    assert.equal(isClaimHintDismissed(store), false);
  });

  test("the claim hint is in the swept registry", () => {
    // The registry is the contract the reset sweeps; a new intro added here is
    // cleared for free, so this pins that the claim hint is actually in it.
    assert.ok(DISMISSIBLE_HINT_KEYS.includes(CLAIM_HINT_KEY));
  });

  test("a missing or hostile store degrades quietly, never throws", () => {
    assert.doesNotThrow(() => clearAllDismissedHints(null));
    assert.doesNotThrow(() => clearAllDismissedHints(undefined));
    const hostile = {
      removeItem() {
        throw new Error("SecurityError");
      },
    };
    assert.doesNotThrow(() => clearAllDismissedHints(hostile));
  });
});
