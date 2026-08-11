import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const PANEL = readFileSync(new URL("./word-sense-panel.tsx", import.meta.url), "utf8");
// The word REFERENCE page is now CharacterEntryView (the redesign folded the
// multi-char word page into the one character view); WordSensePanel is the
// LESSON's teaching table now, not the library's.
const CHARACTER_VIEW = readFileSync(
  new URL("../library/character-entry-view.tsx", import.meta.url),
  "utf8",
);

describe("reference-only dictionary readings", () => {
  test("the panel renders them in their own optional table", () => {
    assert.match(PANEL, /title="Other dictionary readings"/);
    assert.match(PANEL, /showReferenceReadings && referenceGroups\.length/);
    assert.match(PANEL, /groupsFor\("referenceReadings"\)/);
  });

  test("the Library word page shows every reading, off wordSensesOf", () => {
    // The reference page keeps the full set of a word's readings — one row per
    // reading — via wordSensesOf, so a multi-reading word (主) reads them all.
    // Standings are gone from the reference page on purpose (the drill bar is the
    // progress surface now), so this no longer asserts them.
    assert.match(CHARACTER_VIEW, /wordSensesOf/);
  });
});
