// The Sky's Quiz. Route: /quiz (`?picks=a,b` asks those, else what
// is due; `?cards=` names the exact cards, a retry; `?sample` a pretend
// learner, recording nothing). Signed out, the browser's own progress, and
// the answers recorded there.

import { LESSON_ROUNDS } from "@/sky/lib/rest";

import { loadPlace, loadQuiz } from "../actions";
import { idsFrom, skyHref } from "../hrefs";
import { initialFor, whoFor } from "../page-data";
import { QuizClient } from "../quiz-client";

export const metadata = { title: "Quiz" };

export const dynamic = "force-dynamic";

/** Where the results and the rest screen send you (SAK-353).
 *
 * A quiz starts from the Observatory, the Atlas, Sessions or Practice, and
 * only whoever linked here knows which; they say so with `?from=`. Both
 * screens used to offer "Back to the observatory" whatever had sent you, and
 * told practice apart by looking for the word in the href. */
const FROM: Record<string, { path: string; label: string }> = {
  atlas: { path: "/atlas", label: "Back to the Atlas" },
  sessions: { path: "/sessions", label: "Back to your sessions" },
  practice: { path: "/practice", label: "Back to practice" },
  observatory: { path: "/observatory", label: "Back to the observatory" },
};

function wayBack(from: string | string[] | undefined, sample: boolean) {
  const key = typeof from === "string" ? from : "";
  const where = FROM[key] ?? FROM.observatory;
  return { href: skyHref(where.path, { sample }), label: where.label };
}

export default async function SkyQuizPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { sample, signedIn, who } = await whoFor(params);
  const picks = idsFrom(params.picks);
  const named = idsFrom(params.cards);
  // The deck and what was left part way through at the same time, not one
  // after the other (SAK-382's rule, SAK-404's read): they have nothing to
  // say to each other, and the place is a small select on the same row.
  // A visitor's place is in their browser, so there is nothing to read here.
  const [initial, accountPlace] = await Promise.all([
    initialFor(who, (w) => loadQuiz(w, { picks, cards: named })),
    sample || !signedIn ? undefined : loadPlace(),
  ]);
  return (
    <>
      <QuizClient initial={initial} picks={picks} named={named} sample={sample} signedIn={signedIn} accountPlace={accountPlace} back={wayBack(params.from, sample)} rounds={picks.length && !named.length ? LESSON_ROUNDS : 1} />
    </>
  );
}
