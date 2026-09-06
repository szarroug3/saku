// The Sky's Quiz. Route: /quiz (`?picks=a,b` asks those, else what
// is due; `?cards=` names the exact cards, a retry; `?sample` a pretend
// learner, recording nothing). Signed out, the browser's own progress, and
// the answers recorded there.

import { currentUserId } from "@/lib/auth";
import { LESSON_ROUNDS } from "@/sky/lib/rest";

import { loadQuiz } from "../actions";
import { QuizClient } from "../quiz-client";

export const dynamic = "force-dynamic";

export default async function SkyQuizPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const picks = String(params.picks ?? "").split(",").filter(Boolean);
  const named = String(params.cards ?? "").split(",").filter(Boolean);
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadQuiz({ sample: true }, { picks, cards: named }) : userId ? await loadQuiz({}, { picks, cards: named }) : null;
  return (
    <>
      <QuizClient initial={initial} picks={picks} named={named} sample={sample} signedIn={userId !== null} skyHref={sample ? "/observatory?sample" : "/observatory"} rounds={picks.length && !named.length ? LESSON_ROUNDS : 1} />
    </>
  );
}
