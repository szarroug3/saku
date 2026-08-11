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
      lead: "Each kana is one beat.",
      text: "Japanese is spoken in even beats of the same length, and each beat is called a mora. Every kana is one mora: さくら is three, さ・く・ら. This steady beat is the rhythm of the language, and later it is what a word's pitch is drawn over.",
      accent: "mora",
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
      lead: "It’s taught now because you already know the sounds and you'll need it soon.",
      text: "It is about the same size as hiragana. With both sets in hand you can read any Japanese word out loud.",
    },
  ],
};

// THE THREE SPINE CARDS ARE ONE LADDER, AND THEY READ TOP DOWN.
// =============================================================
// Words are what a learner is here for. Words are written with kanji. Kanji are
// drawn from radicals. That is one ladder, and the cards say so out loud now,
// each opening on the rung above it, because they used to be three unrelated
// track introductions that never mentioned each other.
//
// They fire descending: the kanji card at the first kanji, the radical card at
// the first shape that is only ever a part, the word card at the first word
// written out of characters already learned. See ANCHOR_RULE in
// src/lib/spine-intros.ts.
//
// THE RADICAL CARD HAS THE HARDEST JOB. The owner hit the confusion herself while
// testing: 口 is labelled "Radical · Kanji · Word", and she asked how something
// can be both a radical and a kanji. The answer the card has to land is that
// "radical" describes what other kanji are built from and says nothing whatever
// about whether the shape can stand alone. Some radicals are whole kanji (人, 大,
// 口); some are only ever parts (气, 亅). Both are radicals, for the same reason.

export const RADICAL_TRACK: PhaseIntro = {
  id: "track-radical",
  setId: "",
  eyebrow: "What a radical is",
  title: "A radical is a piece other kanji are built out of.",
  body: [
    {
      // THE DISTINCTION LEADS NOW. The card fires ahead of the first character
      // that plays the role at all, which is 人: a radical, a kanji and a word
      // at once, with a tile that says so. So the first thing it has to answer is
      // the question that label provokes, and the "氵 inside 海" example waits
      // for the paragraph after it.
      lead: "Being a radical says nothing about whether a character stands alone.",
      text: "It answers one question: do other kanji get built out of this shape? 人 is a radical, and it is also a kanji you learn and a word you can say, all at once. 气 is a radical and nothing else, so you will only ever see it inside another character. Both get the label, because both are pieces.",
    },
    {
      lead: "One step below kanji.",
      text: "Words are written with kanji, and kanji are drawn from a small stock of these pieces. 氵 is the water piece, and it is inside 海 (sea), 泳 (swim) and 湖 (lake). Recognizing a piece gives you a head start on a character you have never seen, though it is a hint and not a promise.",
    },
    {
      // Lesson-only: this is about WHEN each piece turns up in the walk, which is
      // true while you are being led through the track but not something a Library
      // reader (who arrived at this page directly) needs. The library term page
      // filters lessonOnly paragraphs; the teach walk keeps them.
      lessonOnly: true,
      lead: "Each piece turns up just before the character that needs it.",
      text: "So a kanji is never broken into a shape you have not seen. When a piece is a kanji too, learning that kanji is where you get the shape, and its card tells you every part it plays.",
    },
  ],
};

export const KANJI_TRACK: PhaseIntro = {
  id: "track-kanji",
  setId: "",
  eyebrow: "What kanji are",
  title: "Kanji are the characters Japanese words are written with.",
  body: [
    {
      lead: "A kanji stands for a meaning or an idea, not a fixed sound.",
      text: "Kana spells sounds and nothing else. A kanji stands for an idea, and the sound it takes depends on the word it's in. 人 means person no matter where it is. It is said ひと as a word by itself, じん in the word 外国人, にん in the word 三人. One character, one meaning, several pronunciations.",
    },
    {
      lead: "A kanji is not one shape to memorize.",
      text: "Each one is assembled from smaller pieces called radicals. This can help give you an idea of what the kanji might mean.",
    },
  ],
};

export const WORD_TRACK: PhaseIntro = {
  id: "track-word",
  setId: "",
  eyebrow: "What words add",
  title: "Words are the part you actually speak and read.",
  body: [
    {
      lead: "This is what the characters were for.",
      text: "先生 (teacher), 電車 (train), たべる (to eat). Radicals build kanji, kanji spell words, and the word is the thing you say. Grammar is how you join them into a sentence.",
    },
    {
      lead: "A word arrives once you know the kanji it is written with.",
      text: "電車 waits until both 電 and 車 are learned, so when it turns up you can assemble it instead of memorizing it whole. Words with no kanji in them, like これ and もう, have nothing to wait for.",
    },
    {
      lead: "Expect these in bursts.",
      text: "Nothing for a stretch, then several at once, as the kanji they need come in. Learning a word is also what settles which reading its kanji take, so this is where those characters get their real pronunciation.",
    },
  ],
};

