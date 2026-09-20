import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dragPanel, panelFit, panelFloor, panelRoom, panelWidth, stepPanel } from "./atlas-panel";

/** The narrowest the panel is ever drawn, read back through the module rather
 * than named again here, so a change to it cannot leave the test agreeing with
 * itself. */
const MIN = panelFloor();
/** A window the size Sam reviews at. */
const WINDOW = 1440;

describe("panelRoom", () => {
  it("is most of the window, so the shelves beside the panel are still there", () => {
    assert.equal(panelRoom(WINDOW), Math.floor(WINDOW * 0.7));
    assert.ok(panelRoom(WINDOW) < WINDOW);
  });

  it("is the narrowest width in a window too small to share, and before one is known", () => {
    assert.equal(panelRoom(0), MIN);
    assert.equal(panelRoom(400), MIN);
  });
});

describe("panelWidth", () => {
  it("opens at the narrowest for a browser that has never said otherwise", () => {
    assert.equal(panelWidth(null), MIN);
    assert.equal(panelWidth(undefined), MIN);
  });

  it("reads a width the learner dragged to back", () => {
    assert.equal(panelWidth(640), 640);
    assert.equal(panelWidth(MIN), MIN);
  });

  it("opens at the narrowest for anything that is not a width", () => {
    for (const raw of [Number.NaN, Number.POSITIVE_INFINITY, true, "640", {}, [640]]) {
      assert.equal(panelWidth(raw), MIN);
    }
  });

  it("never narrows a stored width to the window, so a wide screen gets it back", () => {
    // the window is not asked about here at all: that is `panelFit`'s job, and
    // keeping the two apart is what stops a laptop writing its own narrowness
    // over the width the learner chose on a bigger screen
    assert.equal(panelWidth(2000), 2000);
    assert.equal(panelWidth(-50), MIN);
  });

  it("is a whole number of pixels, whatever the browser held", () => {
    assert.equal(panelWidth(500.4), 500);
  });
});

describe("panelFit", () => {
  it("draws the width asked for when the window has room for it", () => {
    assert.equal(panelFit(640, WINDOW), 640);
  });

  it("brings a width from a bigger screen inside this window", () => {
    assert.equal(panelFit(2000, WINDOW), panelRoom(WINDOW));
    assert.equal(panelFit(2000, 800), panelRoom(800));
  });

  it("is the narrowest before the window's width is known, which is what the server drew", () => {
    assert.equal(panelFit(640, 0), MIN);
  });
});

describe("dragPanel", () => {
  it("widens the panel as the line goes left, since the panel is on the right", () => {
    assert.equal(dragPanel(MIN, -100, WINDOW), MIN + 100);
    assert.equal(dragPanel(MIN + 200, 100, WINDOW), MIN + 100);
  });

  it("stops at the narrowest and at the widest", () => {
    assert.equal(dragPanel(MIN, 400, WINDOW), MIN);
    assert.equal(dragPanel(MIN, -4000, WINDOW), panelRoom(WINDOW));
  });

  it("is where it started when a drag goes out and comes back", () => {
    const wider = dragPanel(MIN, -120, WINDOW);
    assert.equal(dragPanel(wider, 120, WINDOW), MIN);
  });
});

describe("stepPanel", () => {
  it("moves the line by a step in either direction", () => {
    const wider = stepPanel(MIN, true, WINDOW);
    assert.equal(wider, MIN + 32);
    assert.equal(stepPanel(wider, false, WINDOW), MIN);
  });

  it("stops at the narrowest going the other way", () => {
    assert.equal(stepPanel(MIN, false, WINDOW), MIN);
  });

  it("stops at the widest the window allows", () => {
    assert.equal(stepPanel(panelRoom(WINDOW), true, WINDOW), panelRoom(WINDOW));
  });
});
