// The card that opens a TRACK — shown once, when the track unlocks, before its
// first lesson.
//
// ⚠️ THE COPY BELOW IS A DRAFT AND IS MEANT TO BE REWRITTEN. ⚠️
// ============================================================
// Every `title`, `lead` and `text` in this file is placeholder prose written to
// prove the mechanism, not to be shipped as-is. The app's voice is the owner's:
// someone who did not know hiragana existed, bought a book, and could not do
// lesson one because lesson one was printed in a script nobody had told her
// about. That voice cannot be imitated, so this file deliberately settles for
// four plain sentences a card that she can replace, rather than a polished
// paragraph she would have to argue with. The STRUCTURE (which cards exist,
// where they fire, what three jobs each must do) is the deliverable; the
// sentences are scaffolding.
//
// WHY THIS FILE EXISTS AT ALL
// ===========================
// A beginner probe listed ~25 words the app used before teaching them. The two
// worst were `kana` (the very first banner on Home) and `romaji` (the format of
// every answer typed into the quiz, a word that appeared exactly once in the
// whole app). The card the app already had for this shape of problem — the phase
// intro (src/data/phase-intros.ts) — teaches a RULE at the moment the material
// changes shape. It had no slot for "here is what this entire track is".
//
// THE RULE EVERY CARD HERE FOLLOWS
// ================================
// Three jobs, every time, in this order:
//   1. WHAT THIS IS      — the plain definition, with an example, not a gloss.
//   2. HOW IT HELPS      — what knowing it buys you.
//   3. WHY NOW           — why this track opens at this point and not earlier.
// A term is introduced at the moment its track opens. That is the alternative to
// defining it inline at every use (which repeats) or in a glossary (which nobody
// opens).
//
// WHY THIS IS THE ONE LEGITIMATE EXCEPTION TO "RATHER THAN HYPOTHETICAL"
// ======================================================================
// lesson-steps.ts argues, repeatedly and correctly, that a rule should ride in on
// the first thing that actually needs it, so the contrast is real rather than
// hypothetical: okurigana's "fixed tail" card waits for the first fixed tail,
// rendaku waits for the first word that voices at a seam. A track intro breaks
// that rule on purpose, because it is by definition the thing you see before
// anything else in the track. There is no first item to ride in on that would not
// already have used the word.
//
// HIRAGANA CARRIES AN EXTRA JOB
// =============================
// It is the first card anyone sees, so it introduces `kana` itself (the thing
// hiragana is half of) and `romaji` (the thing every answer is typed in). Neither
// has anywhere earlier to live.
//
// THIS IS NOT WHY_TRACK, AND THE TWO MUST NOT DRIFT
// =================================================
// src/data/why.ts already holds per-track prose in the owner's own words, and the
// drafts below lean on it heavily. But WHY_TRACK is a COLLAPSED disclosure on the
// Home card: opened only by a reader who already wondered, which is exactly the
// reader who did not need it. This card is unskippable and comes first. When the
// copy below is rewritten, the two should be reconciled deliberately — either
// this file quotes why.ts or why.ts is trimmed to what this card does not say.
// Two independent descriptions of the same track is the failure phase-intros.ts
// exists to prevent one level down.

import type { PhaseIntro } from "@/data/phase-intros";

/** A track that opens with a card. The kana track splits in two, because the two
 * scripts open at different moments and say different things. */
export type TrackId =
  | "hiragana"
  | "katakana"
  | "radical"
  | "kanji"
  | "word"
  | "grammar"
  | "counters"
  | "keigo";

// DRAFT COPY — see the header. Rewrite freely; keep the three jobs.

export const HIRAGANA_TRACK: PhaseIntro = {
  id: "track-hiragana",
  setId: "hiragana",
  eyebrow: "What hiragana is",
  title: "Japanese is written in kana, and hiragana is the first half of it.",
  body: [
    {
      lead: "Kana is the Japanese alphabet.",
      text: "It comes in two sets, hiragana and katakana. A kana stands for a whole sound rather than a single letter: か is “ka”, き is “ki”. There are about forty-six in each set.",
    },
    {
      lead: "Hiragana is the set you are starting with.",
      text: "It spells native Japanese words and the endings that hold a sentence together, so it is on every page of a beginner's book. Books like Minna no Nihongo introduce it but never teach it in a way that sticks.",
    },
    {
      lead: "Japanese written in the letters you already know is called romaji.",
      text: "か is “ka”, さくら is “sakura”. It is how Japanese is typed on a keyboard, and it is what you write when you read a character back.",
    },
    {
      lead: "Katakana comes after this, and kanji after that.",
      text: "Hiragana comes first because it is the smallest set that lets you read anything.",
    },
  ],
};

