// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/assembly-drag.test.ts
//
// SAK-90 round 2: Sam's live-tested bug report was "dragging a piece doesn't
// drop the piece where i hover. it always puts it at the end no matter what
// i do". Pins the fix: hovering the dragged piece's own rendered ghost slot
// (previewTrayOrder always renders it exactly at the current target) must
// leave the drop target unchanged, never fall through to the tray's
// empty-space "land at the end" fallback the way it did before this fix.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeDragOverIndex,
  DRAG_OVER_UNCHANGED,
  previewTrayOrder,
  trayWithoutDragged,
} from "./assembly-drag.ts";

describe("computeDragOverIndex — SAK-90 round 2 drop-position bug", () => {
  test("hovering a piece to its left targets its index (before its midpoint)", () => {
    const tray = ["A", "B", "C"];
    // Dragging D (a pool piece, not yet in the tray) over B, left half.
    const target = computeDragOverIndex(tray, "D", {
      kind: "piece",
      hoveredSurface: "B",
      pointerBeforeMidpoint: true,
    });
    assert.equal(target, 1);
  });

  test("hovering a piece to its right targets one past its index (after its midpoint)", () => {
    const tray = ["A", "B", "C"];
    const target = computeDragOverIndex(tray, "D", {
      kind: "piece",
      hoveredSurface: "B",
      pointerBeforeMidpoint: false,
    });
    assert.equal(target, 2);
  });

  test("hovering empty tray space lands at the end", () => {
    const tray = ["A", "B", "C"];
    const target = computeDragOverIndex(tray, "D", { kind: "tray-empty" });
    assert.equal(target, 3);
  });

  test("REGRESSION: hovering the dragged piece's own ghost slot leaves the target unchanged, not the end", () => {
    const tray = ["A", "B", "C"];
    // Reorder a tray piece: drag B leftward, ahead of A.
    const firstHover = computeDragOverIndex(tray, "B", {
      kind: "piece",
      hoveredSurface: "A",
      pointerBeforeMidpoint: true,
    });
    assert.equal(firstHover, 0);

    // previewTrayOrder now renders B at index 0 -- exactly where the pointer
    // is -- so the very next dragover event lands on B's own button, i.e.
    // the dragged piece hovering itself. Before the fix, the JSX handler for
    // this case returned early without stopPropagation, so the event bubbled
    // to the tray <ul>'s handler and this call effectively became
    // computeDragOverIndex(tray, "B", { kind: "tray-empty" }) => the end.
    const selfHover = computeDragOverIndex(tray, "B", {
      kind: "piece",
      hoveredSurface: "B",
      pointerBeforeMidpoint: true,
    });
    assert.equal(
      selfHover,
      DRAG_OVER_UNCHANGED,
      "self-hover must be a decided no-op, not fall through to end-of-tray",
    );
    // The caller (assembly-screen.tsx) only calls setDragOverIndex when the
    // result isn't DRAG_OVER_UNCHANGED, so the target held from firstHover.
    assert.notEqual(selfHover, tray.length);
  });

  test("REGRESSION: a drag that hovers back and forth across a piece and its own ghost slot still commits mid-tray, never the end", () => {
    // End-to-end simulation of computeDragOverIndex + previewTrayOrder
    // together, the same round-trip the component does across a sequence of
    // real dragover events, ending in what the drop would actually commit.
    const tray = ["A", "B", "C", "D"];
    const dragging = "D";

    // Drag D from the end up to just before B.
    let dragOverIndex = computeDragOverIndex(tray, dragging, {
      kind: "piece",
      hoveredSurface: "B",
      pointerBeforeMidpoint: true,
    });
    assert.equal(dragOverIndex, 1);

    let preview = previewTrayOrder(tray, dragging, dragOverIndex);
    assert.deepEqual(preview, ["A", "D", "B", "C"]);

    // The pointer hasn't moved, but the reflow just put D (the dragged
    // piece) exactly under it -- the next dragover event the DOM would fire
    // lands on D's own ghost slot.
    const next = computeDragOverIndex(tray, dragging, {
      kind: "piece",
      hoveredSurface: dragging,
      pointerBeforeMidpoint: true,
    });
    assert.equal(next, DRAG_OVER_UNCHANGED);
    if (next !== DRAG_OVER_UNCHANGED) dragOverIndex = next; // mirrors the component's guard

    // Drop commits at whatever dragOverIndex last held -- must still be 1,
    // not tray.length (the old bug's always-the-end symptom).
    assert.equal(dragOverIndex, 1);
    preview = previewTrayOrder(tray, dragging, dragOverIndex);
    assert.deepEqual(preview, ["A", "D", "B", "C"]);
    assert.notEqual(dragOverIndex, tray.length);
  });
});

describe("previewTrayOrder / trayWithoutDragged", () => {
  test("trayWithoutDragged removes only the dragged surface", () => {
    assert.deepEqual(trayWithoutDragged(["A", "B", "C"], "B"), ["A", "C"]);
    assert.deepEqual(trayWithoutDragged(["A", "B", "C"], null), ["A", "B", "C"]);
  });

  test("previewTrayOrder is a no-op when nothing is being dragged over the tray", () => {
    assert.deepEqual(previewTrayOrder(["A", "B", "C"], null, 1), ["A", "B", "C"]);
    assert.deepEqual(previewTrayOrder(["A", "B", "C"], "A", null), ["A", "B", "C"]);
  });

  test("previewTrayOrder inserts the dragged surface at the given index", () => {
    assert.deepEqual(previewTrayOrder(["A", "B", "C"], "D", 1), ["A", "D", "B", "C"]);
    assert.deepEqual(previewTrayOrder(["A", "B", "C"], "D", 0), ["D", "A", "B", "C"]);
    assert.deepEqual(previewTrayOrder(["A", "B", "C"], "D", 3), ["A", "B", "C", "D"]);
  });
});
