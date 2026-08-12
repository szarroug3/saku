// Kana whose sound depends on what FOLLOWS them.
//
// A note (src/data/characters.ts) corrects a kana that says the wrong thing on
// its own — し is "shi", not "si". This is a different fact: a kana that is
// regular in isolation but changes sound in the stream of speech, decided by the
// next sound rather than by the character itself. A learner who reads しんぶん as
// "shinbun" is not wrong about ん — they are missing the rule that ん borrows the
// place of the sound after it, and here that sound is "b", so ん is said "m":
// "shimbun". Said here, keyed by the character, so hiragana and katakana share
// one source.
//
// TWO kana carry this, and only two:
//
//   ん / ン — the moraic nasal. It has no fixed place of its own; it takes the
//   place of whatever consonant follows, and stands as a nasal in the back of
//   the mouth when nothing does.
//
//   っ / ッ — the sokuon (small tsu). It is a held beat that doubles the
//   consonant after it: がっこう is "gak-kou", not "gakou".
//
// What is NOT here, on purpose: ぢ/づ and じ/ず are homophones, not
// context-dependent — ぢ always sounds like じ, wherever it sits — so they are a
// note (characters.ts), not a rule of what follows. は/へ change reading by
// grammatical ROLE, not by the next sound, and are likewise notes. The great
// majority of kana say one thing in every context and return null.

/** One "how it's said when …" line: the following sound, what the kana becomes,
 * and a real word that shows it. */
export interface ContextRule {
  /** The following sound that triggers this pronunciation, in plain terms. */
  when: string;
  /** What the kana is said as in that context — a short romaji/plain gloss, not
   * IPA, so a beginner can read it. */
  sounds: string;
  /** A real word demonstrating the rule, with its romaji in parentheses. */
  example: string;
}

/** The context-pronunciation entry for a kana: a one-line factual summary and
 * the rules that fill it in. Null for every kana that sounds the same wherever
 * it sits, which is almost all of them. */
export interface ContextPronunciation {
  /** DRAFT (for Sam to finalise) — one factual sentence naming the behaviour,
   * shown above the rules. */
  summary: string;
  rules: ContextRule[];
}

// Keyed by the character itself so both scripts resolve to the same rules
// without a second table — the pattern noteFor / NOTES uses.
const CONTEXT: Record<string, ContextPronunciation> = {
  // ん — the moraic nasal. Order runs from the most-noticed change (the "m"
  // before b/p/m that surprises every beginner) through to the bare nasal it is
  // when nothing follows.
  ん: {
    // DRAFT: Sam to finalise.
    summary: "ん has no fixed sound of its own. It takes the place of the sound that follows it.",
    rules: [
      { when: "Before b, p, or m", sounds: "m", example: "しんぶん (shimbun), さんぽ (sampo)" },
      { when: "Before k or g", sounds: 'ng (as in "sing")', example: "りんご (ringo)" },
      { when: "Before t, d, n, s, z, or r", sounds: "n", example: "みんな (minna)" },
      {
        when: "At the end of a word, or before a vowel, y, or w",
        sounds: "a nasal held in the back of the mouth",
        example: "ほん (hon)",
      },
    ],
  },
  // っ — the sokuon. One rule: it doubles the next consonant. Written as small つ
  // but never pronounced as "tsu"; the "sound" it makes is the pause and the
  // doubling.
  っ: {
    // DRAFT: Sam to finalise.
    summary: "っ is a brief silent pause that doubles the consonant right after it.",
    rules: [
      {
        when: "Before any consonant",
        sounds: "that consonant, doubled after a short pause",
        example: "がっこう (gakkou), きっぷ (kippu)",
      },
    ],
  },
};

// Katakana shares hiragana's rules — the behaviour is the sound's, not the
// script's. Point ン at ん and ッ at っ rather than restate them.
CONTEXT["ン"] = CONTEXT["ん"];
CONTEXT["ッ"] = CONTEXT["っ"];

/** The context-pronunciation rules for a kana, or null when it sounds the same
 * wherever it appears (the great majority). */
export function contextPronunciation(c: string): ContextPronunciation | null {
  return CONTEXT[c] ?? null;
}
