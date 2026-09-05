// The Sky's Quiz, on the signed-in learner's real progress. Route:
// /dev/sky/quiz (`?picks=a,b` asks those, else what is due; `?sample`
// shows a pretend learner, recording nothing). One call: the route builds
// the cards through the adapter and hands them to the client, which grades
// with the app's matchers and records through a server action.

import Link from "next/link";

import { recordQuiz } from "../actions";
import { learnerHistory } from "../atlas";
import { cardsFor, learnerQuiz, quizFromHistory, sampleCards } from "../quiz";
import { QuizClient } from "../quiz-client";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyQuizPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const picks = String(params.picks ?? "").split(",").filter(Boolean);
  // `?cards=` names the exact cards (a retry from the results)
  const named = String(params.cards ?? "").split(",").filter(Boolean);
  const history = sample ? sampleHistory() : await learnerHistory();
  // the pretend learner has nothing due (everything was drilled just now), so
  // the sample asks every question type of every kind unless picks are named
  const cards = named.length ? cardsFor(history, named) : sample ? (picks.length ? quizFromHistory(history, picks) : sampleCards(history)) : await learnerQuiz(picks);
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner, so there is no one to record against. " : "Your own progress, recorded. "}
          <Link href={sample ? "/dev/sky/quiz" : "/dev/sky/quiz?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <QuizClient cards={cards} sample={sample} skyHref={sample ? "/dev/sky/observatory?sample" : "/dev/sky/observatory"} onFinish={sample ? undefined : recordQuiz} />
    </SkyPage>
  );
}
