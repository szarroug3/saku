// Which way the lesson's four cells are drawn, and what that choice means
// for the grid. Tracked as SAK-471.
//
// Sam, 2026-09-17: "i would like the bottom half of this page (the lesson
// details and tonight, in order) to be resizable or at least expandable so
// the user can make it fill up the full screen or something similar to the
// atlas page." The two by two (SAK-446) gives the top row a little under
// half the window, so a grammar pattern with its build table, its family and
// the pages behind it is a long read inside a short card. One press puts the
// sky and References away and gives the whole space under the heading to the
// details and the order; a second press brings the two by two back.
//
// PURE, and knows nothing about where the choice is kept. The browser's copy
// is the route layer's business (lesson-client.tsx), the way the lesson's
// place is (place.ts).

/** Two views of the same four cells: the two by two, or its bottom half with
 * the whole window. */
export type LessonView = "split" | "filled";

/** What a stored choice means, whatever the browser hands back. Anything
 * that is not the filled view is the two by two, so a key never written, a
 * key holding an older shape and a key holding rubbish all open the lesson
 * the way it has always opened. */
export function lessonView(raw: unknown): LessonView {
  return raw === "filled" ? "filled" : "split";
}

/** The view a press moves to. */
export function otherView(view: LessonView): LessonView {
  return view === "split" ? "filled" : "split";
}

/** Whether the sky and References are drawn at all.
 *
 * Only the split view has them. The filled view puts them away rather than
 * shrinking them to a strip, because a strip naming the open star says
 * nothing the card right under it does not already say in the biggest type
 * it has. Where the lesson stands is never lost with them: "Step n of N",
 * Back and Next are in the page's heading, which stays put and never
 * scrolls, so the lesson is walked from the filled view exactly as it is
 * from the two by two. */
export function skyShown(view: LessonView): boolean {
  return view === "split";
}

/** What the control says it will do, in the shape the Atlas's widen uses:
 * what you get, not what is showing now. */
export function viewLabel(view: LessonView): string {
  return view === "split" ? "Fill the screen with the details" : "Bring the sky back";
}

/** The rows the body grid is given, and the row its bottom two cells start
 * on.
 *
 * Both cells are given the SAME row in both views, which is what keeps the
 * card and the order exactly as tall as each other (SAK-446): one row of one
 * grid, rather than two columns agreeing by eye. In the filled view that row
 * is the only row, so it takes everything under the heading. */
export function lessonRows(view: LessonView): { body: string; bottom: string } {
  return view === "filled"
    ? { body: "lg:grid-rows-[minmax(0,1fr)]", bottom: "lg:row-start-1" }
    : { body: "lg:grid-rows-[minmax(180px,42%)_minmax(0,1fr)]", bottom: "lg:row-start-2" };
}
