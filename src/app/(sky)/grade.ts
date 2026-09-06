// Whether what was typed answers a card, on the client.
//
// A server component cannot hand a function to a client one, so the Quiz
// takes its grader as a prop and this is what the routes pass. It uses the
// app's own matchers, the same ones the drill uses (the fact's own check,
// romaji to kana, English synonyms), so grading costs no round trip. Right
// or wrong, nothing in between: a near miss gets another try instead
// (Sam, 2026-09-05).
//
// Its own file rather than the quiz's, because Practice grades too and a
// page should not import the Quiz to get at one function (SAK-366).

import { checkTyped } from "@/lib/engine";
import { romajiMatches } from "@/lib/romaji";
import type { QuizCard } from "@/sky/lib/quiz";
import type { Direction, FactId } from "@/types";

/** A rolled counting card (say 六十七) carries its own accepted readings;
 * everything else asks the fact. */
export function grade(card: QuizCard, given: string): boolean {
  if (card.meta?.accept) return card.meta.accept.split("|").some((a) => romajiMatches(given, a));
  return checkTyped(card.id as FactId, given, (card.meta?.dir ?? "jp2en") as Direction);
}
