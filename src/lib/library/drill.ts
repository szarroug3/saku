// Handing a slice to the quiz — and the one honest gap in this whole feature.
//
// THE GAP
// =======
// `drillOrder` returns FactIds. Nine of them for 生. The quiz cannot ask a
// single one.
//
// quiz-session.startQuiz takes `chars: string[]`, and the mode screens build
// their decks, their prompts and their multiple-choice options out of
// CHAR_INDEX — a 214-key table of kana. `engine.checkTyped` is
// `CHAR_INDEX[char].r.includes(…)`, which for 生 reads a property of undefined.
// ActiveQuiz.chars says so itself: "Still CHARACTERS, not facts… Turning the
// runtime itself fact-native is the same change that gives QuestionType a
// consumer, and it ships with the first kanji."
//
// The first kanji shipped. The runtime did not follow. So today the app HAS
// 21,449 facts and can ask 214 of them, and every screen that offers to drill a
// kanji is offering something that does not exist.
//
// WHAT THIS FILE DOES ABOUT IT
// ============================
// Not paper over it. The bar counts what the quiz can actually ask, and says the
// rest out loud. That is worse-looking than "Drill 9" and it is the only version
// that isn't a lie: a button that starts an empty session teaches the user that
// the button is broken, which is more expensive than a sentence admitting it.
//
// The filter is a LOOKUP, not a parse: FactInfo carries `subject`, minted by the
// subject that owns the fact, precisely so nobody infers one from an id.
//
// WHEN THE RUNTIME GOES FACT-NATIVE, THIS FILE IS THE DIFF. `askable` starts
// returning everything, `ASKABLE_SUBJECTS` goes away, `drillChars` becomes
// `startQuiz(facts)`, and the two callers change by one word each. Nothing in
// slice.ts, search.ts or either screen knows about any of this — they deal in
// facts, which is what they should deal in whether or not the quiz agrees yet.

import { KANA_SUBJECT } from "@/data/characters";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * The subjects the quiz screens can put on screen today.
 *
 * A list of one, and it is a list rather than an `=== KANA_SUBJECT` so that the
 * thing to change when kanji becomes askable is a value and not a condition.
 */
const ASKABLE_SUBJECTS: readonly string[] = [KANA_SUBJECT];

/** The facts of `facts` the quiz can actually ask, in order. */
export function askable(facts: readonly FactId[]): FactId[] {
  return facts.filter((f) => {
    const info = factInfo(f);
    return !!info && ASKABLE_SUBJECTS.includes(info.subject);
  });
}

/**
 * A drill order, as the characters `startQuiz` wants.
 *
 * Deduplicated, because kana is 1:1 (one entry, one fact — see characters.ts)
 * so this is currently a rename, and the day it isn't, sending the same char
 * twice would put it in the deck twice and the user would see a repeat that the
 * ranking never asked for.
 *
 * Order is preserved from `drillOrder`. It is also, today, immediately thrown
 * away — `engine.buildDeck` shuffles. That is not a bug to fix here: the deck is
 * shuffled because a drill you can predict is a drill you can pattern-match, and
 * the ranking's job was to decide WHAT is in the session, which it did. Noted
 * because "we carefully ranked these and then shuffled them" looks like one of
 * the two is pointless, and neither is.
 */
export function drillChars(facts: readonly FactId[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of askable(facts)) {
    const glyph = factInfo(f)?.glyph;
    if (!glyph || seen.has(glyph)) continue;
    seen.add(glyph);
    out.push(glyph);
  }
  return out;
}

/** What the bar has to admit, or null when it has nothing to admit. `total` is
 * what the model would drill; `can` is what the quiz can ask. */
export function unaskableNote(total: number, can: number): string | null {
  const gap = total - can;
  if (gap <= 0) return null;
  if (can === 0) {
    return `The quiz can't ask ${
      gap === 1 ? "this yet" : "these yet"
    } — the question screens still only know kana.`;
  }
  return `${gap} more here the quiz can't ask yet — the question screens still only know kana.`;
}
