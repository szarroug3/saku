import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const PANEL = readFileSync(new URL("./word-sense-panel.tsx", import.meta.url), "utf8");
const LIBRARY = readFileSync(
  new URL("../../app/library/[...entry]/page.tsx", import.meta.url),
  "utf8",
);

describe("reference-only dictionary readings", () => {
  test("the panel renders them in their own optional table", () => {
    assert.match(PANEL, /title="Other dictionary readings"/);
    assert.match(PANEL, /showReferenceReadings && referenceGroups\.length/);
    assert.match(PANEL, /groupsFor\("referenceReadings"\)/);
  });

  test("the Library opts in while lesson callers keep the teaching table", () => {
    assert.match(LIBRARY, /<WordSensePanel[\s\S]*?showReferenceReadings[\s\S]*?standings=/);
  });
});
