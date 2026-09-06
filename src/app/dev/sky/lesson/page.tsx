// Tonight's lesson, for the picks in the URL. Route: /dev/sky/lesson?picks=…
// One call: the route builds the lesson through the adapter and hands it to
// SkyLesson. `?sample` uses the pretend learner's history.

import Link from "next/link";

import { HearButton } from "@/components/ui/hear-button";
import { SkyLesson } from "@/sky/components/sky-lesson";

import { markSeen } from "../actions";
import { learnerLesson, lessonFromPicks, showcasePicks } from "../lesson";
import { emptyHistory } from "@/lib/history-ops";

import { sampleHistory } from "../sample-learner";
import { PitchMark } from "../pitch-reading";
import { SkyPage } from "../sky-page";
import { WrittenBlock } from "../written-block";

export const dynamic = "force-dynamic";

export default async function SkyLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const showcase = params.showcase !== undefined;
  const raw = Array.isArray(params.picks) ? params.picks.join(",") : (params.picks ?? "");
  const picks = showcase ? showcasePicks() : raw.split(",").map((s) => s.trim()).filter(Boolean);
  const data = showcase ? lessonFromPicks(emptyHistory(), picks) : sample ? lessonFromPicks(sampleHistory(), picks) : await learnerLesson(picks);
  const back = sample ? "/dev/sky/observatory?sample" : "/dev/sky/observatory";
  // the real stroke order for every character on the card, as a slot
  const written = Object.fromEntries(
    Object.keys(data.teach)
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && (i.kind === "kana" || i.kind === "kanji" || i.kind === "radical"))
      .map((i) => [i.id, <WrittenBlock key={i.id} glyph={i.glyph} />]),
  );
  return (
    <SkyPage
      note={
        <>
          {showcase ? "One of everything, on an empty history. " : sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={back} className="underline">Back to the Observatory</Link>
        </>
      }
    >
      <SkyLesson data={data} drillHref={`/dev/sky/quiz?${sample || showcase ? "sample&" : ""}picks=${encodeURIComponent(picks.join(","))}`} written={written} hear={HearButton} pitch={PitchMark} onOpen={sample || showcase ? undefined : markSeen} height="100%" />
    </SkyPage>
  );
}
