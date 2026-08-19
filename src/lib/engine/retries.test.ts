// SAK-54: a binary (exactly 2-option) multiple-choice board has no meaningful
// retry — missing the one wrong answer leaves a single button standing, so a
// second guess tests nothing. `effectiveRetries` is the pure decision drill-
// screen's submit() and its retry-pip display both read: zero retries for a
// showing whose option board has exactly two options, the configured amount
// for every other board (typed, 3+ option MC, or no option board at all).
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/retries.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { effectiveRetries, retriesAllowed } from "@/lib/engine/index";
import type { QuizConfig } from "@/types";

function cfgOf(over: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode: "drill",
    length: "limited",
    limType: "cov",
    limCount: 50,
    retries: "lim",
    retryN: 2,
    ...over,
  } as unknown as QuizConfig;
}

test("a binary (2-option) board gets zero retries regardless of cfg.retries", () => {
  assert.equal(effectiveRetries(cfgOf({ retries: "lim", retryN: 2 }), 2), 0);
  assert.equal(effectiveRetries(cfgOf({ retries: "unl" }), 2), 0);
  // Already zero under "none" — this just confirms the override agrees.
  assert.equal(effectiveRetries(cfgOf({ retries: "none" }), 2), 0);
});

test("a 3+ option board still honors the configured retries — no regression", () => {
  const cfg = cfgOf({ retries: "lim", retryN: 2 });
  assert.equal(effectiveRetries(cfg, 3), retriesAllowed(cfg));
  assert.equal(effectiveRetries(cfg, 3), 2);
  assert.equal(effectiveRetries(cfgOf({ retries: "unl" }), 6), Infinity);
  assert.equal(effectiveRetries(cfgOf({ retries: "none" }), 4), 0);
});

test("a typed card (no option board, optionCount null) is unaffected", () => {
  const cfg = cfgOf({ retries: "lim", retryN: 3 });
  assert.equal(effectiveRetries(cfg, null), retriesAllowed(cfg));
  assert.equal(effectiveRetries(cfg, null), 3);
});

test("only exactly two options triggers the skip — one and 'many' do not", () => {
  const cfg = cfgOf({ retries: "lim", retryN: 2 });
  // buildMcOptions never actually emits a 1-option board (that's the
  // "board of one is not a board" backstop, which falls back to typed), but
  // effectiveRetries itself should not special-case it either — only the
  // real binary case, 2, is scoped.
  assert.equal(effectiveRetries(cfg, 1), retriesAllowed(cfg));
  assert.equal(effectiveRetries(cfg, 4), retriesAllowed(cfg));
  assert.equal(effectiveRetries(cfg, 6), retriesAllowed(cfg));
});