export const KATAKANA_TRACK: PhaseIntro = {
  id: "track-katakana",
  setId: "katakana",
  eyebrow: "What katakana is",
  title: "Katakana is the other half of kana: the same sounds, a second set of shapes.",
  body: [
    {
      lead: "You already know how all of it sounds.",
      text: "カ is “ka”, exactly like か. Every sound you learned in hiragana is here again under a different shape, so the work is learning to recognize the shapes.",
    },
    {
      lead: "It marks a word as coming from somewhere else.",
      text: "Borrowed words are written in it: コーヒー is “coffee”, パン is “bread”. So are names and sound effects. You'll run into it constantly.",
    },
    {
      lead: "We teach it now because you already know the sounds and you'll need it soon.",
      text: "It is about the same size as hiragana. With both sets in hand you can read any Japanese word out loud.",
    },
  ],
};

export const RADICAL_TRACK: PhaseIntro = {
  id: "track-radical",
  setId: "",
  eyebrow: "What a radical is",
  title: "Radicals are the parts a kanji is built from.",
  body: [
    {
      lead: "A radical is a small shape that recurs inside many kanji.",
      text: "Kanji are the characters Japanese uses to write most of its words, and they are drawn out of a fixed stock of pieces. 氵 means water, and it’s used in 海 (sea), 泳 (swim) and 湖 (lake). 木 means tree, and it’s used in 林 (woods) and 森 (forest).",
    },
    {
      lead: "Knowing one gives you a head start on a kanji you have never seen.",
      text: "The radical often hints at what a kanji means, though it is only a hint. Many radicals are also characters you learn on their own, like 火 for fire, and a few are only ever building blocks. Here you learn it as a building block, so this track asks you only for its meaning.",
    },
    {
      lead: "Each one is taught just before the first kanji that uses it.",
      text: "That way a kanji is never taken apart into a piece you have not learned yet.",
    },
  ],
};

export const KANJI_TRACK: PhaseIntro = {
  id: "track-kanji",
  setId: "",
  eyebrow: "What kanji are",
  title: "A kanji carries a meaning, not only a sound.",
  body: [
    {
      lead: "One character, one meaning, and usually a sound.",
      text: "山 means mountain and is read “yama”. Sometimes a kanji is a whole word by itself. Sometimes it is one piece of a longer word, like the 火 inside 火山. The same character does both, depending on the word it is in.",
    },
    {
      lead: "Every kanji you learn helped you with words you have not seen yet.",
      text: "火 is fire and 山 is mountain, so the first time 火山 turns up you can guess it: a volcano, and nobody had to teach you the word. Learn a few hundred kanji and thousands of words become easier to learn.",
    },
    {
      lead: "They also show you where a word ends.",
      text: "Japanese doesn’t use spaces between words. The switch between kanji and kana is a large part of how you find the breaks in a solid row of characters.",
    },
    {
      lead: "It’s taught now because you can read every sound already.",
      text: "Kana taught you the sounds. Kanji is what teaches you the meaning, and it is the larger job, so it starts once the small one is done.",
    },
  ],
};

export const WORD_TRACK: PhaseIntro = {
  id: "track-word",
  setId: "",
  eyebrow: "What this track teaches",
  title: "Words are the part you actually speak and read.",
  body: [
    {
      lead: "This is what the scripts were for.",
      text: "先生 (teacher), 電車 (train), たべる (to eat). Kanji are the characters a word is written with, and grammar is how you join words into a sentence. The word is the thing in the middle that you say.",
    },
    {
      lead: "A word is taught here once you know every kanji in it.",
      text: "電車 isn’t taught until you have learned both 電 and 車, so when you learn it, you can put it together rather than memorize it. Words with no kanji at all, like これ and もう, have nothing blocking them.",
    },
    {
      lead: "Expect it to come in bursts.",
      text: "Nothing for a while, then several at once, as the kanji they need come in. Learning a word is also what settles which reading its kanji take, so this track is what gives those characters their real pronunciation.",
    },
  ],
};

export const GRAMMAR_TRACK: PhaseIntro = {
  id: "track-grammar",
  setId: "",
  eyebrow: "What grammar is here",
  title: "Grammar is how words become sentences.",
  body: [
    {
      lead: "A pattern is a rule for combining.",
      text: "It is what turns 食べる (“eat”) into “after eating”, “want to eat”, “please eat”. You learn it once and reuse it on every word you know.",
    },
    {
      lead: "Knowing words is not the same as knowing how to join them.",
      text: "A sentence needs the pattern as much as it needs the vocabulary. This is where Japanese and English differ the most. Word order, and the small words that mark who did what, both work differently.",
    },
    {
      lead: "You do not need a large vocabulary to start.",
      text: "Each pattern is taught on words you have already learned, so it opens as soon as the first ones are in hand. Kanji unlocks words; grammar is what you do with them.",
    },
  ],
};

