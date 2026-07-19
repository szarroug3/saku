// The drill screen's half of the hint: where the flag lives, when it resets,
// and the two things taking a hint must NOT do.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/drill-hint.test.ts
//
// WHY THIS READS THE SOURCE
// =========================
// The rules under test are properties of a React component with no DOM harness
// in this repo (see stroke-order.test.ts, which guards its own component the
// same way and explains why). The alternative is no test at all for the three
// invariants the feature is most likely to lose to a later edit:
//
//   - a hint must not spend a retry (q.tries is a separate affordance);
//   - the flag must reset when the NEXT card is asked, not linger;
//   - the hint must not be takeable twice on one showing.
//
// The scoring rule itself is NOT tested here — it lives in engine's
// `firstTryCredit`, which is a pure function with real tests beside it in
// hint.test.ts. This file only checks that the drill calls it with the showing's
// hinted flag rather than re-deriving the rule locally.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(
  new URL("./drill-screen.tsx", import.meta.url),
  "utf8",
);

/** The body of a top-level `function name(...) { … }` in the source, by brace
 * matching from its opening brace. */
function bodyOf(name: string): string {
  const at = SRC.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `expected drill-screen.tsx to define ${name}`);
  const open = SRC.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(open + 1, i);
  }
  assert.fail(`unbalanced braces reading ${name}`);
}

test("taking a hint does not consume a retry", () => {
  // The retry pips and `q.tries` are a different affordance with a different
  // meaning, and a hint that quietly spent one would show as a lost pip the user
  // never earned. takeHint touches the hinted flag and nothing else.
  const body = bodyOf("takeHint");
  assert.ok(!/tries/.test(body), "takeHint must not touch q.tries");
  assert.ok(/hinted\s*=\s*true/.test(body), "takeHint sets the hinted flag");
});

test("a hint cannot be taken twice on one showing", () => {
  const body = bodyOf("takeHint");
  assert.ok(
    /rt\.q\.hinted\b/.test(body) && /return/.test(body),
    "takeHint refuses a showing that is already hinted",
  );
  // ...and the control is gone rather than merely inert once taken.
  assert.ok(
    /hintReady && !q\.hinted/.test(SRC),
    "the Hint button renders only while the showing is unhinted",
  );
});

test("the hinted flag is frozen on the question at ask time, and so resets", () => {
  // The flag lives on `q` beside font / mc / grammarVehicle / grammarSelection,
  // which nextQuestion rebuilds wholesale for every card. Written flat at
  // construction rather than defaulted later, so a remount cannot carry a stale
  // true across to the next showing.
  const body = bodyOf("nextQuestion");
  assert.ok(
    /rt\.q = \{/.test(body),
    "nextQuestion builds the question object wholesale",
  );
  assert.ok(
    /hinted: false/.test(body),
    "a freshly asked card starts unhinted, which is the reset",
  );
});

test("the drill scores a hinted showing through the engine's one rule", () => {
  assert.ok(
    /firstTryCredit\(ok, q\.tries, q\.hinted\)/.test(SRC),
    "submit must defer to firstTryCredit rather than re-deriving the rule",
  );
});

test("a hint is only offered when there is one to give", () => {
  // Both entry points — the button and the "?" key — read the same
  // availability, so neither can spend the first-try credit on a card with
  // nothing to show.
  assert.ok(/hintReadyRef\.current = hintReady/.test(SRC));
  assert.ok(
    /if \(!hintReadyRef\.current\) return;/.test(bodyOf("takeHint")),
    "the keyboard path is gated on the same availability as the button",
  );
});