// VARIANT FORMS — the concept card, a sibling of the radical card and one rung
// beside it. A character can change shape by where it sits inside a kanji (人 →
// 亻, 水 → 氵, 心 → 忄), and the app already links the reshaped form back to the
// character but never SAID the two are one. This card is the first thing that
// does, so it fires once, ahead of the first item that teaches a variant at all
// (see the variant anchor in src/lib/spine-intros.ts). It is not a track and so
// is not in TRACK_INTROS; it is a once-ever concept card whose id lives in
// CONCEPT_CARD_IDS (src/lib/intro-shown.ts).
//
// The `examples` are common, real jōyō kanji, each built from the form it shows:
// 体 from 亻, 海 from 氵, 情 from 忄. They are illustrative rather than derived, the
// way every other concept card here names its own examples.
export const VARIANT_INTRO: PhaseIntro = {
  id: "intro-variant-forms",
  setId: "",
  eyebrow: "What a variant form is",
  title: "A character changes shape depending on where it sits inside a kanji.",
  body: [
    {
      lead: "The character is the same; only its drawing changes.",
      text: "人 is written 亻 when it stands on the left of a kanji, as in 体. It is still 人, it still means person, and it is still the character you learned. A piece is just redrawn to make room for what sits beside it.",
    },
    {
      lead: "So a form is one less shape to learn, not one more.",
      text: "亻, 氵 and 忄 are not new characters. Once you see that 亻 is 人, 氵 is 水 and 忄 is 心, a kanji built from them is built from pieces you already know.",
    },
    {
      lead: "Where a form appears is a clue to which character it is.",
      text: "A form keeps to a position: 亻 on the left, ⺗ underneath, 辶 wrapping the bottom. When a lesson meets one, it tells you the character it belongs to and where it sits, so you are never left to guess.",
    },
  ],
  examples: [
    { from: "人", op: "→", to: "亻", gloss: "on the left of 体, body" },
    { from: "水", op: "→", to: "氵", gloss: "on the left of 海, sea" },
    { from: "心", op: "→", to: "忄", gloss: "on the left of 情, feeling" },
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
      lead: "Counters are for things; a bare number is for the number itself.",
      text: "Counting specific things takes a counter: 本 for pens, 人 for people. A number with no counter is for the number as a number. Math, a phone number, a price, a page, a year. English blurs the two, since “one apple” and “the number one” are both “one”; Japanese keeps them apart, so いち is the number one and ひとつ or いっぽん do the counting.",
    },
  ],
};

// A NON-TERM ADDITIONAL INTRO PAGE. Some tracks want an intro card that is not a
// term-page definition — here, the escape-hatch pitch for 〜つ, shown right after
// the counter intro and before the first 〜つ form is taught. It is not a term (there
// is no "〜つ" glossary word), so it lives as its own intro card rather than on a
// term page.
export const TSU_INTRO: PhaseIntro = {
  id: "intro-tsu",
  setId: "",
  eyebrow: "Where to start",
  title: "〜つ works when nothing else does.",
  body: [
    {
      text: "〜つ can count almost anything up to ten. When you don’t know the right counter, this one still works, and you’ll be understood.",
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
      text: "The same action has more than one verb, and which one you use depends on whose action it is: the person you are speaking to, or you yourself.",
    },
    {
      lead: "It is a whole different word, not a changed one.",
      text: "This is the part people expect to be like grammar, and it is not. You do not conjugate the verb or add an ending. A keigo verb replaces the plain verb outright: it is a separate word you learn on its own and use in place of the one you already know.",
    },
    {
      lead: "Raising the other person is called honorific.",
      text: "You use an honorific verb for what someone you respect does, to lift them up. It is never used for yourself.",
    },
    {
      lead: "Lowering yourself is called humble.",
      text: "You use a humble verb for your own actions, to step back from the person you are speaking to. It is only ever used for yourself.",
    },
    {
      lead: "Some kanji come before the verbs that use them.",
      text: "A keigo verb is often written with kanji you have not met. Before the verb, the lesson teaches those kanji and the smaller radicals they are built from, so the verb reads as pieces you already know rather than a set of new shapes. These pieces are not keigo themselves; they are just what this particular verb is spelled with.",
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
