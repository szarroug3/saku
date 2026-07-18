// The teaching cards — what the app says when the MATERIAL changes shape, not
// when a new character arrives.
//
// THE HOLE THIS FILLS
// ===================
// The curriculum in src/data/characters.ts is right and untouched: ten base
// rows, then the rows that take a mark, then the combos. But a learner who
// finished わ・を・ん used to be handed が with nothing said, and had to infer
// from five cards that ゛ voices a consonant and that が is not a new drawing.
// The same silence met きゃ. And long vowels — a rule that changes what a word
// MEANS — were never mentioned at all, because they are not a set of characters
// and so had nowhere to live in a curriculum made of characters.
//
// A phase intro is a step in the teach walk that teaches a CONCEPT instead of a
// glyph. It is anchored to a section id, so it is a property of the curriculum
// and appears exactly where that section does — no cursor, no flag on disk, and
// a phase with no intro behaves exactly as it did before this file existed.
//
// BEFORE vs AFTER
// ===============
// Two anchors, because two different things are being said:
//   BEFORE the first group of a phase — "here is what is about to change".
//     Dakuten/handakuten (h-g, k-g) and combos (h-kya, k-kya).
//   AFTER the last group of a script — "you have every shape now; here is the
//     rule that isn't a shape". Long vowels and then small っ (both on h-pya,
//     k-pya), which is the only honest place for either: nothing about おばあさん
//     or きって is a new character to draw, and teaching them before the shapes
//     are done would interrupt the shapes to talk about something that needs
//     all of them.
//
// PER SCRIPT, WITH THAT SCRIPT'S GLYPHS
// =====================================
// Each intro exists twice because each phase happens twice. A katakana learner
// meeting ガ is shown カ → ガ, not か → が: they have already done the hiragana
// run, and re-showing hiragana there would be the app talking about the wrong
// alphabet. The long-vowel pair diverges further, because the two scripts
// genuinely do it differently — vowel kana in hiragana, one dash in katakana —
// and the katakana card leans on the hiragana one having been read.
//
// NOT DRILLABLE, ON PURPOSE
// =========================
// Nothing here produces a FactId. These are read, not graded, and inventing a
// fact for "how do you lengthen え" would put a rule into a drill built to ask
// about glyphs. See the note at the bottom of this file.

/**
 * One paragraph of an intro.
 *
 * `mark` is a bare glyph the paragraph is ABOUT — ゛ and ゜, which are the whole
 * subject of the dakuten card and are two specks at body size. It gets its own
 * slot so the view can set it large in the kana font; run inline it is
 * unreadable, which is a poor way to introduce a mark.
 *
 * `lead` is the phrase the paragraph opens on, set apart so the eye can find
 * the point without reading the sentence.
 */
export interface IntroPara {
  mark?: string;
  lead?: string;
  text: string;
}

/** A teaching card: one concept, shown as a step of the teach walk. */
export interface PhaseIntro {
  /** Stable id — React key, and what a test names. */
  id: string;
  /** Which script's run this copy belongs to. */
  setId: string;
  /** One line, the whole point of the card. */
  title: string;
  body: IntroPara[];
}

// THE CARDS ARE EXPORTED, ONE BY ONE, AND THAT IS NEW
// ===================================================
// They used to be module-private, reachable only through INTRO_BEFORE /
// INTRO_AFTER — which was right while the teach walk was the only reader, since
// the walk wants "the card for section h-g" and never "the dakuten card".
//
// The Library's MARKS shelf (src/data/marks.ts) wants the other question: the
// page for ゛ needs the dakuten copy, and it has no section id to ask with. So
// each card is named and exported. The alternative was for the Library to author
// its own explanation of dakuten, which is the exact failure this file exists to
// prevent one level down — a learner who is taught a rule in a lesson and reads a
// DIFFERENT description of it in the reference has been given two rules.
//
// Nothing about the walk changes: the anchors below are still how a lesson finds
// its card, and they still key on section ids.

export const DAKUTEN_H: PhaseIntro = {
  id: "intro-dakuten-hiragana",
  setId: "hiragana",
  title: "Two marks change the sound, not the character.",
  body: [
    {
      mark: "゛",
      lead: "(dakuten) — two dashes.",
      text: "It voices the consonant, meaning your vocal cords buzz: か ka → が ga, さ sa → ざ za, た ta → だ da, は ha → ば ba.",
    },
    {
      mark: "゜",
      lead: "(handakuten) — a small circle,",
      text: "and it only ever lands on the は row: は ha → ぱ pa.",
    },
    {
      text: "You already know every shape here. か and が are the same character wearing a mark, so this is 25 more sounds without a single new drawing to learn.",
    },
  ],
};

