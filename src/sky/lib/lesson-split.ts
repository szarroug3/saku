// How the lesson's left column is divided between the sky and the details
// card, and what a drag or a press does to it. Tracked as SAK-471.
//
// Sam, 2026-09-17: "i would like the bottom half of this page (the lesson
// details and tonight, in order) to be resizable or at least expandable so
// the user can make it fill up the full screen or something similar to the
// atlas page." Then, 2026-09-18: "i want the details panel to be the only
// expandable panel. it should be draggable and have a button similar to how
// the atlas can be dragged left. the references and tonight in order can stay
// as they are and not expand."
//
// So one number describes the whole thing: how much of the left column the SKY
// is given. The details card is given the rest, and the right column is given
// none of it, which is why References and "Tonight, in order" keep the boxes
// they have in the two by two whatever the learner drags.
//
// PURE, and it knows nothing about where the number is kept. The browser's
// copy is the route layer's business (lesson-client.tsx), the way the lesson's
// place is (place.ts).

/** The sky's share of the left column in the two by two (SAK-446), and the
 * largest share it is ever given. The right column's top panel is drawn at
 * exactly this share of the same height, so at rest the sky and References are
 * the same height and the card and the order are the same height, by
 * construction rather than by eye. The drag only ever takes room away from the
 * sky, so there is nothing to give References back. */
const SKY_SHARE = 0.42;

/** The shortest sky worth drawing, in pixels. Under this there is no sky to
 * look at, only a purple line above the card, so the sky is put away and the
 * card is given the whole column. A drag that ends between zero and this
 * lands on whichever of the two it is nearer. */
const MIN_SKY = 48;

/** How far one arrow key moves the handle, in pixels. Roughly a line of the
 * card's text, so a learner who cannot drag can still get anywhere by
 * holding a key down. */
const ARROW_STEP = 24;

/** The key the first cut of SAK-471 wrote, holding "split" or "filled" for a
 * control that is gone. Nothing reads it now and `lessonSplit` opens the two
 * by two for whatever it holds, so the route removes it once (SAK-471,
 * changes requested). */
export const OLD_VIEW_KEY = "sky:lesson:view";

/** What a stored share means, whatever the browser hands back. Anything that
 * is not a share in range opens the two by two: a key never written, the old
 * key's "filled", a number from a build that used other limits, rubbish. */
export function lessonSplit(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= SKY_SHARE ? raw : SKY_SHARE;
}

/** The share a drag lands on.
 *
 * `from` is the share the drag started at, `dy` is how far the pointer has
 * moved since (down is positive, and down gives the sky its room back),
 * `column` is the left column's height in pixels. The sky is never taller
 * than it is at rest, so the card can only grow from the two by two, which is
 * what keeps the right column's two panels where they are. */
export function dragSplit(from: number, dy: number, column: number): number {
  if (!(column > 0)) return from;
  const px = from * column + dy;
  if (px >= SKY_SHARE * column) return SKY_SHARE;
  if (px < MIN_SKY / 2) return 0;
  return Math.min(SKY_SHARE, Math.max(MIN_SKY, px) / column);
}

/** The share an arrow key lands on: up shrinks the sky and grows the card,
 * down does the opposite. One step from a put-away sky brings back the
 * shortest sky there is rather than nothing at all. */
export function stepSplit(share: number, up: boolean, column: number): number {
  return dragSplit(share, up ? -ARROW_STEP : ARROW_STEP, column);
}

/** Whether the sky is drawn beside the details at all. A share of zero is the
 * card with the whole left column: the press the round button makes, and the
 * end of the drag. */
export function skyShown(share: number): boolean {
  return share > 0;
}

/** The share the round button moves to: the whole column for the details, and
 * back to the two by two from there. */
export function pressedSplit(share: number): number {
  return share > 0 ? 0 : SKY_SHARE;
}

/** What the body grid is told: how tall its top row is, and how much room
 * there is between its rows. Both go to zero when the sky is put away, so the
 * card is given the whole column rather than the column less a gap. The right
 * column is not drawn in these rows at all, so neither number moves it. */
export function splitStyle(share: number): Record<string, string> {
  return share > 0
    ? { "--sky-row": `${Math.round(share * 1000) / 10}%`, "--sky-gap": "1rem" }
    : { "--sky-row": "0px", "--sky-gap": "0px" };
}

/** What the round button says it will do, in the shape the Atlas's widen
 * uses: what you get from the press, not what is showing now. */
export function splitLabel(share: number): string {
  return share > 0 ? "Pull the details all the way up" : "Put the sky back";
}

/** How much of the left column the details have, as a whole number of
 * percent, for the handle to report to assistive tech. 58 in the two by two
 * and 100 with the sky put away, which are the handle's own two ends. */
export function detailsPercent(share: number): number {
  return Math.round((1 - share) * 100);
}

/** The smallest the details are ever given, as a whole number of percent:
 * the other end of what `detailsPercent` reports. */
export function detailsFloor(): number {
  return detailsPercent(SKY_SHARE);
}
