// A sky that is never panned shows everything it draws. Tracked as SAK-474.
//
// The sky is a WORLD of a fixed size and the box it is drawn in is a WINDOW
// onto it (see sky-canvas.tsx): a wide short box shows a wide short strip of
// the world and the rest is off screen. On the home that is the point, because
// the home is panned and zoomed. The lesson's band and the Observatory's "Your
// sky tonight" are never panned, so anything the window leaves out is not
// somewhere else, it is gone: a comet at the edge of the strip was drawn with
// its head in the band and its tail under the card below it, and a second pick
// a hundred units further down was not drawn at all.
//
// SAK-471 made the lesson's band open on the constellation the lesson is
// standing in, which put THAT one in the strip and left every other pick
// wherever it fell. So the centering moved the case rather than fixing it, and
// with the details card dragged up the band is 48 pixels tall and a strip that
// short holds almost nothing.
//
// The rule here is the whole fix: the window opens far enough out, and slides
// as little as it takes, for the box round every body to be inside it. The box
// round a body is its center grown by `bodyRoom`: how far the body is ever
// drawn plus the widest mark it can wear, so a star at the edge has room for
// the glow it gains when it is hovered or picked. Pure, and it knows nothing
// about SVG: the canvas hands it a window in sky units and gets a zoom and an
// offset back.

/** A rectangle of the world, in sky units. */
export interface SkyBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One body's center and the room it needs round it, in sky units. */
interface SkyBody {
  x: number;
  y: number;
  room: number;
}

/** The box round everything a sky draws, or null when it draws nothing.
 * Every body grown by its own room, so a comet's tail and a picked star's
 * halo are inside the box rather than hanging off it. */
export function boxAround(bodies: readonly SkyBody[]): SkyBox | null {
  if (bodies.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of bodies) {
    x0 = Math.min(x0, b.x - b.room);
    y0 = Math.min(y0, b.y - b.room);
    x1 = Math.max(x1, b.x + b.room);
    y1 = Math.max(y1, b.y + b.room);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * How much of a panel's LEFT and RIGHT edges a sky keeps clear of bodies, in
 * screen pixels.
 *
 * The panels a sky is drawn in have rounded corners -- `rounded-2xl`, 16px, on
 * the lesson's band, `rounded-xl` on the Observatory's preview -- and the curve
 * cuts the corner off the box the sky fills, so a body pushed right up against
 * a corner is drawn with a bite out of it. That is the second half of what
 * SAK-474 reported, and this is the widest of those corners.
 *
 * ACROSS ONLY, and that is exact rather than a saving. A rounded corner eats
 * only the square of its own radius at each end of each edge, so a body whose
 * box stands a radius in from the left and from the right is clear of all four
 * of them whatever its height. Keeping the same margin above and below would
 * cost a great deal for nothing: the lesson's band is 48 pixels at its floor,
 * and taking 16 off the top and bottom of that would halve every body in it to
 * stand clear of curves it was never near. The e2e measures the corners rather
 * than taking this reasoning on trust.
 */
export const EDGE = 16;

/**
 * The zoom a window opens at when it has to show `hold` whole.
 *
 * `win` is what the box shows at 100%, in sky units, LESS the edge kept clear
 * at each end. `most` is the zoom the sky would open at otherwise, and this
 * never goes above it: showing everything is a reason to draw the sky SMALLER,
 * never a reason to blow one constellation up to fill a band it used to share.
 *
 * A window with nothing left in it after the edge -- a hidden tab, the first
 * frame before the box is measured, a band narrower than its own corners -- is
 * not something to divide by, so it keeps `most` and the sliding below leaves
 * the view alone until there is a box to measure.
 */
export function zoomToShow(win: { w: number; h: number }, hold: SkyBox, most: number): number {
  if (!(win.w > 0) || !(win.h > 0)) return most;
  const across = hold.w > 0 ? win.w / hold.w : Infinity;
  const along = hold.h > 0 ? win.h / hold.h : Infinity;
  return Math.min(most, across, along);
}

/** Where a sky sits in its box: the world's top left, in window pixels. */
interface SkyAt {
  x: number;
  y: number;
}

/**
 * Where the world's top left goes, from where it would go on its own.
 *
 * `win` is the window in pixels, `k` the zoom, `at` the top left the sky
 * asked for (the middle it opens on, or the pan the learner left). Two rules,
 * in this order.
 *
 * THE WORLD'S EDGES DO NOT LEAVE THE WINDOW, and a world smaller than the
 * window is pinned to the top left, which is what the home has always done:
 * nothing on the sky ever moves, and the top looks the same.
 *
 * THEN `contain` IS HELD, whatever that costs the first rule (SAK-474), and
 * held by moving the sky AS LITTLE AS IT TAKES, so a band still opens as near
 * as it can to the constellation the lesson is standing in (SAK-471). The
 * window shows the world from `-at / k` to `(-at + w) / k`, so holding the
 * rectangle's near edge means `at >= -lo * k` and holding its far edge means
 * `at <= w - hi * k`. The world's own edges and the rectangle only disagree
 * when a body's room reaches past the world it was scattered into, and a strip
 * of empty sky beyond the world's edge beats a body drawn half outside the
 * panel. When the rectangle is wider than the window -- a zoom that could not
 * go far enough out, because it never goes past the zoom the sky would open at
 * anyway -- the near edge wins.
 *
 * `edge` is how much of the window is kept clear at each END, in the same sky
 * units, for the panel's rounded corners: see `EDGE`, which says why it is
 * across and not up and down. It shifts both ends by the same amount whatever
 * the zoom, so the zoom above and this agree.
 */
export function placeSky(win: { w: number; h: number }, world: { width: number; height: number }, k: number, at: SkyAt, contain?: SkyBox, edge = 0): SkyAt {
  const axis = (w: number, span: number, was: number) => (span * k <= w ? 0 : Math.min(0, Math.max(w - span * k, was)));
  const hold = (w: number, was: number, lo: number, span: number, clear: number) => (w > 0 && k > 0 ? Math.max(-lo * k + clear, Math.min(w - (lo + span) * k - clear, was)) : was);
  const x = axis(win.w, world.width, at.x), y = axis(win.h, world.height, at.y);
  if (!contain) return { x, y };
  return { x: hold(win.w, x, contain.x, contain.w, edge), y: hold(win.h, y, contain.y, contain.h, 0) };
}
