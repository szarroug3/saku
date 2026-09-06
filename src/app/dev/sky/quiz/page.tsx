// The Sky's Quiz. Route: /dev/sky/quiz (`?picks=a,b` asks those, else what
// is due; `?cards=` names the exact cards, a retry; `?sample` a pretend
// learner, recording nothing). Signed out, the browser's own progress, and
// the answers recorded there.

import Link from "next/link";

import { currentUserId } from "@/lib/auth";
import { LESSON_ROUNDS } from "@/sky/lib/rest";

import { loadQuiz } from "../actions";
import { QuizClient } from "../quiz-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyQuizPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const picks = String(params.picks ?? "").split(",").filter(Boolean);
  const named = String(params.cards ?? "").split(",").filter(Boolean);
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadQuiz({ sample: true }, { picks, cards: named }) : userId ? await loadQuiz({}, { picks, cards: named }) : null;
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner, so there is no one to record against. " : userId ? "Your own progress, recorded. " : "Your progress, recorded in this browser. "}
          <Link href={sample ? "/dev/sky/quiz" : "/dev/sky/quiz?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <QuizClient initial={initial} picks={picks} named={named} sample={sample} signedIn={userId !== null} skyHref={sample ? "/dev/sky/observatory?sample" : "/dev/sky/observatory"} rounds={picks.length && !named.length ? LESSON_ROUNDS : 1} />
    </SkyPage>
  );
}
