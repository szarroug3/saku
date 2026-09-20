// How wide the Atlas entry panel is, and what a drag or an arrow key does to
// it. Tracked as SAK-471.
//
// Sam, 2026-09-20: "the atlas panel's width is plain state today and a reload
// puts it back to 360px; remember it in the browser the way the lesson
// remembers its height." So the arithmetic moved out of the component and into
// here, beside `lesson-split.ts`, for the same reason: it is worth a unit test
// and the component is not.
//
// TWO NUMBERS, NOT ONE. What the browser holds is a width the learner chose,
// and it is kept as they left it. What is drawn is that width brought inside
// the window in front of them, which is a smaller window on a laptop than on
// the screen it was written on, and is nothing at all until the page is in a
// browser. Keeping them apart is what lets a narrow window draw a narrow panel
// without writing that narrowness over the learner's choice.
//
// PURE, and it knows nothing about where the number is kept. The browser's
// copy is the route layer's business (atlas-client.tsx).

/** The panel's width to start, and the narrowest it can ever be dragged. */
const PANEL_MIN = 360;

/** The most of the window the panel may take. Past this the shelves beside it
 * are a sliver, and there is already a button that gives the panel everything
 * ("Widen this panel"), so the drag stops here. */
const PANEL_SHARE = 0.7;

/** How far one arrow key moves the line, in pixels. Wider than the lesson's
 * 24px step because there is more room to cross. */
const ARROW_STEP = 32;

/** The widest the panel may be in a window this wide. Never narrower than the
 * narrowest, so a tiny window still has a range rather than an empty one, and
 * a window whose width is not known yet (the server, and the first client
 * render, which has to match it) gets the narrowest. */
export function panelRoom(windowWidth: number): number {
  return Math.max(PANEL_MIN, Math.floor(windowWidth * PANEL_SHARE));
}

/** What a stored width means, whatever the browser hands back. Anything that
 * is not a width opens at the narrowest: a key never written, rubbish. The
 * window is not asked about here, so a width written on a wide screen is read
 * back whole and comes back when the window is wide again. */
export function panelWidth(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return PANEL_MIN;
  return Math.max(PANEL_MIN, Math.round(raw));
}

/** The width actually drawn: the width asked for, brought inside the window in
 * front of the learner. */
export function panelFit(width: number, windowWidth: number): number {
  return Math.min(panelRoom(windowWidth), panelWidth(width));
}

/** The width a drag lands on. `from` is the width the drag started at, `dx` is
 * how far the pointer has moved since (right is positive), and the panel is on
 * the right, so moving LEFT is what makes it wider. */
export function dragPanel(from: number, dx: number, windowWidth: number): number {
  return panelFit(from - dx, windowWidth);
}

/** The width an arrow key lands on: left widens the panel, right narrows it,
 * which is the way the line itself would travel. */
export function stepPanel(width: number, wider: boolean, windowWidth: number): number {
  return dragPanel(width, wider ? -ARROW_STEP : ARROW_STEP, windowWidth);
}

/** The narrowest the panel is ever drawn, for the grip to report to assistive
 * tech as the end of its range. */
export function panelFloor(): number {
  return PANEL_MIN;
}
