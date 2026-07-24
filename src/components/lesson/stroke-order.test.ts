// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/lesson/stroke-order.test.ts
//
// THE KEYFRAMES GUARD.
//
// WHAT WENT WRONG, AND WHY IT NEEDS A TEST
// ========================================
// The stroke-order draw-along used to be driven by an inline style string in
// stroke-order.tsx:
//
//     style={{ animation: `kvg-draw ${DRAW}s linear ...` }}
//
// with `@keyframes kvg-draw` sitting at the top level of globals.css. That
// looks fine and reads fine, and it shipped broken: NOTHING IN THE STYLESHEET
// referenced the name, so the CSS build treated the rule as dead and dropped
// it. (Turbopack's dev pipeline did; the production build happened to keep it,
// which is worse — it means the failure only showed up in the app you develop
// against.) The DOM still carried a perfectly valid `animation` shorthand, the
// computed stroke-dashoffset just never moved off 1, and the panel rendered as
// an empty writing guide. `path.getAnimations()` returned [] — no keyframes by
// that name existed to match.
//
// `gshake` and `kq-pairs-miss` survived the same build because the stylesheet
// itself mentions them: one via a `--animate-*` theme token, the other via a
// plain `.kq-pairs-miss { animation: ... }` rule. That is the difference, and
// that is what this test checks for.
//
// The diagram now LOOPS with no Replay button, so a re-broken animation is
// silent in a new way: there is no longer a control on screen hinting that
// anything was meant to move. A blank panel just looks like missing data.
//
// WHAT IT ASSERTS
// ===============
//  1. THE GENERAL INVARIANT: every `@keyframes NAME` in globals.css is
//     referenced from somewhere ELSE in globals.css — an `animation:` /
//     `animation-name:` declaration, or an `--animate-*` theme token. This is
//     the one that generalises: it fails for ANY future keyframes wired up only
//     from a JS style string, not just this one.
//  2. The specific wiring for the draw-along still holds end to end: the
//     keyframes exist, a `--animate-kvg-draw` token names them, and
//     stroke-order.tsx applies the resulting `animate-kvg-draw` class — which
//     is also what makes Tailwind emit the utility, since it scans source text.
//  3. stroke-order.tsx does not go back to an inline `animation:` shorthand.
//  4. The reduced-motion opt-out is still wired, and the loop is a real loop.
//
// WHAT IT WOULD NOT CATCH: a keyframes rule referenced by a selector that no
// element ever matches. Checking that needs a renderer, and the realistic
// mistake here was never that — it was the CSS build not being able to SEE the
// dependency at all.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { WRITTEN_VS_PRINTED } from "../../data/why.ts";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const SRC = resolve(HERE, "../..");

const CSS = readFileSync(resolve(SRC, "app/globals.css"), "utf-8");
const TSX = readFileSync(resolve(HERE, "stroke-order.tsx"), "utf-8");

/** globals.css with /* … *​/ comments stripped, so a keyframes name that only
 * appears in prose does not count as a reference. */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, " ");

