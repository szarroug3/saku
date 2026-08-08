// The "Also written as" panel is a four-column table — one row per variant form
// — not the prose sentence it used to be. No renderer in this harness, so this
// asserts the source: the four headers in order, a row per form, the position
// mapped to a single word, and that the old sentence is gone.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test \
//     src/components/lesson/variant-forms-panel.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const SOURCE = readFileSync(resolve(HERE, "variant-forms-panel.tsx"), "utf-8");
const NO_COMMENTS = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

describe("variant-forms panel", () => {
  test("keeps the 'Also written as' heading", () => {
    assert.match(NO_COMMENTS, /title="Also written as"/);
  });

  test("is a four-column table with the right headers, in order", () => {
    assert.match(NO_COMMENTS, /<table/);
    const headers = [...NO_COMMENTS.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map(
      (m) => m[1].trim(),
    );
    assert.deepEqual(headers, ["Appears as", "Side", "Called", "Example"]);
  });

  test("renders one row per form, mapping each of the four fields", () => {
    assert.match(NO_COMMENTS, /forms\.map\(\(form\)/);
    assert.match(NO_COMMENTS, /<Glyph>\{form\.glyph\}<\/Glyph>/);
    assert.match(NO_COMMENTS, /POSITION_WORD\[form\.position\]/);
    assert.match(NO_COMMENTS, /form\.name \?/);
    assert.match(NO_COMMENTS, /form\.example \?/);
  });

  test("maps every position to a single word, wraps read as enclosure", () => {
    for (const word of ["left", "right", "top", "bottom"]) {
      assert.match(NO_COMMENTS, new RegExp(`${word}: "${word}"`));
    }
    assert.match(NO_COMMENTS, /nyo: "enclosure"/);
    assert.match(NO_COMMENTS, /tare: "enclosure"/);
  });

  test("scrolls sideways on a narrow screen", () => {
    assert.match(NO_COMMENTS, /overflow-x-auto/);
  });

  test("is no longer the old prose sentence", () => {
    assert.doesNotMatch(NO_COMMENTS, /also appears as/i);
    assert.doesNotMatch(NO_COMMENTS, /, called /);
    assert.doesNotMatch(NO_COMMENTS, /as in /);
  });
});
