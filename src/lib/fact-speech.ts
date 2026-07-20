// What a fact SOUNDS like — the one place the teach screens ask "does this have
// a pronounceable Japanese surface, and if so, which one do we speak?".
//
// WHY THIS IS NOT "SHOW THE GLYPH"
// ================================
// A 🔊 that reads the big glyph aloud is wrong for exactly the cases the drill
// engine already refuses to grade off the glyph (see engine/question.ts): a
// bare kanji has nine readings and no single sound, and a grammar pattern is a
// shape, not a word. So this mirrors the engine's own reading-vs-meaning
// distinction rather than inventing a second one:
//
//   kana  → the glyph. One character, one sound.
//   word  → the glyph. 先生 is "sensei"; the surface IS speakable.
//   kanji READING fact → the ANCHOR WORD, not the kanji. 生's せい reading is
//     heard inside 先生 — the word that proved the reading and that the card is
//     already framed on ("生 · in 先生"). The caller passes that anchor.
//   kanji MEANING fact → nothing. A lone 生 has no single reading to speak; the
//     card shows "meaning", not a word, and the anchor is absent.
//   grammar → nothing. 〜てから is a pattern, not a pronunciation — the same
//     rule the Library grammar entries follow.
//
// The anchor doubles as the reading-vs-meaning signal for kanji: the teach
// screen computes it with anchorForFact(), which is a word for a reading fact
// and undefined for a meaning fact. Absent anchor → no button, which is also
// the right failure for any fact we can't classify: a missing speaker is fine,
// a speaker that says garbage is not.

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import type { FactInfo } from "@/types";

/**
 * The Japanese text to speak for a fact, or null when it has no single sound.
 *
 * `anchor` is the known word the card is framed on for a kanji reading fact
 * (from anchorForFact) — the word whose pronunciation the reading is heard in.
 * Every other subject ignores it.
 */
export function speechForFact(info: FactInfo, anchor?: string): string | null {
  switch (info.subject) {
    case KANA_SUBJECT:
    case VOCAB_SUBJECT:
    case TRANSITIVITY_SUBJECT:
      // The glyph is itself a speakable surface: a kana character, a whole word,
      // or (transitivity) the verb the fact asks for — 開ける is "akeru".
      return info.glyph;
    case KANJI_SUBJECT:
      // Reading fact → speak the word that carries the reading (先生), never the
      // bare 生. Meaning fact → no anchor → no sound.
      return anchor ?? null;
    default:
      // Grammar, and any subject we don't recognise: err toward silence.
      return null;
  }
}