// COUNTERS — the numbers-and-counters track (task 10). DRAFT copy, same as the
// rest of this file: four plain sentences doing the three jobs, for the owner to
// rewrite in her voice. Every string here is quoted in the task report.
export const COUNTERS_TRACK: PhaseIntro = {
  id: "track-counters",
  setId: "",
  eyebrow: "What this track teaches",
  title: "Counting in Japanese uses a small word that changes with what you count.",
  body: [
    {
      lead: "This track teaches numbers and counters.",
      text: "A counter is a short word you add to a number to count a kind of thing: 本 for long things, 人 for people. The number and the counter are said together as one word.",
    },
    {
      lead: "〜つ is taught first, because it works when nothing else does.",
      text: "ひとつ, ふたつ, みっつ count almost anything up to ten. When you do not know the right counter, this is the one to reach for, and you will still be understood.",
    },
    {
      lead: "It buys you the first useful sentences.",
      text: "Prices, ages, how many people, ordering food. Those are numbers and counters, so a little of this track goes a long way early on.",
    },
    {
      lead: "It’s taught now because it needs only kana to begin.",
      text: "The counting words are sounds before they are characters, so you can start them right after hiragana. The counters that lean on kanji wait until those kanji are learned.",
    },
  ],
};

// KEIGO — the politeness track (task 12). DRAFT copy, same status as the rest of
// this file: plain sentences doing the three jobs, for the owner to rewrite in
// her voice. The extra weight here is that it must INTRODUCE the two register
// words ("honorific", "humble") the recognition questions then use — a learner is
// not assumed to know them. Every string is quoted in the task report.
export const KEIGO_TRACK: PhaseIntro = {
  id: "track-keigo",
  setId: "",
  eyebrow: "What keigo is",
  title: "Japanese changes a verb by who you are speaking to, and about whom.",
  body: [
    {
      lead: "Keigo is the politeness system.",
      text: "The same action has more than one verb, and which one you use depends on whose action it is. 食べる (to eat) becomes 召し上がる when it is the other person eating, and いただく when it is you.",
    },
    {
      lead: "Raising the other person is called honorific.",
      text: "You use an honorific verb for what someone you respect does, to lift them up. 召し上がる is the honorific of 食べる, so “please eat” to a guest uses it. It is never used for yourself.",
    },
    {
      lead: "Lowering yourself is called humble.",
      text: "You use a humble verb for your own actions, to step back from the person you are speaking to. いただく is the humble of 食べる, so “I will eat” at someone's table uses it. It is only ever used for yourself.",
    },
    {
      lead: "For now you only have to recognize these, not produce them.",
      text: "いらっしゃいませ is the first thing said in any shop, and 召し上がる and いただく turn up early too. So this track opens as soon as you know the plain verb behind a set, and asks you what a keigo verb means and which of the two it is. Choosing the right one to say yourself comes later.",
    },
  ],
};

/**
 * Every track that opens with a card, and the card it opens with.
 *
 * EXACTLY ONE PER TRACK, and asserted as such in lesson-steps.test.ts. A track
 * with two would be two answers to "what is this", and a track with none is the
 * bug this file was written to fix.
 *
 * TRANSITIVITY IS ABSENT, DELIBERATELY. It already has an opening card —
 * TRANSITIVITY_INTRO in phase-intros.ts, gated on the first pair of a teach set —
 * written before this mechanism existed and doing the same three jobs. Adding a
 * second card here would show a learner two introductions to one track back to
 * back. If the copy below is ever rewritten wholesale, that card should be moved
 * into this table and gated the same way as the rest; until then the honest thing
 * is to leave the working card where it is.
 */
export const TRACK_INTROS: Readonly<Record<TrackId, PhaseIntro>> = {
  hiragana: HIRAGANA_TRACK,
  katakana: KATAKANA_TRACK,
  radical: RADICAL_TRACK,
  kanji: KANJI_TRACK,
  word: WORD_TRACK,
  grammar: GRAMMAR_TRACK,
  counters: COUNTERS_TRACK,
  keigo: KEIGO_TRACK,
};

/** The track ids, in the order a learner reaches them. */
export const TRACK_ORDER: readonly TrackId[] = [
  "hiragana",
  "katakana",
  "radical",
  "kanji",
  "word",
  "grammar",
  "counters",
  "keigo",
];
