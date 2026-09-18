"use client";

// The lesson's client side: the route's data or the browser's, the stroke
// order slot built here, and a star opened marked seen through the app's
// own call, so it is in rotation signed in or not.
//
// AND A LESSON YOU LEAVE IS HERE WHEN YOU COME BACK (SAK-444). Where the
// learner is in the order is written down the moment the lesson opens and
// after every step, beside the quiz left part way through and in the same
// document (quiz-run-store.ts), so the one Continue button can offer
// whichever of the two is newer. A lesson only picks up a place of its own:
// the same picks, in the same order, the way a quiz only picks up a run from
// the same source. Opening this page never looks at the quiz and never asks
// about it, because starting a lesson is not something that has to replace
// anything.
//
// THE STEPS ARE THE FIRST PART OF A SITTING, NOT THE WHOLE OF IT. The same
// slot carries the rounds and the breaks that follow, and the drill writes
// those (quiz-client.tsx). This page only ever writes the steps, and it
// writes them whenever the learner is here: walking back into the lesson from
// a round is a real move back to the steps.
//
// COMING BACK OPENS THE SAME STEP. Opening a star does not move it out of
// the order (SAK-446), so the order a resumed lesson walks is the one that
// was left, and the star the learner was on is opened again by id. If it is
// ever not in the order, the lesson opens where it would have anyway.

// AND A REFERENCE PAGE NOBODY HAS READ OPENS FIRST (SAK-467). References
// lists every page tonight's order rests on, every time; which of them this
// learner has already been shown is kept in the settings blob (pages-seen.ts),
// and a lesson opened fresh opens on the first page it has never shown, then
// walks the rest before step one. Every page in the lesson is marked shown the
// moment it opens, clicked or not, so the next lesson listing it opens on step
// one. A lesson picked up through Continue keeps SAK-444's place instead: it
// is handed no pages, and where it was left wins.
//
// AND THE DETAILS CARD IS AS TALL AS IT WAS LEFT (SAK-471). How far up the
// handle on the card's top edge was dragged is one key in this browser, read
// here and written on every drag.

import { useCallback, useEffect, useMemo, useRef } from "react";

import { HearButton } from "./hear-button";
import { SkyLesson, type SkyLessonData } from "@/sky/components/sky-lesson";
import { referencePages, unseenPages } from "@/sky/lib/lesson";
import { lessonSplit, OLD_VIEW_KEY } from "@/sky/lib/lesson-split";
import { hasPlace, lessonAt, lessonFor, NO_PLACE, type SavedPlace } from "@/sky/lib/place";

import { loadLesson } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { seePages, usePagesSeenAtOpen } from "./pages-seen";
import { PitchMark } from "./pitch-reading";
import { keepLesson, usePlaceAtOpen } from "./quiz-run-store";
import { readStored, useStored, writeStored } from "./stored";
import { WrittenBlock } from "./written-block";
import { seeId } from "./writes";

/** How much of the lesson's left column the sky was last left with (SAK-471).
 * This browser's, not this account's: it is how a learner likes to read on the
 * screen in front of them, the same as the Atlas panel's width, so it is kept
 * here rather than in the settings the account syncs. The pretend learner and
 * the showcase keep it too, since it is a choice about the window and not
 * about what anyone has learned. */
const LESSON_SKY_KEY = "sky:lesson:sky";

