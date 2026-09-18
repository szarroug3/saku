// WHICH WORD IS ASKING, WHEN TWO OF THEM SHARE A READING (SAK-462)
// =================================================================
// The app speaks a word from its kana reading, and a clip is stored under a
// hash of the text that was asked for (src/lib/voice.ts's voiceObjectPath and
// pitchObjectPath). One reading is therefore one clip, shared by every word
// read that way, which is right for a homophone pair and wrong for ten
// readings where the two words are not homophones at all:
//
//   かこう is 囲う, said "kakou" because the う is the verb's own ending, and
//   加工, said "kakoo" with a long o. そう is 沿う and 添う against 想 and 総;
//   いこう is 憩う against 以降 and 意向; よう is 酔う against 用; とう is 問う
//   against 党, 唐 and 塔; こう is 乞う against the plain adverb こう. The same
//   shape the other way round, where the verb is the one the shared clip
//   already says right: かよう is 通う against 火曜, ひろう is 拾う against
//   疲労, やとう is 雇う against 野党, におう is 匂う against 仁王.
//
// No single text serves both sides, so the word the shared clip says wrong
// stops asking for it: it sends its OWN WRITTEN FORM instead. 囲う sends 囲う,
// which the engine reads カコウ, while 加工 goes on sending かこう, which it
// reads カコオ. The spoken text differs, so the hash differs, so the path
// differs on its own. Nothing about how a path is worked out changed, and no
// other clip in the bucket moved: every reading outside these eleven words
// hashes to exactly what it always did.
//
// scripts/build-speech-overrides.mjs decides the table by asking the local
// VOICEVOX engine what it says for each spelling before it says it, and its
// --check re-asks. The key is the written form AND the reading, so an override
// only ever fires for the reading it was decided for: a word taught under
// several readings (人 is ひと, じん, にん) keeps the shared clip for the ones
// that never clashed.
//
// WHO CALLS THIS. Everywhere the app turns a KNOWN WORD into speech: what a
// fact sounds like (src/lib/fact-speech.ts), the hear button when its caller
// names the word it is for (src/app/(sky)/hear-button.tsx), the pitch quiz's
// two clips (src/lib/pitch-quiz.ts, src/app/(sky)/quiz.ts), and the four seed
// sets that speak a word (scripts/seed-voice-audio.mjs's words, word-readings,
// pitch and lesson-pitch). A caller with no word in hand — a kanji's on'yomi
// row, a sentence, a bare kana — passes none and gets the reading back
// untouched, which is the right answer for it.
//
// This is deliberately NOT part of src/lib/tts-synth.ts's own override table.
// That one is keyed by reading and is applied at synthesis time, after the path
// has already been chosen, so it can never separate two words. This one is
// applied by the CALLER, before the path is worked out, which is the whole
// point of it.

import wordOverrides from "@/data/generated/speech-word-overrides.json" with { type: "json" };

const BY_WORD: ReadonlyMap<string, string> = new Map(Object.entries(wordOverrides));

/** The text to speak for `reading` when it is THIS word's reading — the word's
 * own written form for the eleven words that cannot share their reading's clip,
 * and `reading` itself for everything else.
 *
 * `writtenForm` is optional because most callers genuinely do not have one, and
 * an absent word means "keep the shared clip", never "guess". */
export function speechTextFor(writtenForm: string | null | undefined, reading: string): string {
  if (!writtenForm) return reading;
  return BY_WORD.get(`${writtenForm}|${reading}`) ?? reading;
}
