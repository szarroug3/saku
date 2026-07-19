import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { stemSplit } from "@/lib/word-fan";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const SOURCE = readFileSync(resolve(HERE, "word-form-fan.tsx"), "utf-8");
const NO_COMMENTS = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

describe("word-form fan", () => {
  test("highlights the changed tail from dictionary form", () => {
    assert.deepEqual(stemSplit("間違える", "間違えます"), {
      stem: "間違え",
      tail: "ます",
    });
    assert.deepEqual(stemSplit("する", "した"), {
      stem: "",
      tail: "した",
    });
  });

  test("renders branches from one root, not a chain", () => {
    assert.match(SOURCE, /rows\.filter\(\(r\) => r\.form !== "dictionary"\)/);
    assert.match(SOURCE, /border-l border-border/);
    assert.doesNotMatch(NO_COMMENTS, /→/);
  });
});
