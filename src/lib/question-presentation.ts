// How a card was ASKED, said in words — the chip label the post-quiz screens
// print under each glyph.
//
// THE UPGRADE
// ===========
// factTypeLabel (fact-label.ts) named what a fact IS — "kanji · meaning". But a
// meaning fact can be met two ways in one session: heard and typed, or seen and
// picked. "How it was presented" is a property of a SHOWING, not a fact — the
// direction, whether it was a box or a board, and whether the word was played
// instead of shown — and the drill now records the last one on the stat
// (ShowingPresentation). This turns that record into Sam's own phrasing: "hear
// it → type the meaning", "see the meaning → type the Japanese".
//
// TWO SIDES, THE SAME AXES AS THE INSTRUCTION
// ===========================================
// The label is `input → output`, prefixed by the fact's noun so a kanji and a
// word asked the same way still read differently (可 the kanji means "can", 可
// the word "acceptable" — the reason the type is kept). The output side reuses
// the very functions quiz-instruction draws its sentence from — answerIsJapanese
// and isSound — so the chip and the card can never disagree about what a showing
// was asking for.
//
// NO PRESENTATION, NO PROBLEM
// ===========================
// A fact shown but never resolved, a stat from a snapshot older than the field,
// or a stored session summarised down to percentages carries no presentation.
// Those fall back to factTypeLabel — the fact's type is still the honest thing
// to say when how-it-was-asked was never recorded.

import { answerIsJapanese } from "@/lib/engine/question";
import { factTypeLabel } from "@/lib/fact-label";
import { factInfo } from "@/lib/facts";
import { isSound, nounFor } from "@/lib/quiz-instruction";
import type { Direction, FactId, ShowingPresentation } from "@/types";

/** What the answer to this showing was — an English meaning, a kana reading, or
 * a written Japanese form. The same three the drill instruction splits on. */
function producedSide(fact: FactId, dir: Direction): "meaning" | "reading" | "written" {
  if (!answerIsJapanese(fact, dir) && factInfo(fact)?.meaning != null) return "meaning";
  if (isSound(fact, dir)) return "reading";
  return "written";
}

/** What you were shown to start the card. */
function shownSide(fact: FactId, shown: ShowingPresentation): string {
  if (shown.listen) return "hear it";
  // en2jp shows the prompt you produce Japanese FROM — the English meaning for
  // anything that has one, the reading (romaji) for a kana that does not.
  if (shown.dir === "en2jp") {
    return factInfo(fact)?.meaning != null ? "see the meaning" : "see the reading";
  }
  // jp2en shows the glyph itself.
  return "see it";
}

/**
 * The chip label: how this fact was last presented, or — when no presentation
 * was captured — what the fact is.
 *
 * Never leaks the answer: it names the KIND of question ("the meaning", "the
 * reading", "the Japanese"), never a gloss or a reading the box would accept.
 */
export function presentationLabel(fact: FactId, shown?: ShowingPresentation): string {
  const info = factInfo(fact);
  if (!info) return String(fact);
  if (!shown) return factTypeLabel(fact);

  const noun = nounFor(fact);
  const verb = shown.mode === "mc" ? "pick" : "type";
  const produced = producedSide(fact, shown.dir);
  const output =
    produced === "meaning"
      ? `${verb} the meaning`
      : produced === "reading"
        ? `${verb} the reading`
        : `${verb} the Japanese`;

  return `${noun} · ${shownSide(fact, shown)} → ${output}`;
}
