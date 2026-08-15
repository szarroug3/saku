import assert from "node:assert/strict";
import { test } from "node:test";

import { contentRowsNeedingUpsert } from "@/lib/library/content-seed-delta";

const local = [
  { entry_id: "same", kind: "word", content_version: "v1", payload: { n: 1 } },
  { entry_id: "changed", kind: "word", content_version: "v2", payload: { n: 2 } },
  { entry_id: "reclassified", kind: "kanji", content_version: "v1", payload: {} },
  { entry_id: "missing", kind: "grammar", content_version: "v1", payload: {} },
];

test("the content seed writes only missing or stale rows", () => {
  const remote = [
    { entry_id: "same", kind: "word", content_version: "v1" },
    { entry_id: "changed", kind: "word", content_version: "old" },
    { entry_id: "reclassified", kind: "word", content_version: "v1" },
    { entry_id: "remote-only", kind: "term", content_version: "v1" },
  ];

  assert.deepEqual(
    contentRowsNeedingUpsert(local, remote).map((row) => row.entry_id),
    ["changed", "reclassified", "missing"],
  );
});

test("the content seed is a no-op when every local identity matches", () => {
  assert.deepEqual(contentRowsNeedingUpsert(local, local), []);
});
