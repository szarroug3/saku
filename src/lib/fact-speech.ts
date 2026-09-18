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
//   verb pair → its curated member reading. 開く can be あく or ひらく, so the
//     pair data, not TTS guessing from the glyph, selects the sound.
//   grammar → nothing. 〜てから is a pattern, not a pronunciation — the same
//     rule the Library grammar entries follow.
//
// The anchor doubles as the reading-vs-meaning signal for kanji: the teach
// screen computes it with anchorForFact(), which is a word for a reading fact
// and undefined for a meaning fact. Absent anchor → no button, which is also
// the right failure for any fact we can't classify: a missing speaker is fine,
// a speaker that says garbage is not.
//
// EVERY ANSWER HERE GOES THROUGH speechTextFor (SAK-462), because every one of
// them is a KNOWN word: the word being taught, the anchor a kanji reading is
// heard in, a verb pair's member, a keigo set's word. Eleven words cannot share
// their reading's clip with the other word read the same way (囲う "kakou"
// against 加工 "kakoo"), and they are the only ones it changes — see
// src/lib/speech-text.ts. A kana's glyph is not a word and gets no such
// treatment; nor does the null a grammar pattern gets.

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT, keigoWordInfo } from "@/data/keigo";
import {
  TRANSITIVITY_SUBJECT,
  transitivitySide,
} from "@/data/transitivity-facts";
import { VOCAB_SUBJECT, vocabRow, wordReadingUnit } from "@/data/vocab";
import { speechTextFor } from "@/lib/speech-text";
import type { FactInfo } from "@/types/facts";

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
      // The glyph is itself a speakable surface: one kana character.
      return info.glyph;
    case TRANSITIVITY_SUBJECT: {
      // Pair members store a checked reading. Use it rather than asking TTS to
      // choose among a kanji verb's possible readings.
      const side = transitivitySide(info.id);
      return side ? speechTextFor(side.word, side.reading) : null;
    }
    case VOCAB_SUBJECT:
      // Speak the READING OF THIS UNIT, not the word's primary reading. A word
      // mints a fact per reading-unit (人 → ひと, じん, にん), and the audio card
      // for the にん unit must play にん — playing the primary ひと would voice one
      // reading while grading another, marking a correct transcription wrong.
      // wordReadingUnit maps every word fact (reading OR meaning, primary OR
      // qualified) to its unit, so a meaning card plays its unit's reading too.
      // Falls back to the primary reb, then the glyph. 何 written is free to come
      // out か (an on'yomi TTS prefers); the reading pins the one taught sound. A
      // kana word has keb === reb, so this is a no-op for it.
      return speechTextFor(
        info.glyph,
        wordReadingUnit(info.id)?.unit.reb ?? vocabRow(info.glyph)?.reb ?? info.glyph,
      );
    case KANJI_SUBJECT:
      // Reading fact → speak the word that carries the reading (先生), never the
      // bare 生. Meaning fact → no anchor → no sound. And when that word is a
      // single kanji (何's anchor is 何 itself) the written form has the same
      // free-reading ambiguity, so speak the word's kana reading — なに, not the
      // glyph the phone may voice as か.
      return anchor ? speechTextFor(anchor, vocabRow(anchor)?.reb ?? anchor) : null;
    case KEIGO_SUBJECT: {
      // Keigo facts store the authoritative reading beside the written form.
      // Speak that reading so TTS cannot choose an unintended kanji reading.
      const keigo = keigoWordInfo(info.id)?.word;
      return keigo ? speechTextFor(keigo.word, keigo.reading) : null;
    }
    default:
      // Grammar, and any subject we don't recognize: err toward silence.
      return null;
  }
}
