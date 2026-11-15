// What a quiz card was mixed up with, for the session record's `confused`
// counts (#BuildHybridAI). Those counts are what the home's Mix-ups panel,
// the Practice "Mix-ups" filter and the weakness ranking read
// (src/lib/confusions.ts), and until now the Sky quiz never wrote them: only
// the sample learner had any mix-ups at all.
//
// Two ways a card names another entry:
//
//   picked  A wrong choice's id is the fact it answers, so picking 目 on 日's
//           card names 目 for certain.
//   typed   A wrong typed answer names another entry only when exactly one
//           entry in the quiz's own deck has it as an answer (`confusedWith`,
//           the engine's detector). Two or none is a plain miss: a wrong
//           pair would fill the Mix-ups panel with something that never
//           happened, and look exactly like the app working.
//
// Each entry counts once per card, however many times it was tried, and the
// card's own entry never counts: another reading of 生 is a wrong answer
// about 生, not a mix-up.

import { confusedWith } from "@/lib/engine";
import { entryOf, factInfo } from "@/lib/facts";
import type { QuizAnswer } from "@/sky/lib/quiz";
import type { EntryId, FactId } from "@/types/facts";

/** The entries this answer shows its card was mixed up with. `deck` is the
 * facts of every card in the quiz, the space a typed answer is matched in. */
export function mixedWith(answer: QuizAnswer, fact: FactId, deck: readonly FactId[]): EntryId[] {
  const self = entryOf(fact);
  const out = new Set<EntryId>();
  for (const id of answer.picked ?? []) {
    // a choice that is not a fact (a pitch card's "pitch:other") names nothing
    if (!factInfo(id as FactId)) continue;
    const other = entryOf(id as FactId);
    if (other !== self) out.add(other);
  }
  // typed answers only: on a card answered by picking, `said` holds the
  // choices' labels, already counted by their ids above. A card that was
  // typed on and then narrowed mixes the two, and its typed part is let go:
  // missing a mix-up costs less than inventing one. The last thing said on a
  // card answered right is the right answer.
  if (!answer.narrowed && !answer.picked?.length) {
    const said = answer.said ?? [];
    const wrong = answer.grade === "missed" ? said : said.slice(0, -1);
    // only against cards of the same subject: a 〜たい card's vehicle typed
    // plain ("たべる") matches 食べる's reading card in the same review, and
    // that is a slip on the pattern, not a mix-up of 〜たい with 食べる
    const subject = factInfo(fact)?.subject;
    const alike = deck.filter((f) => factInfo(f)?.subject === subject);
    for (const given of wrong) {
      const other = confusedWith(fact, given, alike);
      if (other) out.add(other);
    }
  }
  return [...out];
}
