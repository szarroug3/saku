// Tonight's lesson, for the picks in the URL. Route: /dev/sky/lesson?picks=…
// One call: the route builds the lesson through the adapter and hands it to
// SkyLesson. `?sample` uses the pretend learner's history.

import Link from "next/link";

import { SkyLesson } from "@/sky/components/sky-lesson";

import { learnerLesson, lessonFromPicks } from "../lesson";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";
import { WrittenBlock } from "../written-block";

export const dynamic = "force-dynamic";

export default async function SkyLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const raw = Array.isArray(params.picks) ? params.picks.join(",") : (params.picks ?? "");
  const picks = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const data = sample ? lessonFromPicks(sampleHistory(), picks) : await learnerLesson(picks);
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
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={back} className="underline">Back to the Observatory</Link>
        </>
      }
    >
      <SkyLesson data={data} drillHref="/session" written={written} height="100%" />
    </SkyPage>
  );
}