export const DAKUTEN_K: PhaseIntro = {
  id: "intro-dakuten-katakana",
  setId: "katakana",
  title: "Two marks change the sound, not the character.",
  body: [
    {
      mark: "゛",
      lead: "(dakuten) — two dashes.",
      text: "It voices the consonant, meaning your vocal cords buzz: カ ka → ガ ga, サ sa → ザ za, タ ta → ダ da, ハ ha → バ ba.",
    },
    {
      mark: "゜",
      lead: "(handakuten) — a small circle,",
      text: "and it only ever lands on the ハ row: ハ ha → パ pa.",
    },
    {
      text: "The marks work exactly as they did in hiragana, on shapes you already know. カ and ガ are the same character wearing a mark, so this is 25 more sounds without a single new drawing to learn.",
    },
  ],
};

export const COMBO_H: PhaseIntro = {
  id: "intro-combo-hiragana",
  setId: "hiragana",
  title: "A small や, ゆ or よ fuses onto the kana in front of it.",
  body: [
    {
      text: "A full-size kana followed by a SMALL や, ゆ or よ is one syllable, not two: き + ゃ is “kya”, said in a single beat — not “ki-ya”.",
    },
    {
      lead: "The size is the whole tell.",
      text: "きゃ, with the small ゃ, is “kya”. きや, with a full-size や, is “kiya” — two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
    },
    {
      text: "No new shapes again. Every combo is two characters you already know, one of them shrunk.",
    },
  ],
};

export const COMBO_K: PhaseIntro = {
  id: "intro-combo-katakana",
  setId: "katakana",
  title: "A small ャ, ュ or ョ fuses onto the kana in front of it.",
  body: [
    {
      text: "A full-size kana followed by a SMALL ャ, ュ or ョ is one syllable, not two: キ + ャ is “kya”, said in a single beat — not “ki-ya”.",
    },
    {
      lead: "The size is the whole tell.",
      text: "キャ, with the small ャ, is “kya”. キヤ, with a full-size ヤ, is “kiya” — two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
    },
    {
      text: "Same rule as the hiragana combos, on shapes you already know. Nothing new to draw.",
    },
  ],
};

export const LONG_H: PhaseIntro = {
  id: "intro-long-vowel-hiragana",
  setId: "hiragana",
  title: "A held vowel is a different word, not a decoration.",
  body: [
    {
      text: "おばさん is “aunt”; おばあさん is “grandmother”. ゆき is “snow”; ゆうき is “courage”. Hold the vowel a beat longer and you have said something else, so length is part of the word.",
    },
    {
      lead: "In hiragana you write the extra length with a vowel kana:",
      text: "あ+あ, い+い, う+う.",
    },
    {
      lead: "Two that surprise people.",
      text: "え is usually lengthened with い — せんせい is said “sensee”, not “sen-say”. And お is usually lengthened with う — おとうさん is said “otoosan”, not “oto-u-san”.",
    },
    {
      text: "This is a rule, not a new set of characters. There is nothing here to draw — only something to listen for.",
    },
  ],
};

export const LONG_K: PhaseIntro = {
  id: "intro-long-vowel-katakana",
  setId: "katakana",
  title: "Katakana holds a vowel with one long dash.",
  body: [
    {
      text: "The rule is the one you met in hiragana — a held vowel is a different word — written a different way. Katakana uses a single dash, ー, whatever the vowel is: コーヒー (coffee), ケーキ (cake).",
    },
    {
      lead: "One mark covers all five vowels,",
      text: "so there is no え+い or お+う to remember on this side. ー just means “hold the vowel before it”.",
    },
    {
      text: "It follows the direction of the writing: horizontal in a horizontal line, and turned upright when the text runs down the page.",
    },
  ],
};

// SMALL っ — ANCHORED LAST, AFTER LONG VOWELS
// ==========================================
// These two cards were authored before they had anywhere to go, and for a while
// the Library's MARKS shelf was their only reader. The reason was the
// curriculum: src/data/characters.ts has a section for every base row, every
// marked row and every combo, and NONE for the small tsu. It is not a set of
// characters — it is one character that stands for a beat of silence — so,
// exactly like long vowels, it had nowhere to live in a curriculum made of
// characters.
//
// They now close each script, in INTRO_AFTER, on the same last-combo anchor the
// long-vowel cards use (h-pya / k-pya). The earlier note here guessed at
// INTRO_BEFORE against a section the curriculum might grow, and ruled out
// hanging it off h-kya because that would teach two unrelated rules in one
// breath. Both of those still hold. What changed is that AFTER turns out to be
// the right shelf and already exists: っ is not a phase that starts, it is a
// rule that lands once every shape is known, which is the exact thing AFTER is
// for.
//
// WHY AFTER THE COMBOS, AND NOT BEFORE OR AMONG THEM
// --------------------------------------------------
// The sokuon copy leans on the combos having been read — "Look at the height,
// exactly as you do with ゃ" is a callback, and it only works if ゃ is behind
// the learner. Tofugu's hiragana guide reaches the same order for the same
// reason and frames っ as the closer: combination kana, and then one little
// thing left. This is where a learner who can read everything else meets the
// one shape that is not a sound.
//
// WHY AFTER LONG VOWELS, WHICH SHARE THE ANCHOR
// ---------------------------------------------
// Both cards close on h-pya, so one of them is last and the choice had to be
// made rather than fallen into. っ goes last: it is the closing beat of the
// kana curriculum, the point where the script is genuinely finished.
//
// The honest counter-argument, recorded because it is a real one: っ is a
// SHAPE — a shrunken つ, continuous with the small-kana logic the combos just
// taught — while long vowels are the purest "rule that isn't a shape" in the
// file. Ordering っ first would group the shape-ish material together and let
// the run end on the most abstract card. That reading is defensible; the
// placement above was chosen deliberately over it, and reversing it is a
// reordering of one array below and nothing else.

