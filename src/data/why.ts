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
   * (bolded on screen) plus, optionally, the plain rest of the sentence — it
   * stands alone if the reader never opens the rest, and never blocks the button
   * below it.
   *
   * `rest` is OPTIONAL on purpose. A lede whose second sentence only previews
   * what the paragraphs already say is telling the reader the same thing twice,
   * once before they asked; in that case the strong fragment alone is the honest
   * line and the reasoning belongs entirely behind the "why?".
   */
  lede: { strong: string; rest?: string };
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
    },
    paras: [
      "Japanese isn’t written with the letters you already know. There’s no way to sound あ out with A, B, C: it’s a separate system, and you can’t step around it to get to the “real” Japanese later. Hiragana is where that system starts.",
      "Each hiragana stands for a sound: か is “ka”, き is “ki”. There are about forty-six of them. Those plus a couple of marks you will learn shortly can spell any Japanese word out loud. That’s why a beginner’s book opens assuming you have them already: lesson one is printed in hiragana, with nothing telling you so.",
      "There are two other writing systems, and hiragana goes ahead of both on purpose. Katakana is a second set of shapes for these same sounds, and you’ll want it soon. Kanji are a much bigger job that comes later. Hiragana is the small set that unlocks the most, so it’s the door in.",
    ],
  },
  katakana: {
    lede: {
      strong: "Katakana is next: the same sounds, a second set of shapes.",
      rest: "Nothing new to pronounce, only new shapes to recognize.",
    },
    paras: [
      "Katakana spells the exact same sounds hiragana does. カ is “ka”, just like か. You already know how all of it sounds; you’re only learning to recognize a second way of writing it.",
      "It’s used for words borrowed from other languages (コーヒー is “coffee”) and for names and sound effects. You run into it constantly, so it’s worth having in hand before you spend real time on words.",
      "It’s about the same size as hiragana and reuses sounds you already have, which is why it’s a quick second step rather than something completely new.",
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
      strong: "You only ever use words, so why learn kanji?",
      rest: "Because every kanji you know is a discount on words you haven’t seen yet.",
    },
    paras: [
      "You’re right that you never really “use” a lone kanji. You use words. But kanji are how words are built, and knowing the pieces means new words aren’t fully new.",
      "火 is fire. 山 is mountain. The first time you see 火山, you can guess it: fire-mountain, a volcano, and nobody had to teach you that word. Learn a few hundred kanji and thousands of words stop landing as strangers.",
      "There’s a second reason, and it isn’t optional. Japanese doesn’t put spaces between words. Kanji are a big part of how you tell where one word ends and the next begins: they break a solid row of characters into pieces your eye can grab.",
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
      "Sometimes a kanji is a whole word by itself: 山 is the word “mountain”. Sometimes it’s just one piece of a longer word: the 火 inside 火山. Both are completely normal, and the same kanji does both depending on the word it’s in.",
    ],
  },
  {
    id: "what-radical",
    lede: {
      strong: "What’s a radical? Is it a word?",
      rest: "It’s a building block of a kanji, and most of them are kanji themselves.",
    },
    paras: [
      "Kanji are built out of smaller parts, and a radical is one of those parts. Most radicals are themselves kanji you’ll learn on their own: 火 (fire) is a part you’ll find inside other kanji and also a character in its own right.",
      "A few radicals are only ever building blocks and never show up as a character you’d study by itself: shapes like 宀 or ノ. So not every radical is a word, but the large majority are kanji you’ll run into anyway.",
    ],
  },
];

/**
 * The stroke-order rationale, in the owner's own words.
 *
 * ONE COPY, TWO PANELS, and they disagree about what to DO with it. The
 * Library's panel is encouraging (a reference you looked something up in);
 * the lesson's is discouraging (do not drill handwriting yet). Those are the
 * ledes and the paragraphs that follow. But WHY stroke order matters is the
 * same argument in both places, so it lives here once and must not drift into
 * two slightly different versions again.
 */
const STROKE_ORDER_RATIONALE =
  "Every character has a correct order and direction to draw its strokes, and it isn’t arbitrary. In addition to being the traditional way of writing, stroke order is worth learning because when you follow it, the shape comes out balanced and legible almost by itself. The rules (top to bottom, left to right) are what the shapes were designed around. When you write it a different way, even the same strokes tend to land lopsided. Learning the order is the fastest way to write characters that actually look right. This is especially important when writing by hand.";

/**
 * Why stroke order matters — and why it's worth learning.
 *
 * Shown on the "how it's written" section. This is the fuller answer for the
 * reader who opens it: what stroke order actually buys you, and why picking it up
 * with each character is worth doing rather than a chore to defer. Content about
 * the language, not the app — see the file header.
 *
 * NO `rest`, DELIBERATELY. The lede used to carry a second sentence — that stroke
 * order makes shapes come out even and is what handwriting input and paper
 * dictionaries expect — which is precisely the claim the paragraphs below already
 * make, at length and with the reason attached. On screen that read as the answer
 * being given twice: once as an unsupported assertion nobody asked for, then again
 * properly behind the "why?". So the claim now lives only where it is actually
 * argued, and the line on the page is the bare, honest one.
 */
