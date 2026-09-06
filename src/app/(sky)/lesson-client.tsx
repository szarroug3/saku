"use client";

// The lesson's client side: the route's data or the browser's, the stroke
// order slot built here, and a star opened marked seen through the app's
// own call, so it is in rotation signed in or not.

import { useCallback } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { SkyLesson, type SkyLessonData } from "@/sky/components/sky-lesson";

import { loadLesson } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { PitchMark } from "./pitch-reading";
import { WrittenBlock } from "./written-block";
import { seeId } from "./writes";

export function LessonClient({ sample, showcase, signedIn, initial, picks }: { sample: boolean; showcase: boolean; signedIn: boolean; initial: SkyLessonData | null; picks: readonly string[] }) {
  const who = useWho(sample, signedIn);
  const load = useCallback((w: Parameters<typeof loadLesson>[0]) => loadLesson(w, picks), [picks]);
  const data = useLoaded(who, load, initial);
  if (!data) return <SkyLoading />;
  // the real stroke order for every character on the card, as a slot
  const written = Object.fromEntries(
    Object.keys(data.teach)
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && (i.kind === "kana" || i.kind === "kanji" || i.kind === "radical"))
      .map((i) => [i.id, <WrittenBlock key={i.id} glyph={i.glyph} />]),
  );
  const drillHref = `/quiz?${sample || showcase ? "sample&" : ""}picks=${encodeURIComponent(picks.join(","))}`;
  return <SkyLesson data={data} drillHref={drillHref} written={written} hear={HearButton} pitch={PitchMark} onOpen={sample || showcase ? undefined : seeId} height="100%" />;
}
