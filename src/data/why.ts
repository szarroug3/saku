// The "why this?" layer — the plain-language reasons behind the order the app
// teaches in.
//
// WHO THIS IS FOR, AND WHY IT READS THE WAY IT DOES
// =================================================
// The reader is a complete beginner on their first screens. Not "someone who
// did a year of Japanese and forgot" — someone who did not know hiragana
// existed, bought a book, and could not do lesson one because lesson one is
// already written in a script nobody had told them about. English is far enough
// from Japanese that none of this order is guessable. So every entry here
// answers a real question that a real beginner actually asked, in that beginner's
// register: short, concrete, an example over a definition. No hedging, no "it's
// worth noting", no throat-clearing.
//
// THIS IS CONTENT ABOUT JAPANESE, NOT ABOUT THE APP
// =================================================
// The app bans narrating itself. That ban is not this file's problem: nothing
// here explains a button, a screen, or a mechanic. Every sentence teaches
// something true about the language and why one script comes before another.
// That is the job, so this text is welcome at full length — the restraint it
// owes is PLACEMENT, not brevity. See src/components/lesson/why.tsx: the lede is
// on screen, the paragraphs are behind a "why?" that is closed until asked.
//
// WHERE THE COPY CAME FROM
// ========================
// The owner is the target reader and asked these exact questions while this was
// being built: "is kanji just a part of a word?", "why would learn kanji instead
// of words?", "are radicals actual words?", "what is the point of learning kanji?".
// The answers below are those answers. If you rewrite them, keep answering HER
// questions — not an FAQ pitched at someone already past this.
//
// Curly quotes and apostrophes (“ ” ’) are deliberate: this is rendered as plain
// text, so the punctuation has to be the real character, and the app prefers it.

/**
 * One "why?" — a compact lede that is always on screen, and the fuller reason
 * that opens behind it.
 */
export interface Why {
  /**
   * The one honest line shown before anything is opened. A short fragment
   * (bolded on screen) plus the plain rest of the sentence — it stands alone if
   * the reader never opens the rest, and never blocks the button below it.
   */
  lede: { strong: string; rest: string };
  /** The fuller answer, one string per paragraph. Opened only when asked. */
  paras: readonly string[];
}

/**
 * Why each SCRIPT comes when it does, keyed by the set id in
 * src/data/characters.ts. Shown on the first lesson of that script — the one
 * juncture where "why this now?" is the live question — and not repeated on
 * every group after it.
 */
export const WHY_SCRIPT: Record<string, Why> = {
  hiragana: {
    lede: {
      strong: "New to Japanese? Hiragana comes first.",
      rest: "It’s the smallest set of characters that lets you read and write anything.",
    },
    paras: [
      "Japanese isn’t written with the letters you already know. There’s no way to sound あ out with A, B, C — it’s a separate system, and you can’t step around it to get to the “real” Japanese later. Hiragana is where that system starts.",
      "Each hiragana stands for a sound: か is “ka”, き is “ki”. There are about forty-six of them, and together they can spell any Japanese word out loud. That’s why a beginner’s book opens assuming you have them already — lesson one is printed in hiragana, with nothing telling you so.",
      "There are two other writing systems, and hiragana goes ahead of both on purpose. Katakana is a second set of shapes for these same sounds — you’ll want it soon. Kanji are a much bigger job that comes later. Hiragana is the small set that unlocks the most, so it’s the door in.",
    ],
  },
  katakana: {
    lede: {
      strong: "Katakana is next: the same sounds, a second set of shapes.",
      rest: "Nothing new to pronounce — only new shapes to recognize.",
    },
    paras: [
      "Katakana spells the exact same sounds hiragana does. カ is “ka”, just like か. You already know how all of it sounds; you’re only learning to recognize a second way of writing it.",
      "It’s used for words borrowed from other languages — コーヒー is “coffee” — and for names and sound effects. You run into it constantly, so it’s worth having in hand before you spend real time on words.",
      "It’s about the same size as hiragana and reuses sounds you already have, which is why it’s a quick second step rather than a whole new climb.",
    ],
  },
};

/**
 * The kanji questions — the ones the owner asked in her own words. These sit on
 * the kanji track, at the point kanji first unlock, behind the same "why?"
 * pattern the script ledes use. Kept here as content so the kanji screens can
 * surface them without rewriting the answers.
 *
 * Ordered the way the questions actually arrive: first "why bother", then "what
 * even is one", then "what’s a radical".
 */
