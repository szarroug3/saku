// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test scripts/audit-voice-clips.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { compareClips, wantedFiles } from "./audit-voice-clips.mjs";

test("a stored clip no set lists is unwanted, and a listed clip not stored is missing", () => {
  const sets = { words: { items: () => [{ text: "a" }, { text: "b" }], path: (raw, v) => `voices/${v}/${raw.text}.opus` } };
  const wanted = wantedFiles(sets, ["x", "y"]);
  const stored = new Map([["x", new Set(["a.opus", "old.opus"])], ["y", new Set(["a.opus", "b.opus"])]]);
  const report = compareClips(stored, wanted);
  assert.deepEqual(report.get("x"), { stored: 2, wanted: 2, unwanted: ["old.opus"], missing: ["b.opus"] });
  assert.deepEqual(report.get("y"), { stored: 2, wanted: 2, unwanted: [], missing: [] });
});

test("the same clip listed by two sets is wanted once", () => {
  const def = { items: () => [{ text: "a" }], path: (raw, v) => `voices/${v}/${raw.text}.opus` };
  assert.equal(wantedFiles({ one: def, two: def }, ["x"]).get("x").size, 1);
});
