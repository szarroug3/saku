// Whether what was typed answers a card, on the client.
//
// A server component cannot hand a function to a client one, so the Quiz
// takes its grader as a prop and this is what the routes pass. Right or
// wrong, nothing in between: a near miss gets another try instead (Sam,
// 2026-09-05).
//
// It used to ask the engine, which meant the browser had to HAVE the engine,
// and the engine's index reaches every table the app owns: word definitions,
// the library index, the synonyms, the corpora. The Quiz, Practice and the
// Settings page each shipped about 15 MB of JavaScript to answer one
// yes-or-no question (SAK-380). Now the card carries its own answer, worked
// out on the server where the card was built (`answerKeyFor`), and this only
// has to compare. `matchesKey` and the fact's key are held together by
// src/lib/answer-key.test.ts, which grades the whole curriculum both ways.
//
// Its own file rather than the quiz's, because Practice grades too and a
// page should not import the Quiz to get at one function (SAK-366).

import { matchesKey } from "@/lib/answer-key";
import type { QuizCard } from "@/sky/lib/quiz";

export function grade(card: QuizCard, given: string): boolean {
  return matchesKey(card.key, given);
}
