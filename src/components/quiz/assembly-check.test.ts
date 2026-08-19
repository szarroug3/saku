// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/assembly-check.test.ts
//
// SAK-19: pins the retry/reveal timing of the sentence-builder's Check button.
// With Retries: N configured, exactly N wrong Check presses should happen
// before the canonical answer reveals, every one of them distinguishable from
// "nothing happened" (a state change checkCard's caller turns into a shake or
// the reveal itself — see assembly-screen.tsx's `check`).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { checkCard, newAsmCard, newAsmRuntime } from "./assembly-check.ts";
import type { AssemblyItem } from "../../data/assembly.ts";

const ITEM: AssemblyItem = {
  id: 1,
  en: "I eat rice.",
  jp: "ごはんを食べます。",
  pieces: [
    { t: "ごはんを", h: "ごはん" },
    { t: "食べます。", h: "食べる" },
  ],
  v: [],
  // No patterns — assemblyFacts resolves to [] regardless of the grammar
  // registry, so this test needs no real dictionary content.
  p: [],
};

const WRONG_ORDER = ["食べます。", "ごはんを"];
const RIGHT_ORDER = ["ごはんを", "食べます。"];

describe("checkCard — SAK-19 retry/reveal timing", () => {
  test("with Retries: 2, exactly 2 wrong presses precede the reveal, and both are distinguishable from a no-op", () => {
    const rt = newAsmRuntime(ITEM);
    const card = newAsmCard(ITEM, WRONG_ORDER);

    // Press 1: wrong, retries remain — a "retry", not silence.
    card.tray = [...WRONG_ORDER];
    const first = checkCard(rt, card, 2);
    assert.equal(first, "retry");
    assert.equal(card.state, "open", "still answerable after press 1");
    assert.equal(card.tries, 1);

    // Press 2: the configured retry count (2) is now exhausted. This must be
    // the press that reveals — not a second silent "retry" that pushes reveal
    // to a 3rd press with no pip left to spend and no feedback of its own.
    card.tray = [...WRONG_ORDER];
    const second = checkCard(rt, card, 2);
    assert.equal(second, "locked", "reveal lands on the press that exhausts the configured retries, not one later");
    assert.equal(card.state, "wrong");
    assert.equal(card.tries, 2);
    assert.deepEqual(
      card.tray,
      WRONG_ORDER,
      "the learner's own (wrong) order is kept, not silently replaced by the canonical one",
    );
  });

  test("with Retries: 0, the very first wrong press reveals (no free retries)", () => {
    const rt = newAsmRuntime(ITEM);
    const card = newAsmCard(ITEM, WRONG_ORDER);
    const out = checkCard(rt, card, 0);
    assert.equal(out, "locked");
    assert.equal(card.tries, 1);
  });

  test("with Retries: 1, the single configured retry is spent by the first wrong press, which reveals", () => {
    // Same rule as Retries: 2 above, at N=1: the number of wrong presses
    // before reveal equals the configured count, so with exactly one retry
    // configured, the first (and only) wrong press both spends it and
    // reveals — there is no second, pip-less press to sit through.
    const rt = newAsmRuntime(ITEM);
    const card = newAsmCard(ITEM, WRONG_ORDER);
    const out = checkCard(rt, card, 1);
    assert.equal(out, "locked");
    assert.equal(card.tries, 1);
  });

  test("a correct tray always resolves right, regardless of retries used", () => {
    const rt = newAsmRuntime(ITEM);
    const card = newAsmCard(ITEM, WRONG_ORDER);
    checkCard(rt, card, 2); // burn one retry
    card.tray = [...RIGHT_ORDER];
    const out = checkCard(rt, card, 2);
    assert.equal(out, "right");
    assert.equal(card.state, "right");
  });
});
