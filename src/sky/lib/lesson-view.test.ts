import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lessonRows, lessonView, otherView, skyShown, viewLabel, type LessonView } from "./lesson-view";

describe("lessonView", () => {
  it("reads the filled view back", () => {
    assert.equal(lessonView("filled"), "filled");
  });

  it("opens the two by two for a browser that has never said otherwise", () => {
    assert.equal(lessonView(null), "split");
    assert.equal(lessonView(undefined), "split");
  });

  it("opens the two by two for anything it does not understand", () => {
    for (const raw of ["split", "wide", true, 1, {}, ["filled"]]) assert.equal(lessonView(raw), "split");
  });
});

describe("otherView", () => {
  it("is what a press moves to, and two presses are where it started", () => {
    assert.equal(otherView("split"), "filled");
    assert.equal(otherView("filled"), "split");
    for (const view of ["split", "filled"] as LessonView[]) assert.equal(otherView(otherView(view)), view);
  });
});

describe("skyShown", () => {
  it("draws the sky and References in the two by two and not in the filled view", () => {
    assert.equal(skyShown("split"), true);
    assert.equal(skyShown("filled"), false);
  });
});

describe("viewLabel", () => {
  it("says what the press will do rather than what is showing", () => {
    assert.equal(viewLabel("split"), "Fill the screen with the details");
    assert.equal(viewLabel("filled"), "Bring the sky back");
  });
});

describe("lessonRows", () => {
  it("gives the card and the order one row in both views, so their heights match", () => {
    for (const view of ["split", "filled"] as LessonView[]) {
      const rows = lessonRows(view);
      assert.match(rows.bottom, /^lg:row-start-\d$/);
    }
  });

  it("puts the bottom two cells in the second of two rows in the two by two", () => {
    const rows = lessonRows("split");
    assert.equal(rows.body, "lg:grid-rows-[minmax(180px,42%)_minmax(0,1fr)]");
    assert.equal(rows.bottom, "lg:row-start-2");
  });

  it("gives the filled view one row, which the bottom two cells fill", () => {
    const rows = lessonRows("filled");
    assert.equal(rows.body, "lg:grid-rows-[minmax(0,1fr)]");
    assert.equal(rows.bottom, "lg:row-start-1");
  });
});
