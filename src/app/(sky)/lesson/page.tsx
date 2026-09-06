// The Sky's Lesson. Route: /lesson?picks=a,b (`?sample` a pretend
// learner, `?showcase` one of everything on an empty history). Signed out,
// the browser's own progress.

import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";

import { loadLesson } from "../actions";
import { LessonClient } from "../lesson-client";
import { lessonFromPicks, showcasePicks } from "../lesson";

export const dynamic = "force-dynamic";

export default async function SkyLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const showcase = params.showcase !== undefined;
  const raw = Array.isArray(params.picks) ? params.picks.join(",") : (params.picks ?? "");
  const picks = showcase ? showcasePicks() : raw.split(",").map((s) => s.trim()).filter(Boolean);
  const userId = sample || showcase ? null : await currentUserId();
  const initial = showcase ? lessonFromPicks(emptyHistory(), picks) : sample ? await loadLesson({ sample: true }, picks) : userId ? await loadLesson({}, picks) : null;
  return (
    <>
      <LessonClient sample={sample} showcase={showcase} signedIn={userId !== null || showcase} initial={initial} picks={picks} />
    </>
  );
}
