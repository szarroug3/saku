// Run: node --test src/components/library/confusion-section.test.ts
//
// SAK-155: ConfusionSection's "Commonly mixed up with" rows now carry an
// optional `tip` (a hand-authored radical-pair explanation, e.g. 口 vs 囗) —
// see resolveConfusableRows (server-lookups.ts) and radical-tips.ts for where
// the tip is actually computed. This module is "use client" with no React
// harness in this test runner (see character-entry-view.test.ts's own note
// for the same constraint), so it is verified structurally: the row renders
// `row.tip` when present, and `ConfusionSection` threads its own `glyph` prop
// through to `resolveConfusableRows` so the tip can be scoped to the right
// pair (not just "this glyph appears somewhere in the list" — see that
// function's own doc on the 日/目/曰 false-positive it guards against).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SOURCE = readFileSync(
  fileURLToPath(new URL("./confusion-section.tsx", import.meta.url)),
  "utf8",
);

test("ConfusionSection accepts a `glyph` prop and passes it to resolveConfusableRows", () => {
  assert.match(SOURCE, /glyph\?:\s*string/, "ConfusionSection should take an optional glyph prop");
  assert.match(
    SOURCE,
    /useServerLookup\(resolveConfusableRows, \[allIds, glyph\]\)/,
    "the glyph prop should be threaded into resolveConfusableRows' args",
  );
});

test("a row renders row.tip as prose when present, and nothing when absent", () => {
  assert.match(
    SOURCE,
    /row\.tip \?/,
    "ConfusableRow should conditionally render row.tip",
  );
});