/** Names of every @keyframes rule declared in globals.css. */
function declaredKeyframes(css: string): string[] {
  return [...css.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}

/**
 * Does the stylesheet itself reference `name` as an animation — i.e. would the
 * CSS build see the keyframes as live?
 *
 * Two shapes count, matching the two the app already uses:
 *   `--animate-x: name …;`        (Tailwind theme token → generated utility)
 *   `animation: … name …;`        (a plain rule, incl. animation-name)
 * The @keyframes declaration itself is excluded, or everything passes.
 */
function referencedInCss(css: string, name: string): boolean {
  const withoutDecls = css.replace(
    new RegExp(`@keyframes\\s+${name}\\b`, "g"),
    " ",
  );
  const inAnimationValue = new RegExp(
    `(--animate-[\\w-]+|animation(?:-name)?)\\s*:[^;{}]*\\b${name}\\b`,
  );
  return inAnimationValue.test(withoutDecls);
}

describe("globals.css keyframes are visible to the CSS build", () => {
  test("every @keyframes is referenced from the stylesheet itself", () => {
    const names = declaredKeyframes(CSS_CODE);
    assert.ok(names.length > 0, "expected globals.css to declare keyframes");

    const orphans = names.filter((n) => !referencedInCss(CSS_CODE, n));
    assert.deepEqual(
      orphans,
      [],
      `@keyframes declared but never referenced from globals.css: ${orphans.join(", ")}.\n` +
        "A keyframes name used only from a JS/inline style string is invisible to the\n" +
        "CSS build, which drops the rule — the element keeps a valid `animation`\n" +
        "shorthand and silently never animates. Drive it from CSS instead: add a\n" +
        "`--animate-<name>` token in @theme and apply the generated `animate-<name>`\n" +
        "class, passing anything per-element as a custom property.",
    );
  });

  // The invariant above would still pass if the draw-along were rewired to some
  // OTHER keyframes and this one left behind, or if the component stopped using
  // the class. These pin the actual chain.
  test("the draw-along is wired keyframes → theme token → component class", () => {
    assert.match(
      CSS_CODE,
      /@keyframes\s+kvg-draw\s*\{/,
      "globals.css no longer declares @keyframes kvg-draw",
    );
    assert.ok(
      referencedInCss(CSS_CODE, "kvg-draw"),
      "nothing in globals.css references the kvg-draw keyframes",
    );
    assert.match(
      CSS_CODE,
      /--animate-kvg-draw:\s*kvg-draw\b/,
      "expected a --animate-kvg-draw theme token naming the kvg-draw keyframes",
    );
    assert.match(
      TSX,
      /className=\{?[^}\n]*animate-kvg-draw/,
      "stroke-order.tsx must apply the animate-kvg-draw class — that literal is\n" +
        "also how Tailwind's source scan learns to emit the utility",
    );
  });

  test("stroke-order.tsx drives the animation from CSS, not an inline shorthand", () => {
    assert.doesNotMatch(
      TSX,
      /\banimation:\s*[`"']/,
      "an inline `animation:` style string is the bug this file exists to prevent",
    );
  });

  test("it loops, and reduced motion still opts all the way out", () => {
    assert.match(
      CSS_CODE,
      /--animate-kvg-draw:[^;]*\binfinite\b/,
      "the draw-along is meant to loop; the theme token no longer says infinite",
    );
    assert.match(
      TSX,
      /prefers-reduced-motion:\s*reduce/,
      "stroke-order.tsx must still consult prefers-reduced-motion",
    );
    // Under reduce the class must not be applied at all — a looping animation
    // is precisely what that media query exists to suppress.
    assert.match(
      TSX,
      /animate\s*\?\s*"animate-kvg-draw"\s*:\s*undefined/,
      "the animate-kvg-draw class must be conditional on the non-reduced branch",
    );
  });
});

// The diagram is a HANDWRITING model and the headword beside it is a typeface.
// They do not trace over each other on every character (人 is the one people
// notice), and neither is wrong, so the app says so instead of pretending
// otherwise. These pin the saying-so: that the note is still on screen, and that
// it still reads like a person rather than a spec.
describe("the diagram says which shape it is showing", () => {
  test("the note is rendered, from the one place the copy lives", () => {
    assert.match(
      TSX,
      /WRITTEN_VS_PRINTED/,
      "stroke-order.tsx must render WRITTEN_VS_PRINTED under the diagram — without\n" +
        "it a learner sees a handwritten shape and a printed one and is left to work\n" +
        "out on their own that both are the same character",
    );
    assert.match(
      TSX,
      /from "@\/data\/why"/,
      "the note must be imported from src/data/why.ts, not retyped here; two copies\n" +
        "of one sentence is how they drift",
    );
  });

  test("it follows the copy rules and closes on the reassurance", () => {
    assert.ok(
      !WRITTEN_VS_PRINTED.includes("—"),
      "no em dash in learner-facing copy",
    );
    assert.ok(
      !/\brather than\b/.test(WRITTEN_VS_PRINTED),
      'no "X rather than Y" in learner-facing copy',
    );
    // The same close the kana glyph-variant notes use (src/data/characters.ts).
    // The point of the note is not that the shapes differ, it is that differing
    // does not make them two characters.
    assert.match(
      WRITTEN_VS_PRINTED,
      /same character/,
      "the note must end on the reassurance that both shapes are one character",
    );
  });

  test("it talks about the language, never about the app", () => {
    for (const word of ["click", "button", "page", "screen", "tap", "section"]) {
      assert.ok(
        !new RegExp(`\\b${word}`, "i").test(WRITTEN_VS_PRINTED),
        `the note must not narrate the app; found "${word}"`,
      );
    }
  });
});
