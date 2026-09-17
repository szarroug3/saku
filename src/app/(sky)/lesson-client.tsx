"use client";

// The lesson's client side: the route's data or the browser's, the stroke
// order slot built here, and a star opened marked seen through the app's
// own call, so it is in rotation signed in or not.
//
// AND A LESSON YOU LEAVE IS HERE WHEN YOU COME BACK (SAK-444). Where the
// learner is in the order is written down after every step, beside the quiz
// left part way through and in the same document (quiz-run-store.ts), so the
// one Continue button can offer whichever of the two is newer. A lesson only
// picks up a place of its own: the same picks, in the same order, the way a
// quiz only picks up a run from the same source. Opening this page never
// looks at the quiz and never asks about it, because starting a lesson is
// not something that has to replace anything.
//
// COMING BACK OPENS THE SAME STEP. Opening a star does not move it out of
// the order (SAK-446), so the order a resumed lesson walks is the one that
// was left, and the star the learner was on is opened again by id. If it is
// ever not in the order, the lesson opens where it would have anyway.

import { useCallback } from "react";

import { HearButton } from "./hear-button";
import { SkyLesson, type SkyLessonData } from "@/sky/components/sky-lesson";
import { hasPlace, lessonToKeep, NO_PLACE, samePicks, type SavedPlace } from "@/sky/lib/place";

import { loadLesson } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { PitchMark } from "./pitch-reading";
import { keepLesson, usePlaceAtOpen } from "./quiz-run-store";
import { WrittenBlock } from "./written-block";
import { seeId } from "./writes";

export function LessonClient({ sample, showcase, signedIn, initial, picks, accountPlace = NO_PLACE }: { sample: boolean; showcase: boolean; signedIn: boolean; initial: SkyLessonData | null; picks: readonly string[]; accountPlace?: SavedPlace }) {
  const load = useCallback((w: Parameters<typeof loadLesson>[0]) => loadLesson(w, picks), [picks]);
  const { data, loading } = useSkyData({ sample, signedIn, load, initial, eyebrow: "Lesson", title: "Tonight's lesson" });
  // The place this browser was holding when the page opened, read once: the
  // lesson writes it as it goes, and a live read would move the step it
  // resumes from underneath the learner. The pretend learner and the showcase
  // keep nothing, the way they record nothing.
  const local = usePlaceAtOpen();
  const kept = sample || showcase || !local ? null : (hasPlace(local) ? local : accountPlace).lesson;
  const mine = kept && samePicks(kept.picks, picks) ? kept : null;
  const onPlace = useCallback(
    (place: { at: number; steps: number; star: string } | null) => {
      if (sample || showcase) return;
      keepLesson(place && lessonToKeep(picks, place.at, place.steps, place.star, Date.now()), signedIn);
    },
    [sample, showcase, picks, signedIn],
  );
  // The browser has not been asked yet, so which step this lesson opens on is
  // not known. The heading is, and it is drawn while the rest catches up
  // (SAK-356), rather than opening on the first step and jumping. It is the
  // same trade the quiz makes for the same reason, and it costs a signed-in
  // learner the server-rendered lesson they used to get.
  if (local === undefined || !data) return loading;
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
      startAt={mine?.star}
      onPlace={sample || showcase ? undefined : onPlace}
    />
  );
}
