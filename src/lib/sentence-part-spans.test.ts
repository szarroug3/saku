import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assemblyRoleSpans } from "./sentence-part-spans.ts";

// The same "simple" item shape used in assembly-check.test.ts: 私は/それを/言う。
const SIMPLE_PIECES = [{ t: "私は" }, { t: "それを" }, { t: "言う。" }];

describe("assemblyRoleSpans (SAK-50 changes-requested pass)", () => {
  test("positions each canonical piece by cumulative length, in the tier's role order", () => {
    const result = assemblyRoleSpans(SIMPLE_PIECES, "simple");
    assert.ok(result);
    assert.deepEqual(result.spans, [
      { part: "topic", text: "私は", start: 0, end: 2 },
      { part: "core", text: "それを", start: 2, end: 5 },
      { part: "ending", text: "言う。", start: 5, end: 8 },
    ]);
    assert.equal(result.labels.topic, "Topic");
    assert.equal(result.labels.core, "Object/detail");
    assert.equal(result.labels.ending, "Final predicate");
  });

  test("returns null for an unknown tier", () => {
    assert.equal(assemblyRoleSpans(SIMPLE_PIECES, null), null);
  });

  test("returns null when the piece count doesn't match the tier's role count", () => {
    assert.equal(assemblyRoleSpans(SIMPLE_PIECES.slice(0, 2), "simple"), null);
  });
});