export const SOKUON_H: PhaseIntro = {
  id: "intro-sokuon-hiragana",
  setId: "hiragana",
  title: "A small っ is not a sound. It doubles the next consonant.",
  body: [
    {
      mark: "っ",
      lead: "(small tsu) — a shrunken つ.",
      text: "It is never said on its own. It stops the mouth for one beat and doubles the consonant that comes after it: きて kite → きって kitte, さか saka → さっか sakka.",
    },
    {
      lead: "The size is the whole tell, again.",
      text: "きって, with the small っ, is “kitte”. きつて, with a full-size つ, would be “kitsute” — three separate sounds. Look at the height, exactly as you do with ゃ.",
    },
    {
      lead: "It is a beat, not a gap.",
      text: "The pause takes as long as any other kana does, which is why きて and きって are two different words rather than one word said carelessly.",
    },
  ],
};

export const SOKUON_K: PhaseIntro = {
  id: "intro-sokuon-katakana",
  setId: "katakana",
  title: "A small ッ does the same thing on this side.",
  body: [
    {
      mark: "ッ",
      lead: "(small tsu) — a shrunken ツ.",
      text: "The rule you met in hiragana, on katakana shapes: ベッド beddo (bed), カップ kappu (cup), サッカー sakkā (soccer).",
    },
    {
      lead: "Borrowed words are full of it,",
      text: "because the languages Japanese borrows from are full of consonants that land hard. If a loanword stops short in the middle, expect a ッ there.",
    },
  ],
};

/**
 * Section id → the card shown BEFORE that section's characters.
 *
 * Keyed on the FIRST group of each phase, so the concept lands the moment the
 * phase starts and never again.
 */
export const INTRO_BEFORE: Record<string, PhaseIntro> = {
  "h-g": DAKUTEN_H,
  "k-g": DAKUTEN_K,
  "h-kya": COMBO_H,
  "k-kya": COMBO_K,
};

/**
 * Section id → the cards shown AFTER that section's characters, IN ORDER.
 *
 * Keyed on the LAST group of each script: by then every shape in that script
 * has been taught, which is exactly what the long-vowel and sokuon cards both
 * assume.
 *
 * A LIST, where INTRO_BEFORE is a single card, and the asymmetry is the point
 * rather than an oversight. "Before" is the moment a phase opens and only one
 * thing can be about to change, so a second card there would be a second
 * answer to a question with one. "After" is the end of the script, where every
 * rule that is not a shape has been waiting for exactly this moment — long
 * vowels and small っ both come due at once, and the file would be lying if the
 * type said only one of them could.
 *
 * The order within the array is the order the walk shows them; see the long
 * note above SOKUON_H for why っ closes.
 */
export const INTRO_AFTER: Record<string, PhaseIntro[]> = {
  "h-pya": [LONG_H, SOKUON_H],
  "k-pya": [LONG_K, SOKUON_K],
};

/** Every intro, for tests and for anything that wants to list them.
 *
 * Every card here is now reachable from a lesson: the sokuon pair was the one
 * exception for as long as the curriculum had nowhere to put it, and closing
 * each script on it is what settled that. The order below is the order a
 * learner meets them, one script then the other, which is also the order the
 * anchor tables produce. */
export const PHASE_INTROS: PhaseIntro[] = [
  DAKUTEN_H,
  COMBO_H,
  LONG_H,
  SOKUON_H,
  DAKUTEN_K,
  COMBO_K,
  LONG_K,
  SOKUON_K,
];

// NOT BUILT, AND SAY SO
// =====================
// Long vowels are the one phase here with a plausible drillable question, and
// it is deliberately unbuilt. The question would be a PRODUCTION one — "write
// “grandmother” / せんせい / コーヒー in kana" — graded on the kana
// string, or its recognition twin, "おばさん or おばあさん?" for a given gloss.
// Both need a vocabulary the app does not have yet (the drill asks about
// glyphs, and the answer here is a word), and a wrong answer would be marked
// against a fact id that does not exist. When words arrive, that is where this
// belongs — as a word fact with a length trap — not as a kana fact.
