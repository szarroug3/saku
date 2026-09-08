// The Sky's Lesson. Route: /lesson?picks=a,b (`?sample` a pretend
// learner, `?showcase` one of everything on an empty history). Signed out,
// the browser's own progress.

import { emptyHistory } from "@/lib/history-ops";

import { loadLesson } from "../actions";
import { idsFrom } from "../hrefs";
import { initialFor, whoFor } from "../page-data";
import { LessonClient } from "../lesson-client";
import { lessonFromPicks, showcasePicks } from "../lesson";

export const metadata = { title: "Lesson" };

export const dynamic = "force-dynamic";

export default async function SkyLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const showcase = params.showcase !== undefined;
  const { sample, signedIn, who } = await whoFor(params, showcase);
  const picks = showcase ? showcasePicks() : idsFrom(params.picks);
  const initial = showcase ? lessonFromPicks(emptyHistory(), picks) : await initialFor(who, (w) => loadLesson(w, picks));
  return <LessonClient sample={sample} showcase={showcase} signedIn={signedIn} initial={initial} picks={picks} />;
}
