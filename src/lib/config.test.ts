import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { fontLabel, JP_FONTS, pickFont } from "@/lib/config";

// No `document` in the plain node:test environment, so font-detect's
// SSR guard (`typeof document === "undefined"`) treats every family as
// available — the same "don't hide the whole pool over a check we can't
// run" behavior it uses server-side. That makes this the right place to
// pin pickFont's own selection logic without needing a real canvas.

describe("pickFont — the actual random-font-from-your-picks behavior", () => {
  test("only ever returns a font from the pool it was given", () => {
    const fonts = [JP_FONTS[0], JP_FONTS[1]];
    for (let i = 0; i < 50; i++) {
      const picked = pickFont(fonts);
      assert.ok(
        fonts.some((f) => picked === `${f}, sans-serif`),
        `${picked} not drawn from ${JSON.stringify(fonts)}`,
      );
    }
  });

  test("a single selected font always wins — the 'keep a few on' case in reverse", () => {
    const only = [JP_FONTS[3]];
    for (let i = 0; i < 10; i++) {
      assert.equal(pickFont(only), `${JP_FONTS[3]}, sans-serif`);
    }
  });

  test("an empty selection falls back to the full pool rather than crashing", () => {
    const picked = pickFont([]);
    assert.ok(
      JP_FONTS.some((f) => picked === `${f}, sans-serif`),
      `${picked} not from JP_FONTS`,
    );
  });

  test("varies across draws when more than one font is selected", () => {
    const fonts = [...JP_FONTS];
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickFont(fonts));
    // Over 100 draws from 8 fonts, landing on only one value would mean
    // the "random" part isn't actually random.
    assert.ok(seen.size > 1, "pickFont never varied across 100 draws");
  });

  test("always returns a usable font-family value", () => {
    const picked = pickFont([JP_FONTS[0]]);
    assert.match(picked, /, sans-serif$/);
  });
});

describe("fontLabel", () => {
  test("strips the quotes JP_FONTS wraps multi-word family names in", () => {
    assert.equal(fontLabel("'Hiragino Mincho ProN'"), "Hiragino Mincho ProN");
  });

  test("is a no-op on an already-bare name", () => {
    assert.equal(fontLabel("Klee"), "Klee");
  });
});
