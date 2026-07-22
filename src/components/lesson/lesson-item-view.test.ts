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
// A kana keeps the section (it has a real diagram), a KANJI keeps it (no diagram
// ingested yet, but the stroke COUNT is real data), and a RADICAL keeps it (same
// drawing). Only word, grammar and transitivity lose it.
//
// This used to be a regex over lesson-item-view.tsx — the gate is one line in a
// component with no renderer in this harness. That test asserted the SPELLING of
// the source, and its key `doesNotMatch` ran against a regex that fell back to
// "" when the gate was respelled, so it passed vacuously. The gate is now a pure
// predicate (lesson-items.showsHowItsWritten) the view calls straight through,
// so this tests the BEHAVIOUR instead. lesson-item-view.tsx: line reads
// `showsHowItsWritten(item.kind) ? <HowItsWritten … />`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { showsHowItsWritten } from "@/lib/lesson-items";
import type { LessonKind } from "@/lib/lesson-items";

describe("showsHowItsWritten — which tracks get the stroke section", () => {
  test("kana, kanji and radical keep it (real diagram or a real stroke count)", () => {
    assert.equal(showsHowItsWritten("kana"), true);
    assert.equal(showsHowItsWritten("kanji"), true);
    assert.equal(showsHowItsWritten("radical"), true);
  });

  test("word, grammar and transitivity do not — no single stroke order to show", () => {
    assert.equal(showsHowItsWritten("word"), false);
    assert.equal(showsHowItsWritten("grammar"), false);
    assert.equal(showsHowItsWritten("transitivity"), false);
  });

  test("every LessonKind has an explicit answer (no kind silently falls through)", () => {
    const kinds: LessonKind[] = [
      "kana",
      "radical",
      "kanji",
      "word",
      "grammar",
      "transitivity",
    ];
    for (const k of kinds) {
      assert.equal(typeof showsHowItsWritten(k), "boolean", `${k} answered`);
    }
  });
});
