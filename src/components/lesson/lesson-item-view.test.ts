// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/lesson/lesson-item-view.test.ts
//
// "How it's written" must not be mounted for a lesson step that has nothing to
// write about.
//
// THE BUG
// =======
// The section was mounted for EVERY step. On a grammar pattern (〜てから) and on
// a word (学生) there is no single glyph to look up, so the section printed
// "learned as a whole shape, the stroke-order diagram for this one isn't in
// yet." For a pattern that is nonsense — a pattern has no stroke order and
// never will. For a multi-kanji word it is worse than nonsense: each kanji has
// its own stroke order, and the app knows their counts.
//
// A kana keeps the section (it has a real diagram) and a KANJI keeps it too
// (no diagram ingested yet, but the stroke COUNT is real data and worth
// showing). Only word and grammar lose it.
//
// WHY THIS IS A SOURCE-SHAPE TEST
// ===============================
// LessonItemView is a React component and there is no renderer in this harness
// — the same reason lesson-prefs and strokes test their pure parts only. The
// gate is a one-line condition at the call site with no seam to call into, so
// what is pinned is the call site itself, the way stroke-order.test.ts pins the
// animate class and attribution.test.ts pins which files render what. If the
// gate is deleted or widened back to every track, this fails.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));

/** The call site with comments stripped, so the long explanatory block comment
 * above the gate cannot satisfy a match on its own. Both comment shapes go:
 * `/* … *​/` (which is also how a JSX `{/* … *​/}` comment is spelled inside)
 * and `//` to end of line. */
const SOURCE = readFileSync(resolve(HERE, "lesson-item-view.tsx"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

describe("the lesson gates How it's written on the track", () => {
  test("the call site is still there to check", () => {
    // A guard on the guard: a rename would make every assertion below pass
    // vacuously and quietly retire this test.
    assert.ok(
      SOURCE.includes("<HowItsWritten"),
      "lesson-item-view.tsx no longer renders <HowItsWritten> — was it renamed or moved? Update this test.",
    );
  });

  test("it is not mounted unconditionally", () => {
    // The bug's exact shape: the element sitting directly in the section list
    // with no expression in front of it. Whatever the gate is spelled as, the
    // last non-whitespace character before the element is part of it — `(` for
    // a ternary, `&&` for a guard — and never the `>` or `}` that would mean
    // the element is just the next sibling in the list.
    const before = SOURCE.slice(0, SOURCE.indexOf("<HowItsWritten")).trimEnd();
    assert.doesNotMatch(
      before,
      /[>}]\s*$/,
      "<HowItsWritten> is mounted for every step again - a word and a grammar\n" +
        "pattern have no stroke order and get the misleading whole-shape line.",
    );
  });

  /** The JSX expression that wraps the element, i.e. its gate. */
  const gate = /\{([^{}]*)\?\s*<HowItsWritten/.exec(SOURCE)?.[1] ?? "";

  test("kana and kanji keep the section", () => {
    assert.match(gate, /item\.kind\s*===\s*"kana"/, `gate was: ${gate.trim()}`);
    // Kanji legitimately keeps it: no diagram is ingested, but the stroke
    // COUNT is real and the section shows it.
    assert.match(gate, /item\.kind\s*===\s*"kanji"/, `gate was: ${gate.trim()}`);
  });

  test("word and grammar do not", () => {
    assert.doesNotMatch(gate, /"word"/, `gate was: ${gate.trim()}`);
    assert.doesNotMatch(gate, /"grammar"/, `gate was: ${gate.trim()}`);
  });
});
