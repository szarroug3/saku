// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/registry.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { createRegistry } from "./registry.ts";

test("createRegistry — register, get, has, keys", () => {
  const r = createRegistry<string, number>();
  assert.equal(r.has("a"), false);
  assert.equal(r.get("a"), undefined);
  r.register("a", 1);
  r.register("b", 2);
  assert.equal(r.get("a"), 1);
  assert.equal(r.has("b"), true);
  assert.deepEqual([...r.keys()].sort(), ["a", "b"]);
});

test("createRegistry — a kind cannot be claimed twice", () => {
  // Two tracks registering the same kind is a wiring bug, not a silent override.
  const r = createRegistry<string, number>();
  r.register("word", 1);
  assert.throws(() => r.register("word", 2), /already registered/);
});
