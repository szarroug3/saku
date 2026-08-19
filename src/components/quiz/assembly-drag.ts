// The assembly screen's pointer-drag reorder math, pulled out of
// assembly-screen.tsx (a "use client" component with JSX, which the test
// runner's native TS loader cannot parse) so SAK-90's drop-target logic can
// be pinned with a plain node:test — see assembly-drag.test.ts.
//
// Everything here is display/decision-only: it never touches card.tray. The
// real commit still happens through dropPiece in assembly-screen.tsx.

/** The tray with the dragged surface removed, whichever origin it came from
 * (a pool piece isn't in the tray yet, so this is a no-op for that case). */
export function trayWithoutDragged(
  tray: readonly string[],
  draggingSurface: string | null,
): string[] {
  return draggingSurface === null
    ? [...tray]
    : tray.filter((s) => s !== draggingSurface);
}

/** What the tray would look like if the drag ended right now, dropped at
 * `index`. Purely for rendering the live reflow preview (SAK-90 ask #2); the
 * real commit happens in dropInTray on drop. */
export function previewTrayOrder(
  tray: readonly string[],
  draggingSurface: string | null,
  index: number | null,
): string[] {
  if (draggingSurface === null || index === null) return [...tray];
  const withoutDragged = trayWithoutDragged(tray, draggingSurface);
  const at = Math.min(Math.max(index, 0), withoutDragged.length);
  const next = withoutDragged.slice();
  next.splice(at, 0, draggingSurface);
  return next;
}

/** A single dragover event's target, as reported by the DOM handler that saw
 * it: either it landed over a specific rendered piece (with which side of
 * that piece's midpoint the pointer was on), or over empty tray space (the
 * tray `<ul>`'s own fallback, reached only when no piece's handler claimed
 * the event). */
export type DragOverEvent =
  | { kind: "piece"; hoveredSurface: string; pointerBeforeMidpoint: boolean }
  | { kind: "tray-empty" };

/** Sentinel returned by computeDragOverIndex when the event should leave the
 * current drop target unchanged (see the "piece" + self-hover case below). */
export const DRAG_OVER_UNCHANGED = -1;

/** The single source of truth for "where would this drag drop right now",
 * shared by the tray `<ul>`'s onDragOver and every piece `<button>`'s own
 * onDragOver in assembly-screen.tsx, so the two branches can never disagree
 * about what "empty space" versus "over a piece" means.
 *
 * SAK-90 round 2 root cause: the piece-level handler used to return early
 * (without stopPropagation) when the pointer was over the DRAGGED piece's
 * own rendered ghost slot -- previewTrayOrder always renders the dragged
 * piece exactly at the current target index, so that ghost slot sits right
 * under the pointer immediately after the first reflow. That early return
 * let the dragover event bubble to the tray `<ul>`'s own handler, which
 * unconditionally treated it as "empty space" and forced the target to the
 * end of the tray. Because dragover fires continuously while the pointer
 * holds still, the LAST event before drop was almost always this bubbled
 * one, so the drop landed at the end regardless of where the user hovered.
 *
 * The fix: hovering the dragged piece's own ghost slot is a real, decided
 * case here (DRAG_OVER_UNCHANGED, "keep the current target"), not a
 * fallthrough to the empty-space branch. The DOM handlers in
 * assembly-screen.tsx call preventDefault/stopPropagation unconditionally
 * whenever a drag is in flight, then defer the actual index decision to this
 * function -- so there's no code path left where self-hover can bubble. */
export function computeDragOverIndex(
  tray: readonly string[],
  draggingSurface: string,
  event: DragOverEvent,
): number {
  const withoutDragged = trayWithoutDragged(tray, draggingSurface);
  if (event.kind === "tray-empty") return withoutDragged.length;
  if (event.hoveredSurface === draggingSurface) return DRAG_OVER_UNCHANGED;
  const logicalIdx = withoutDragged.indexOf(event.hoveredSurface);
  return logicalIdx < 0
    ? withoutDragged.length
    : logicalIdx + (event.pointerBeforeMidpoint ? 0 : 1);
}
