import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const TEACH_WALK = readFileSync(resolve(HERE, "teach-walk.tsx"), "utf-8");
const SO_TEACH_WALK = readFileSync(
  resolve(HERE, "sentence-ordering-teach-walk.tsx"),
  "utf-8",
);
const HOW_ITS_WRITTEN = readFileSync(
  resolve(HERE, "../lesson/how-its-written.tsx"),
  "utf-8",
);

// The teach walk shows the SAME flat-aware section panels the Library entry page
// does (LessonPanel, WordSensePanel, VerbPairView, KeigoSetView, the intro
// panels, Card). Those flatten by WHERE they render — a surrounding
// FlatSurfaceProvider — so the teach walk must wrap its item content in that
// provider for the panels to go flat there exactly as on the entry page. Without
// the wrapper the panels frost, which is the bug this guards against.
describe("teach walk flat section surfaces", () => {
  test("the main teach walk wraps its item content in FlatSurfaceProvider", () => {
    assert.match(TEACH_WALK, /import \{[^}]*FlatSurfaceProvider[^}]*\}/);
    // The provider sits around the item render, so TeachItemView / PhaseIntroView
    // and their section panels drop the frosty fill and keep the border.
    assert.match(
      TEACH_WALK,
      /<FlatSurfaceProvider>[\s\S]*<TeachItemView[\s\S]*<\/FlatSurfaceProvider>/,
    );
  });

  test("the sentence-ordering teach walk wraps its intro in FlatSurfaceProvider", () => {
    assert.match(SO_TEACH_WALK, /import \{[^}]*FlatSurfaceProvider[^}]*\}/);
    assert.match(
      SO_TEACH_WALK,
      /<FlatSurfaceProvider>[\s\S]*<PhaseIntroView[\s\S]*<\/FlatSurfaceProvider>/,
    );
  });

  // "How it's written" is a section panel too, but in the stepped lesson it does
  // not render through Card/LessonPanel — it hand-rolls its collapsed-form box.
  // For it to go flat in the teach walk like every other section panel, that box
  // must consult the flat surface itself (bg-transparent when flat, bg-panel
  // otherwise), matching LessonPanel's fork. This guards that it keeps doing so.
  test("the how-it's-written collapsed box honors the flat surface", () => {
    assert.match(HOW_ITS_WRITTEN, /import \{[^}]*useFlatSurface[^}]*\}/);
    // On a flat surface it now drops the box ENTIRELY — the redesign made these
    // sections borderless rather than transparent-boxed — returning the content
    // bare; off a flat surface it keeps its bg-panel box.
    assert.match(HOW_ITS_WRITTEN, /if \(flatSurface\)\s*\{\s*return <>\{content\}<\/>;/);
    assert.match(HOW_ITS_WRITTEN, /bg-panel/);
  });
});