export const WHY_STROKE_ORDER: Why = {
  lede: {
    strong: "Stroke order is worth learning with each character.",
  },
  paras: [
    STROKE_ORDER_RATIONALE,
    "It pays off the moment you write anything by hand. Handwriting-recognition input (the way you’ll look up a character you can’t yet type) and paper kanji dictionaries both assume the standard order: draw a character the usual way and they follow along; draw it your own way and they lose you. Learn the order now and that door is already open when you need it.",
  ],
};

/**
 * Why we steer a beginner away from learning to WRITE this early — the reasoning
 * behind the "how it's written" section being collapsed by default on every
 * stepped lesson card.
 *
 * This is the single home for that copy: the lesson's collapsed notice reads its
 * lede and paragraphs from here rather than hardcoding them, so the wording lives
 * in one place. The notice adds one more line on screen — the app-specific "use
 * the Show button" out — which is deliberately NOT here, because this file holds
 * content about the language, never instructions about a control (see header).
 *
 * Distinct from WHY_STROKE_ORDER on purpose: that one is the encouraging note
 * shown on the Library reference page, where the diagram is always open; this one
 * is the "not yet" the lesson leads with. Two different messages, kept apart.
 */
export const WHY_WRITING_EARLY: Why = {
  lede: {
    strong: "We don’t recommend learning to write early.",
  },
  paras: [
    STROKE_ORDER_RATIONALE,
    "People don’t do much handwriting these days with so much technology around. Japanese is a difficult language to learn coming from a western language that doesn’t use the same writing system. We think your time is better spent learning how to read, speak, and understand what you hear.",
  ],
};

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
  radical: {
    lede: {
      strong: "Radicals are the building blocks kanji are made of.",
      rest: "You learn each one just before the first kanji that uses it, so a kanji is never broken down into a piece you haven’t seen.",
    },
    paras: [
      "A radical is a small shape that recurs inside many kanji, and it usually hints at what those kanji mean. The water radical 氵 turns up in kanji about water and liquids: 海 (sea), 泳 (swim), 湖 (lake). The tree radical 木 turns up in kanji about trees and wood: 林 (woods), 森 (forest). So spotting a familiar radical gives you a head start on what a brand-new kanji means, not just how it is drawn. It is a strong hint rather than a promise, since some radicals are only structural.",
      "A radical is usually not a word you speak, it’s a component. This track only asks you for its meaning, because that meaning is what you bring to the kanji that use it.",
      "We teach a radical just before the first kanji that needs it. Once you know that radical’s meaning, the kanji that uses it unlocks. A handful of radicals appear in no common kanji; those are taught at the very end, for completeness.",
    ],
  },
  kanji: {
    lede: {
      strong: "Kanji are used as both words and as building blocks for other words.",
      rest: "Radicals, the smaller shapes kanji are built from, are taught right here too, each one just before the first kanji that uses it.",
    },
    paras: [
      "Kanji are reused across many words, so learning one can open up several at once. That makes the pace uneven. Some days you will have a pile of new words, some days none, because you are still collecting the kanji they need.",
      "Each kanji is built around a smaller shape called a radical, and the radical often hints at the meaning: the water shape 氵 shows up in 海 (sea) and 泳 (swim). Most radicals are themselves kanji you learn on their own. A handful are only ever building blocks and never a character you would study by itself, like the steam shape 气 inside 気. Those get their own tile here, marked as a radical, taught just before the kanji that needs them, so a kanji is never broken into a piece you have not seen.",
      "Each kanji can also have multiple readings, and words are what pin down which reading is used. Learning kanji first gives you the pieces, and learning words gives those pieces real pronunciation and context. The most common kanji come first.",
    ],
  },
  // THE ONE CURRICULUM CARD. Radicals, kanji and words are taught in a single
  // order now (src/lib/curriculum-order.ts), so the card that teaches all three
  // needs one explanation instead of the kanji one stacked on the words one. The
  // `kanji`, `radical` and `words` entries below are kept: the Library shelves
  // and the track intros still speak about one kind of thing at a time.
  curriculum: {
    lede: {
      strong: "Radicals, kanji and words are one climb, so they arrive in one order.",
      rest: "Each lesson teaches whatever comes next, and nothing arrives before the pieces it is built from.",
    },
    paras: [
      "A word is what you actually speak and read, and most words are written with kanji. A kanji is built around smaller shapes called radicals. So the three are a chain, and we teach them in the order that chain runs: the shapes a kanji is made of, then the kanji, then the words those kanji spell.",
      "That is why a lesson can look mixed. Some sittings are two kanji and the shape they share; some are a handful of words your last few kanji just paid for. The pace is uneven on purpose, because kanji are reused across many words and learning one can open several at once.",
      "A few shapes are only ever building blocks and never a character you would study by itself, like the steam shape 气 inside 気. Those get their own tile, marked as a radical, and they always sit just before the kanji that needs them. Words written with no kanji at all (これ, もう, とても) have nothing to wait for, so they turn up early.",
    ],
  },
  words: {
    lede: {
      strong: "Words are the part you actually speak and read.",
      rest: "Most are made of kanji, so they unlock as you learn those.",
    },
    paras: [
      "Words are the real goal: 先生, 電車, たべる are the things you say and understand. Kanji and grammar both feed into this track: kanji are the characters a word is written with, grammar is how you string words into a sentence.",
      "A word is only taught here once you know every kanji in it (電車 waits until you’ve learned both 電 and 車), because showing a compound built from pieces you don’t have is teaching a shape with nothing under it. That’s why the words above so often point you back to the kanji track: the fastest way to unlock more words is to learn the kanji they’re made of.",
      "Words with no kanji at all (これ, もう, とても) have nothing to unlock, so you can learn them straight away. That’s why the earliest words you can practise here are the kana-only ones.",
    ],
  },
  grammar: {
    lede: {
      strong: "Grammar is how words become sentences.",
      rest: "Knowing words isn’t the same as knowing how to connect them.",
    },
    paras: [
      "Grammar is the patterns that turn 食べる (“eat”) into “after eating”, “want to eat”, “please eat”. It’s a different kind of thing from a word or a kanji. It's a rule for combining, not another item to memorize.",
      "You don’t need a big vocabulary before you start because a pattern is taught with words you already know. Kanji unlocks words; grammar is what you do with those words once you know them.",
      "Patterns are taught starting with the easiest ones first so early grammar leans on the simple verbs and words you’re already learning in the other tracks.",
    ],
  },
  // DRAFT COPY, to be rewritten in the owner's voice — the same status as the
  // counters track intro (track-intros.ts) and its sound-change rule card
  // (phase-intros.ts). It does the two jobs the others do: what the track gives
  // you, and how its gate reads.
  counters: {
    lede: {
      strong: "Counting in Japanese uses a small word that changes with what you count.",
      rest: "A counter is a short word you add to a number, and the number and counter are said together as one word.",
    },
    paras: [
      "To count things you pair a number with a counter: 本 for long thin objects, 人 for people, 枚 for flat things. 三本 is three long thin objects, 三人 is three people. The counter depends on the shape or kind of what you are counting, and a few of them change sound as the number in front of them changes.",
      "〜つ is taught first because it is the one you can reach for when you do not know the right counter. ひとつ, ふたつ, みっつ count almost anything up to ten, and you will still be understood.",
      "The first counters need only kana, so they open right after hiragana. The ones written with a number kanji wait until that kanji is learned, the same way a word waits for its kanji.",
    ],
  },
  // DRAFT COPY, to be rewritten in the owner's voice — same status as the keigo
  // track intro (track-intros.ts). It does the two jobs: what the track gives
  // you, and how its gate reads (it opens on a plain verb you already know).
  keigo: {
    lede: {
      strong: "Keigo is politeness: the same verb changes shape by whose action it is.",
      rest: "You already know the plain verb; this teaches the honorific form (for what someone else does) and the humble form (for what you do).",
    },
    paras: [
      "Japanese has more than one word for the same action, and which one you use depends on who is doing it. For what a person you respect does, you use the HONORIFIC form, to raise them: 食べる becomes 召し上がる. For what you do yourself, you use the HUMBLE form, to step back: 食べる becomes いただく. It is the same eating either way, but using the wrong one is like bowing to yourself, and it is heard immediately.",
      "A set opens as soon as you know the plain verb it replaces, so keigo starts early, on words you already have. For now, you just need to recognize these, not produce them yourself. That’ll come later.",
    ],
  },
  transitivity: {
    lede: {
      strong: "Some verbs come in twos: one for when it happens, one for when you do it.",
      rest: "You already know both verbs on their own; this teaches which one goes with which situation.",
    },
    paras: [
      "Japanese often has two verbs for the same event: one for when something happens on its own, and one for when someone makes it happen. 開く is “the door opened”, 開ける is “I opened the door”. It is the same door and the same event, but the two sentences use different verbs, and picking the wrong one sounds wrong the way “the door was opened by itself on purpose” would in English.",
      "A pair is taught only once you have learned both of its verbs as vocabulary, because the choice between them means nothing until you know both. The endings shift in familiar ways, but the shift never tells you which verb is which, and some pairs follow no pattern at all. So each pair is learned as a pair.",
    ],
  },
};