export function LessonClient({ sample, showcase, signedIn, initial, picks, accountPlace = NO_PLACE }: { sample: boolean; showcase: boolean; signedIn: boolean; initial: SkyLessonData | null; picks: readonly string[]; accountPlace?: SavedPlace }) {
  const load = useCallback((w: Parameters<typeof loadLesson>[0]) => loadLesson(w, picks), [picks]);
  const { data, loading } = useSkyData({ sample, signedIn, load, initial, eyebrow: "Lesson", title: "Tonight's lesson" });
  // The place this browser was holding when the page opened, read once: the
  // lesson writes it as it goes, and a live read would move the step it
  // resumes from underneath the learner. The pretend learner and the showcase
  // keep nothing, the way they record nothing.
  const local = usePlaceAtOpen();
  const kept = sample || showcase || !local ? null : lessonFor(hasPlace(local) ? local : accountPlace, picks);
  // the star to open on, which only the steps know: a sitting left in a round
  // or a break has no step of its own, so walking back here opens the lesson
  // where it would open anyway
  const startAt = kept?.part.kind === "steps" ? kept.part.star : undefined;
  const onPlace = useCallback(
    (place: { at: number; steps: number; star: string }) => {
      if (sample || showcase) return;
      keepLesson(lessonAt(picks, { kind: "steps", ...place }, Date.now()), signedIn);
    },
    [sample, showcase, picks, signedIn],
  );
  // Which reference pages this learner has already been shown, read once for
  // the reason the place is read once: the lesson marks its own pages the
  // moment it opens, and a live read would take its opening page out from
  // under it. The pretend learner and the showcase are handed none and keep
  // none, the way they record nothing: those two screens are a look at the
  // whole lesson, so they open on step one every time.
  const shown = usePagesSeenAtOpen();
  // How tall the card opens, and where a drag puts the new height. Read live
  // rather than once: nothing in the lesson depends on it but the layout, so a
  // second tab changing it is not a problem the way a moving place or a moving
  // page list would be.
  const startSky = lessonSplit(useStored<unknown>(LESSON_SKY_KEY, null));
  const onSky = useCallback((share: number) => writeStored(LESSON_SKY_KEY, share), []);
  // The first cut of SAK-471 had a control in the heading that filled the
  // window with both bottom panels, and this key held which of its two views
  // the lesson opened in. Sam asked for the card alone to grow instead, so the
  // control and the views are gone and the key is dead storage. It is taken
  // out once per page load rather than left in every browser that ever pressed
  // the old control.
  useEffect(() => { if (readStored<unknown>(OLD_VIEW_KEY, null) !== null) writeStored(OLD_VIEW_KEY, null); }, []);
  const references = data?.references;
  const pages = useMemo(() => referencePages(references ?? []), [references]);
  const openPages = useMemo(
    () => (sample || showcase || kept || !shown ? [] : unseenPages(references ?? [], shown)),
    [sample, showcase, kept, shown, references],
  );
  // Every page in tonight's lesson counts as shown from the moment the lesson
  // opens, clicked or not: the panel is beside the sky the whole time, and a
  // lesson that opened on it has done its part. Once per page load, and the
  // store writes nothing when it already holds all of them.
  const marked = useRef(false);
  useEffect(() => {
    if (sample || showcase || marked.current || !shown || !pages.length) return;
    marked.current = true;
    seePages(pages);
  }, [sample, showcase, shown, pages]);
  // The browser has not been asked yet, so which step this lesson opens on is
  // not known. The heading is, and it is drawn while the rest catches up
  // (SAK-356), rather than opening on the first step and jumping. It is the
  // same trade the quiz makes for the same reason, and it costs a signed-in
  // learner the server-rendered lesson they used to get.
  if (local === undefined || shown === undefined || !data) return loading;
  // the real stroke order for every character on the card, as a slot
  const written = Object.fromEntries(
    Object.keys(data.teach)
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && (i.kind === "kana" || i.kind === "kanji" || i.kind === "radical"))
      .map((i) => [i.id, <WrittenBlock key={i.id} glyph={i.glyph} />]),
  );
  const drillHref = skyHref("/quiz", { sample: sample || showcase, from: "observatory", picks });
  return (
    <SkyLesson
      data={data}
      drillHref={drillHref}
      observatoryHref={skyHref("/observatory", { sample })}
      written={written}
      hear={HearButton}
      pitch={PitchMark}
      onOpen={sample || showcase ? undefined : seeId}
      startAt={startAt}
      openPages={openPages}
      onPlace={sample || showcase ? undefined : onPlace}
      startSky={startSky}
      onSky={onSky}
    />
  );
}