export const WHY_KANJI: readonly (Why & { id: string })[] = [
  {
    id: "why-kanji",
    lede: {
      strong: "You only ever use words — so why learn kanji?",
      rest: "Because every kanji you know is a discount on words you haven’t seen yet.",
    },
    paras: [
      "You’re right that you never really “use” a lone kanji. You use words. But kanji are how words are built, and knowing the pieces means new words aren’t fully new.",
      "火 is fire. 山 is mountain. The first time you see 火山, you can guess it: fire-mountain, a volcano — and nobody had to teach you that word. Learn a few hundred kanji and thousands of words stop landing as strangers.",
      "There’s a second reason, and it isn’t optional. Japanese doesn’t put spaces between words. Kanji are a big part of how you tell where one word ends and the next begins — they break a solid row of characters into pieces your eye can grab.",
    ],
  },
  {
    id: "what-kanji",
    lede: {
      strong: "What is a kanji, exactly?",
      rest: "A single character that carries a meaning, and usually a sound.",
    },
    paras: [
      "A kanji is one character that stands for a meaning and, most of the time, a sound. 山 means mountain and is read “yama”.",
      "Sometimes a kanji is a whole word by itself — 山 is the word “mountain”. Sometimes it’s just one piece of a longer word — the 火 inside 火山. Both are completely normal, and the same kanji does both depending on the word it’s in.",
    ],
  },
  {
    id: "what-radical",
    lede: {
      strong: "What’s a radical? Is it a word?",
      rest: "It’s a building block of a kanji — and most of them are kanji themselves.",
    },
    paras: [
      "Kanji are built out of smaller parts, and a radical is one of those parts. Most radicals are themselves kanji you’ll learn on their own — 火 (fire) is a part you’ll find inside other kanji and also a character in its own right.",
      "A few radicals are only ever building blocks and never show up as a character you’d study by itself — shapes like 宀 or ノ. So not every radical is a word, but the large majority are kanji you’ll run into anyway.",
    ],
  },
];

/**
 * The three tracks after kana — kanji, words, grammar — each with a "why?" that
 * does two jobs the cards can’t do on their own.
 *
 * WHAT THESE ANSWER
 * =================
 * Once kana is done the app shows three cards at once, and a beginner has no way
 * to know why they’d pick one over another, or how they relate. So each track’s
 * "why?" (1) says what THAT track gives you, in the language of the other two —
 * so the reader can choose — and (2) makes the GATE legible: learning kanji is
 * what unlocks words, because a word can only be taught once you know all its
 * kanji. That relationship drives the whole words card and is invisible
 * otherwise, so every entry names it in plain beginner terms.
 *
 * These are content ABOUT JAPANESE, not about the app (see the file header): they
 * teach the learner why the three tracks exist and how they feed each other, not
 * what a button does. That is why they earn their length once opened.
 *
 * Keyed by track id: "kanji", "words", "grammar".
 */
export const WHY_TRACK: Record<string, Why> = {
  kanji: {
    lede: {
      strong: "Kanji are the characters — and the key that unlocks words.",
      rest: "Each one you learn makes a batch of words teachable.",
    },
    paras: [
      "Kanji is where you learn the individual characters and what each one means: 先 is “before”, 生 is “life”. On their own they aren’t much use — you don’t go around saying a lone kanji — but they’re the pieces every written word is built from.",
      "Here’s why this track comes first for a word: the words track will only teach you a word once you know all of its kanji. 先生 (“teacher”) stays locked until you’ve learned both 先 and 生. So each kanji you pick up here quietly unlocks the words that are made of it — that’s the payoff for a track whose characters you never use one at a time.",
      "If the words card keeps telling you to “go learn a kanji first”, this is that kanji. Learn it here, and the word it was blocking becomes teachable.",
    ],
  },
  words: {
    lede: {
      strong: "Words are the part you actually speak and read.",
      rest: "Most are made of kanji, so they unlock as you learn those.",
    },
    paras: [
      "Words are the real goal — 先生, 電車, たべる are the things you say and understand. Kanji and grammar both feed into this track: kanji are the characters a word is written with, grammar is how you string words into a sentence.",
      "A word is only taught here once you know every kanji in it — 電車 waits until you’ve learned both 電 and 車 — because showing a compound built from pieces you don’t have is teaching a shape with nothing under it. That’s why the words above so often point you back to the kanji track: the fastest way to unlock more words is to learn the kanji they’re made of.",
      "Words with no kanji at all — これ, もう, とても — have nothing to unlock, so you can learn them straight away. That’s why the earliest words you can practise here are the kana-only ones.",
    ],
  },
  grammar: {
    lede: {
      strong: "Grammar is how words become sentences.",
      rest: "The glue — separate from learning the words themselves.",
    },
    paras: [
      "Knowing words isn’t the same as knowing how to connect them. Grammar is the patterns that turn 食べる (“eat”) into “after eating”, “want to eat”, “please eat”. It’s a different kind of thing from a word or a kanji — a rule for combining, not another item to memorise.",
      "It runs alongside the other two rather than gating on them: you don’t need a big vocabulary before you start, because a pattern is taught with words you already have. Kanji unlock words; grammar is what you do with those words once you have them.",
      "Patterns come easiest ones first (the app tags each with its level), so early grammar leans on the simple verbs and words you’re already meeting on the other tracks.",
    ],
  },
};
