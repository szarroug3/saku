// The Sky's standings are the app's six words, and this is how they read and
// paint. The decision that picks one of them is the app's and is not copied
// here any more: see the header of standing.ts.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STANDING, STANDING_ORDER, standingWord } from "@/sky/lib/standing";

describe("the standings as words", () => {
  it("a standing shown on its own gets its first letter only, never every word", () => {
    // SAK-363: CSS `capitalize` was writing "Getting There" in the legend, the
    // Atlas rail and the practice chips while the rest of the app said
    // "Getting there".
    assert.equal(standingWord("getting-there"), "Getting there");
    assert.equal(standingWord("not-seen"), "Undiscovered");
    for (const s of STANDING_ORDER) assert.equal(standingWord(s).slice(1), STANDING[s].label.slice(1));
  });

  it("every standing paints through its own alias token, and only not seen borrows muted for text", () => {
    for (const s of STANDING_ORDER) {
      assert.equal(STANDING[s].dot, `bg-sky-${s}`);
      assert.equal(STANDING[s].text, s === "not-seen" ? "text-sky-muted" : `text-sky-${s}`);
      assert.ok(STANDING[s].label.length > 0 && STANDING[s].meaning.length > 0);
    }
  });

  it("the order is best first, with the two the app has no evidence for last", () => {
    assert.deepEqual(STANDING_ORDER, ["solid", "getting-there", "shaky", "slipping", "claimed", "not-seen"]);
    assert.equal(new Set(STANDING_ORDER).size, Object.keys(STANDING).length, "every word in the table is ordered, and only once");
  });
});
