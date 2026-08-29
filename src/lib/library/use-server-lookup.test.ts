// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/use-server-lookup.test.ts
//
// SAK-241: "If a data lookup on Library/Learn fails once, it stays broken
// forever until the page is fully reloaded." Root cause was in `run`'s fetch
// path — `const value = await inFlight;` had no try/catch, so a rejected
// lookup's promise was set into the `pending` map (line `pending.set(k,
// inFlight)`) and NEVER removed on rejection. Every later mount for that same
// key (e.g. navigating back to the same view, which remounts the component
// and re-runs this effect) read `pending.get(k)` and got back that SAME
// already-rejected promise instead of calling `fn(...a)` again — permanently,
// since nothing but a full reload re-creates the module-scope `pending` Map
// fresh. A live repro (SAK-241 investigation) confirmed this exactly: an
// induced one-time failure left a mounted consumer on "loading" forever
// across any number of remounts, recovering only on an actual page reload.
//
// This module is "use client" and — per every other hook/component test in
// this directory (confusion-section.test.ts, character-entry-view.test.ts,
// etc.) — this runner has no React harness to mount it and drive its
// useEffect for a true integration test. So, like those, this verifies the
// fix structurally: the exact shape that was missing is now present.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SOURCE = readFileSync(
  fileURLToPath(new URL("./use-server-lookup.ts", import.meta.url)),
  "utf8",
);

test("the fetch await is wrapped in try/catch (was previously unguarded)", () => {
  assert.match(
    SOURCE,
    /try\s*\{\s*\n\s*const value = await inFlight;/,
    "`await inFlight` should be inside a try block, so a rejection is caught instead of crashing `run` uncaught",
  );
});

// The catch block that matters is the one immediately after the
// `await inFlight` line inside `run` — isolate the source from there on so a
// match can't accidentally land on one of this file's other, unrelated
// try/catch blocks (idbGet/idbSet/openDb all have their own).
const AFTER_AWAIT_INFLIGHT = SOURCE.slice(SOURCE.indexOf("await inFlight;"));

test("a rejected lookup evicts itself from the pending map", () => {
  const catchBlockMatch = AFTER_AWAIT_INFLIGHT.match(/\}\s*catch\s*\{([\s\S]*?)\n {6}\}/);
  assert.ok(catchBlockMatch, "expected a catch block following the try around `await inFlight`");
  const catchBody = catchBlockMatch[1];
  assert.match(
    catchBody,
    /pending\.get\(k\) === inFlight/,
    "the catch block should only evict the exact promise this call put in `pending` (a concurrent retry may have already replaced it)",
  );
  assert.match(
    catchBody,
    /pending\.delete\(k\)/,
    "the catch block must delete the failed promise from `pending` so a future mount's `pending.get(k) ?? fn(...a)` actually calls `fn` again instead of re-awaiting the same rejection",
  );
});

test("a rejection does not poison `cache` with an error value", () => {
  const catchBlockMatch = AFTER_AWAIT_INFLIGHT.match(/\}\s*catch\s*\{([\s\S]*?)\n {6}\}/);
  assert.ok(catchBlockMatch);
  const catchBody = catchBlockMatch[1];
  assert.doesNotMatch(
    catchBody,
    /cache\.set/,
    "the catch block must not write to `cache` — this hook's contract is that a cached value is a resolved one, and `cache.has(key)` staying false is what lets the next mount's effect guard (`if (... || cache.has(key)) return;`) fall through to a real retry",
  );
});

test("`void run(key, args)` has no attached .catch (rejections are handled inside `run` itself)", () => {
  assert.match(
    SOURCE,
    /void run\(key, args\);/,
    "run() is still called fire-and-forget — it must swallow its own rejections (see the try/catch tests above) rather than relying on a .catch here, since adding one without the internal try/catch would still leave `pending` poisoned forever",
  );
});
