import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detailsFloor, detailsPercent, dragSplit, lessonSplit, OLD_VIEW_KEY, pressedSplit, skyShown, splitLabel, splitStyle, stepSplit } from "./lesson-split";

/** The share the two by two opens at, read back through the module rather
 * than named again here, so a change to it cannot leave the test agreeing
 * with itself. */
const REST = lessonSplit(null);
/** A left column the size the lesson has at 1440 by 900. */
const COLUMN = 738;

describe("lessonSplit", () => {
  it("opens the two by two for a browser that has never said otherwise", () => {
    assert.equal(lessonSplit(null), REST);
    assert.equal(lessonSplit(undefined), REST);
  });

  it("reads a share the learner dragged to back", () => {
    assert.equal(lessonSplit(0), 0);
    assert.equal(lessonSplit(0.2), 0.2);
    assert.equal(lessonSplit(REST), REST);
  });

  it("opens the two by two for the old key's value, which is no longer a share", () => {
    assert.equal(OLD_VIEW_KEY, "sky:lesson:view");
    assert.equal(lessonSplit("filled"), REST);
    assert.equal(lessonSplit("split"), REST);
  });

  it("opens the two by two for anything out of range or not a number", () => {
    for (const raw of [-0.1, 0.9, 1, Number.NaN, Number.POSITIVE_INFINITY, true, "0.2", {}, [0.2]]) {
      assert.equal(lessonSplit(raw), REST);
    }
  });
});

describe("dragSplit", () => {
  it("gives the card the room the sky loses as the handle goes up", () => {
    const half = dragSplit(REST, -100, COLUMN);
    assert.ok(half < REST);
    assert.equal(Math.round(half * COLUMN), Math.round(REST * COLUMN) - 100);
  });

  it("never gives the sky more than it has in the two by two", () => {
    assert.equal(dragSplit(REST, 200, COLUMN), REST);
    assert.equal(dragSplit(0.2, 4000, COLUMN), REST);
  });

  it("puts the sky away once there is no sky left to look at", () => {
    assert.equal(dragSplit(REST, -COLUMN, COLUMN), 0);
    assert.equal(skyShown(dragSplit(REST, -COLUMN, COLUMN)), false);
  });

  it("keeps a short sky drawable rather than letting it thin to a line", () => {
    // 40px of sky is nearer a sky than nothing, so it opens at the shortest
    // one there is; 10px is nearer nothing, so the sky is put away
    assert.ok(dragSplit(REST, 40 - REST * COLUMN, COLUMN) * COLUMN >= 48);
    assert.equal(dragSplit(REST, 10 - REST * COLUMN, COLUMN), 0);
  });

  it("stays where it is when the column has no height to divide", () => {
    assert.equal(dragSplit(0.3, -200, 0), 0.3);
    assert.equal(dragSplit(0.3, -200, Number.NaN), 0.3);
  });

  it("is where it started when a drag goes out and comes back", () => {
    const up = dragSplit(REST, -120, COLUMN);
    assert.ok(Math.abs(dragSplit(up, 120, COLUMN) - REST) < 1e-9);
  });
});

describe("stepSplit", () => {
  it("moves the handle by a line of text in either direction", () => {
    const up = stepSplit(REST, true, COLUMN);
    assert.equal(Math.round(up * COLUMN), Math.round(REST * COLUMN) - 24);
    assert.ok(Math.abs(stepSplit(up, false, COLUMN) - REST) < 1e-9);
  });

  it("brings a put-away sky back rather than leaving the key dead", () => {
    assert.ok(skyShown(stepSplit(0, false, COLUMN)));
    assert.equal(stepSplit(0, true, COLUMN), 0);
  });

  it("stops at the two by two going down", () => {
    assert.equal(stepSplit(REST, false, COLUMN), REST);
  });
});

describe("pressedSplit", () => {
  it("is the whole column for the details, and the two by two back from there", () => {
    assert.equal(pressedSplit(REST), 0);
    assert.equal(pressedSplit(0.1), 0);
    assert.equal(pressedSplit(0), REST);
    assert.equal(pressedSplit(pressedSplit(REST)), REST);
  });
});

describe("splitStyle", () => {
  it("gives the top row the sky's share and a gap under it", () => {
    assert.deepEqual(splitStyle(REST), { "--sky-row": "42%", "--sky-gap": "1rem" });
    assert.deepEqual(splitStyle(0.2), { "--sky-row": "20%", "--sky-gap": "1rem" });
  });

  it("drops the row and the gap with it, so the card has the whole column", () => {
    assert.deepEqual(splitStyle(0), { "--sky-row": "0px", "--sky-gap": "0px" });
  });

  it("rounds the row to a tenth of a percent, which is under a pixel", () => {
    assert.equal(splitStyle(1 / 3)["--sky-row"], "33.3%");
  });
});

describe("splitLabel", () => {
  it("says what the press will do rather than what is showing", () => {
    assert.equal(splitLabel(REST), "Pull the details all the way up");
    assert.equal(splitLabel(0), "Put the sky back");
  });
});

describe("detailsPercent", () => {
  it("reports the details' own share, from the two by two to the whole column", () => {
    assert.equal(detailsPercent(REST), 58);
    assert.equal(detailsPercent(0), 100);
    assert.equal(detailsFloor(), 58);
    assert.ok(detailsPercent(0.2) > detailsFloor());
  });
});
