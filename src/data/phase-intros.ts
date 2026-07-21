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

// THREE CARDS THAT ARE NOT KANA, AND ONE OF THEM HAS NO SCRIPT
// ============================================================
// Everything above teaches a rule of the kana era, and each such rule is taught
// twice, once per script, because a katakana learner meeting ガ should be shown
// カ → ガ and not か → が. Three of the rules this file now carries are not like
// that:
//
//   々 (the iteration mark) is a KANJI thing. It repeats the kanji before it, so
//   it has no meaning until compounds exist and no hiragana-vs-katakana form to
//   split. One card.
//
//   Rendaku (sequential voicing) is a SOUND thing. When two elements join, the
//   second often voices — て+かみ becomes てがみ — and that happens to the reading,
//   not to one script's glyphs. One card.
//
//   Punctuation is a SENTENCE thing. 。、「」 and the no-spaces rule are the same
//   whichever kana spells the words between them. One card.
//
// So these three carry a single, SCRIPT-NEUTRAL intro each: setId is "" because
// the honest answer to "which script's run is this" is "none of them". The only
// reader of setId is the Library's script label (src/components/library/
// mark-view.tsx), which prints nothing for "" rather than a stray "In hiragana".
// Their WHEN is argued at each card and wired below: punctuation rides the end of
// the first script (you can read hiragana sentences now, so here is how a
// sentence is pointed), and 々 and rendaku are word-gated in lesson-steps.ts,
// appearing the moment the first 々 word (時々 at rank 154) is taught, which is
// the first place BOTH rules are provably in play at once (ときどき is 々 AND
// rendaku). See marks.ts for how the Library renders the same copy.

/** A card that belongs to no script, so it renders no "In hiragana" label. */
const NO_SCRIPT = "";

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

/**
 * One worked example of a rule — the same fact the prose states in a sentence,
 * pulled out as a formula the eye can scan: `生 + きる = 生きる (いきる) · to live`.
 *
 * The prose TEACHES the rule; these SHOW it, side by side, so a page about a
 * writing rule reads as an explanation with its evidence beside it rather than
 * as a paragraph the reader has to mine for the words. Real curriculum vocabulary
 * only — the same words the prose names — so the two never disagree.
 */
export interface IntroExample {
  /** The left of the formula — "生 + きる", "時 + 時", or a plain word "生きる". */
  from: string;
  /** The operator between the two sides. "=" for a word built from parts (the
   *  default), "→" for one form becoming another. */
  op?: "=" | "→";
  /** The right of the formula — the finished word or form: "生きる", "生きた". */
  to: string;
  /** The reading of `to`, shown in parentheses. Omitted where it adds nothing
   *  (a form change that keeps the same kanji reading). */
  reading?: string;
  /** The plain-language gloss, printed after a middot — "to live". */
  gloss: string;
  /** The Japanese text to pronounce when the example carries an audible change
   *  (a voicing, a held vowel, a doubled consonant, a fused syllable). Present
   *  turns on a speaker on that line; omitted leaves the line silent (a purely
   *  written distinction with nothing to hear). */
  say?: string;
}

/**
 * One row of the punctuation reference: a mark, its Japanese name, the English
 * mark it stands in for, and what it does. Punctuation is a catalogue rather than
 * a rule with worked examples, so it reads best as a table (see PunctuationTable
 * in phase-intro-view.tsx) instead of the prose-plus-examples every other card
 * uses.
 */
export interface PunctuationRow {
  /** The glyph, or a pair like "「 」". */
  mark: string;
  /** Its Japanese name in romaji, e.g. "kuten". Empty where it has no common one. */
  name: string;
  /** The English mark it does the job of, e.g. "full stop". */
  english: string;
  /** One line on what it does. */
  note: string;
}

/** One row in the transitivity "common pairs" table. */
export interface TransitivityPairRow {
  /** The "it happens on its own" verb, with reading. */
  happens: string;
  /** The "someone does it" verb, with reading. */
  doIt: string;
  /** Tail shown in the "it happened" column. */
  happensTail: string;
  /** Tail shown in the "someone did it" column. */
  doItTail: string;
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
  /**
   * Worked examples for the rule, shown beside the prose on the Library page (see
   * mark-view.tsx) and below it in the teach walk. Optional: the kana marks carry
   * their evidence in conversion tables (dakuten-rows.ts) instead, so only the
   * glyphless writing rules — 々, rendaku, okurigana — use this.
   */
  examples?: readonly IntroExample[];
  /**
   * A punctuation catalogue, rendered as a table. Only PUNCTUATION uses this: its
   * content is a set of marks with names and jobs, not a rule with worked
   * examples, so it reads as a reference table with a closing sentence beneath.
   */
  punctuation?: readonly PunctuationRow[];
  /**
   * A compact table of common verb-pair shapes. Used by the transitivity intro's
   * "Before you go on" card.
   */
  transitivityPairs?: readonly TransitivityPairRow[];
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
      lead: "(dakuten): two dashes.",
      text: "It voices the consonant: your vocal cords buzz. か becomes が, さ becomes ざ, た becomes だ, は becomes ば. Put a finger on your throat and say ka, then ga. The second one hums.",
    },
    {
      mark: "゜",
      lead: "(handakuten): a small circle,",
      text: "and it only ever lands on the は row.",
    },
    {
      text: "You already know every shape here. か and が are the same character with a mark, so this is 25 more sounds without a single new drawing to learn.",
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
      lead: "(dakuten): two dashes.",
      text: "It voices the consonant, meaning your vocal cords buzz: カ ka → ガ ga, サ sa → ザ za, タ ta → ダ da, ハ ha → バ ba.",
    },
    {
      mark: "゜",
      lead: "(handakuten): a small circle,",
      text: "and it only ever lands on the ハ row: ハ ha → パ pa.",
    },
    {
      text: "The marks work exactly as they did in hiragana, on shapes you already know. カ and ガ are the same character with a mark, so this is 25 more sounds without a single new drawing to learn.",
    },
  ],
};

export const COMBO_H: PhaseIntro = {
  id: "intro-combo-hiragana",
  setId: "hiragana",
  title: "A small や, ゆ or よ fuses onto the kana in front of it.",
  body: [
    {
      text: "Only the い-column kana take these: き, し, ち, に, ひ, み, り and their voiced partners. き with a small ゃ is one sound in one beat, kya, not two.",
    },
    {
      lead: "The size is the whole tell.",
      text: "きゃ, with the small ゃ, is “kya”. きや, with a full-size や, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
    },
    {
      text: "No new shapes again. Every combo is two characters you already know, one of them shrunk.",
    },
  ],
  examples: [
    { from: "き + ゃ", to: "きゃ", reading: "kya", gloss: "one beat", say: "きゃ" },
    { from: "し + ゅ", to: "しゅ", reading: "shu", gloss: "one beat", say: "しゅ" },
    { from: "ち + ょ", to: "ちょ", reading: "cho", gloss: "one beat", say: "ちょ" },
  ],
};

export const COMBO_K: PhaseIntro = {
  id: "intro-combo-katakana",
  setId: "katakana",
  title: "A small ャ, ュ or ョ fuses onto the kana in front of it.",
  body: [
    {
      text: "A full-size kana followed by a small ャ, ュ or ョ is one syllable, not two. The two are said together, in a single beat, not as two separate kana.",
    },
    {
      lead: "The size is the whole tell.",
      text: "キャ, with the small ャ, is “kya”. キヤ, with a full-size ヤ, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
    },
    {
      text: "Same rule as the hiragana combos, on shapes you already know. Nothing new to draw.",
    },
  ],
  examples: [
    { from: "キ + ャ", to: "キャ", reading: "kya", gloss: "one beat", say: "キャ" },
    { from: "シ + ュ", to: "シュ", reading: "shu", gloss: "one beat", say: "シュ" },
    { from: "チ + ョ", to: "チョ", reading: "cho", gloss: "one beat", say: "チョ" },
  ],
};

export const LONG_H: PhaseIntro = {
  id: "intro-long-vowel-hiragana",
  setId: "hiragana",
  title: "A held vowel is a different word, not a decoration.",
  body: [
    {
      text: "Hold a vowel a beat longer and you have said a different word, so length is part of the word, not decoration.",
    },
    {
      lead: "In hiragana you hold the sound by adding the matching vowel kana.",
      text: "おばさん becomes おばあさん: the あ after ば doubles that あ sound, so ば is held a beat longer. い lengthens with another い, う with another う.",
    },
    {
      lead: "Two that surprise people.",
      text: "え is usually lengthened with い, not another え. And お is usually lengthened with う, not another お.",
    },
  ],
  examples: [
    { from: "おばさん", to: "obasan", gloss: "aunt", say: "おばさん" },
    { from: "おばあさん", to: "obaasan", gloss: "grandmother", say: "おばあさん" },
    { from: "せんせい", to: "sensee", gloss: "teacher (え held with い)", say: "せんせい" },
    { from: "おとうさん", to: "otōsan", gloss: "father (お held with う)", say: "おとうさん" },
  ],
};

export const LONG_K: PhaseIntro = {
  id: "intro-long-vowel-katakana",
  setId: "katakana",
  title: "Katakana holds a vowel with one long dash.",
  body: [
    {
      text: "The same rule you saw in hiragana, a held vowel is a different word, written a different way. Katakana uses a single dash, ー, whatever the vowel is.",
    },
    {
      lead: "One mark covers all five vowels,",
      text: "so there is no え+い or お+う to remember on this side. ー just means “hold the vowel before it”.",
    },
    {
      text: "It follows the direction of the writing: horizontal in a horizontal line, and turned upright when the text runs down the page.",
    },
  ],
  examples: [
    { from: "コーヒー", to: "kōhī", gloss: "coffee", say: "コーヒー" },
    { from: "ケーキ", to: "kēki", gloss: "cake", say: "ケーキ" },
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
      lead: "(small tsu): a shrunken つ.",
      text: "It is never said on its own. It stops the mouth for one beat and doubles the consonant that comes after it.",
    },
    {
      lead: "The size is the whole tell, again.",
      text: "きって, with the small っ, is “kitte”. きつて, with a full-size つ, would be “kitsute”: three separate sounds. Look at the height, exactly as you do with ゃ.",
    },
    {
      lead: "It is a beat, not a gap.",
      text: "The pause takes as long as any other kana does, which is why きて and きって are two different words rather than one said carelessly.",
    },
  ],
  examples: [
    { from: "きて", op: "→", to: "きって", gloss: "kite → kitte", say: "きって" },
    { from: "さか", op: "→", to: "さっか", gloss: "saka → sakka", say: "さっか" },
  ],
};

export const SOKUON_K: PhaseIntro = {
  id: "intro-sokuon-katakana",
  setId: "katakana",
  title: "A small ッ does the same thing on this side.",
  body: [
    {
      mark: "ッ",
      lead: "(small tsu): a shrunken ツ.",
      text: "The same rule you saw in hiragana, on katakana shapes.",
    },
    {
      lead: "Borrowed words are full of it,",
      text: "because the languages Japanese borrows from are full of consonants that land hard. If a loanword stops short in the middle, expect a ッ there.",
    },
  ],
  examples: [
    { from: "ベッド", to: "beddo", gloss: "bed", say: "ベッド" },
    { from: "カップ", to: "kappu", gloss: "cup", say: "カップ" },
    { from: "サッカー", to: "sakkā", gloss: "soccer", say: "サッカー" },
  ],
};

// PUNCTUATION — the sentence-level card, anchored to the end of hiragana.
// =====================================================================
// It is script-neutral (see NO_SCRIPT) and taught ONCE, not once per script,
// because 。、「」 do not change between them. The WHEN is "as soon as sentences
// become readable": finishing hiragana is the first point a learner can read a
// whole Japanese sentence, and a sentence needs its points. It is wired as the
// FIRST card of the hiragana after-run (see INTRO_AFTER), ahead of long vowels
// and small っ, because those two refine individual WORDS while this is about the
// sentence they sit in — and because putting it last would displace small っ,
// which closes the script on purpose (see the long note above SOKUON_H).
//
// This card describes real usage only. It names the marks a beginner actually
// meets and the one genuinely surprising rule (no spaces between words); it does
// not try to be a full style guide for a system that has one.
export const PUNCTUATION: PhaseIntro = {
  id: "intro-punctuation",
  setId: NO_SCRIPT,
  title: "Japanese points its sentences differently.",
  body: [
    {
      lead: "And the thing that is missing.",
      text: "Japanese leaves no spaces between words. The switches between kanji, hiragana and katakana do the work an English space does, so you learn to see where one word ends by the change in script rather than by a gap.",
    },
  ],
  punctuation: [
    { mark: "。", name: "kuten", english: "full stop", note: "Ends a sentence. A small hollow circle, not a dot." },
    { mark: "、", name: "touten", english: "comma", note: "Separates parts of a sentence." },
    { mark: "「 」", name: "kagi", english: "quotation marks", note: "Wrap speech and quotes." },
    { mark: "『 』", name: "double kagi", english: "quotation marks", note: "A quote inside a quote, and the titles of works." },
    { mark: "・", name: "nakaguro", english: "middle dot", note: "Separates list items or the parts of a foreign name." },
    { mark: "〜", name: "nami", english: "wave dash", note: "Marks a range or a “from, to”: 5〜10." },
    { mark: "？ ！", name: "", english: "question, exclamation", note: "Borrowed from the West and used mostly in casual writing." },
  ],
};

// 々 — THE ITERATION MARK, and the first mark in this file that is not kana.
// ========================================================================
// It repeats the kanji before it. That is the whole rule, and it is a KANJI
// rule: 々 is meaningless next to a kana and only earns its keep once compounds
// exist, which is why it is word-gated (lesson-steps.ts) rather than anchored to
// a kana section, and why it has one card rather than a hiragana and a katakana
// one. The examples are real ichi1/spec vocabulary the app ships (人々, 時々,
// 様々, 少々, 国々), not invented forms.
export const ITERATION_MARK: PhaseIntro = {
  id: "intro-iteration-mark",
  setId: NO_SCRIPT,
  title: "々 repeats the kanji before it.",
  body: [
    {
      lead: "This is called an odoriji, a repeat mark.",
      text: "It stands in for the kanji just before it, so you write the character once and 々 says “again”.",
    },
    {
      lead: "It stands in for the character before it.",
      text: "人々 is 人 written twice, and you read it as though it were written out. The second half usually picks up the same voicing as dakuten, so it is ひとびと, hito-bito, not hito-hito.",
    },
    {
      lead: "It shows up in compounds.",
      text: "Repeating a noun this way often reads as a plural or as “various”. It is a habit of particular words, not the general way Japanese marks number.",
    },
  ],
  examples: [
    { from: "時 + 時", to: "時々", reading: "ときどき", gloss: "sometimes", say: "時々" },
    { from: "人 + 人", to: "人々", reading: "ひとびと", gloss: "people", say: "人々" },
    { from: "様 + 様", to: "様々", reading: "さまざま", gloss: "various", say: "様々" },
    { from: "国 + 国", to: "国々", reading: "くにぐに", gloss: "various countries", say: "国々" },
  ],
};

// RENDAKU — sequential voicing, and the app's second glyphless mark.
// =================================================================
// Long vowels proved a mark can have no glyph; rendaku is the second, and for a
// cleaner reason: it is not a written thing at all. It is what the dakuten
// WRITES, happening on its own at the seam of a compound. That is why it belongs
// beside dakuten on the shelf (marks.ts), and it is word-gated in lesson-steps.ts
// on the first word that actually voices at a seam — 仕事 (し + こと → しごと),
// rank 22 — so it is taught the moment a learner first meets the thing it
// explains, well ahead of 々.
//
// HONEST ABOUT THE IRREGULARITY. Rendaku is a strong TENDENCY, not a law: it has
// well-known brakes (it tends not to fire when the second element already holds a
// voiced sound), and it simply does not apply to plenty of compounds. The copy
// says so, and tells the learner to trust a word's given reading over the rule.
// Naming the brakes precisely would be inventing a completeness this app does not
// have; the tendency plus "learn the reading as given" is the honest amount.
export const RENDAKU: PhaseIntro = {
  id: "intro-rendaku",
  setId: NO_SCRIPT,
  title: "In a compound, the second word's first sound often changes.",
  body: [
    {
      lead: "Rendaku:",
      text: "when two elements form a compound, the first consonant of the second element often picks up a dakuten sound.",
    },
    {
      lead: "The kanji does not change, only the sound.",
      text: "The second half takes the same voicing you know from dakuten. You will see it constantly in compounds from here on.",
    },
    {
      lead: "It is a tendency, not a requirement.",
      text: "It does not always happen so treat it as something to expect and recognize rather than a rule to apply blindly.",
    },
  ],
  examples: [
    { from: "仕 + 事", to: "仕事", reading: "しごと", gloss: "work (こ → ご)", say: "仕事" },
    { from: "手 + 紙", to: "手紙", reading: "てがみ", gloss: "letter (か → が)", say: "手紙" },
    { from: "言 + 葉", to: "言葉", reading: "ことば", gloss: "word (は → ば)", say: "言葉" },
  ],
};

// OKURIGANA — the kana tail written after a kanji, and this file's first rule
// taught over THREE cards instead of one.
// =========================================================================
// Okurigana is not a character and not a single mark; it is the kana that
// finishes a word a kanji only starts (生きる, 高い, 一つ). It is a writing rule,
// so it lives on the Writing rules shelf (src/data/marks.ts) beside the others,
// and — like 々 and rendaku — it has no kana section to anchor to, so it is
// word-gated in lesson-steps.ts rather than tied to a script's run.
//
// THREE CARDS, THREE MOMENTS. The one idea splits cleanly into three, and each
// wants a different point in the word order:
//
//   1. OKURIGANA_INTRO — "the kanji does not finish the word". The whole idea,
//      shown on 生 / 生きる / 生まれる: one character, three words, three sounds.
//      Gated ahead of the FIRST word that carries a kana tail (言う, the third
//      curriculum word), because that is the first place the rule is visible.
//
//   2. OKURIGANA_MOVING — "sometimes the tail moves". The same first tail word
//      is a verb, so this rides in right behind card 1: the tail is the part
//      that changes (生きる → 生きた → 生きない, 高い → 高かった), and HOW it changes
//      is grammar, not this card.
//
//   3. OKURIGANA_FIXED — "sometimes it just sits there". Held back until the
//      first word whose tail does NOT move, so the contrast is real rather than
//      hypothetical. See lesson-steps.ts for which word that is and why.
//
// All three are script-neutral (see NO_SCRIPT): the rule is the same whichever
// kana spells the tail. The examples are real curriculum vocabulary, not
// invented forms. marks.ts renders the same three objects on the Library page.
export const OKURIGANA_INTRO: PhaseIntro = {
  id: "intro-okurigana",
  setId: NO_SCRIPT,
  title: "The kanji does not finish the word.",
  body: [
    {
      lead: "This kana tail is called okurigana.",
      text: "The kana written after a kanji is part of the word, not a separate thing tacked on. One character can start several words, and the tail is what tells them apart.",
    },
    {
      lead: "The tail even settles the reading.",
      text: "生 on its own can be read several ways, and the kana after it decide which. In 生きる the tail is きる and 生 is read い. In 生まれる the tail is まれる and 生 is read う. Same character, different tail, different sound.",
    },
  ],
  examples: [
    { from: "生 + きる", to: "生きる", reading: "いきる", gloss: "to live", say: "生きる" },
    { from: "生 + まれる", to: "生まれる", reading: "うまれる", gloss: "to be born", say: "生まれる" },
  ],
};

export const OKURIGANA_MOVING: PhaseIntro = {
  id: "intro-okurigana-moving",
  setId: NO_SCRIPT,
  title: "Sometimes the tail moves.",
  body: [
    {
      lead: "On a verb or an い-adjective, the tail changes.",
      text: "The okurigana is exactly the part that shifts when the word does a different job. The kanji holds still and the tail carries the change.",
    },
    {
      lead: "How it changes is grammar.",
      text: "For now, just notice that the tail is the moving part. Which form to use, and when, is taught in the grammar track.",
    },
  ],
  examples: [
    { from: "生きる", op: "→", to: "生きた", gloss: "lived", say: "生きた" },
    { from: "生きる", op: "→", to: "生きない", gloss: "does not live", say: "生きない" },
    { from: "高い", op: "→", to: "高かった", gloss: "was expensive", say: "高かった" },
  ],
};

export const OKURIGANA_FIXED: PhaseIntro = {
  id: "intro-okurigana-fixed",
  setId: NO_SCRIPT,
  title: "Sometimes it just sits there.",
  body: [
    {
      lead: "Not every tail moves.",
      text: "Plenty of words carry a kana tail that never changes. 一つ (ひとつ, one) is just 一つ: the つ sits on the end and stays put, however the word is used.",
    },
    {
      lead: "Compare a verb you have already seen.",
      text: "A verb like 行く reshapes its tail as it works, but 一つ does none of that. It is the same kind of kana tail, only a fixed one, so read it as part of the word and leave it be.",
    },
  ],
  examples: [
    { from: "一 + つ", to: "一つ", reading: "ひとつ", gloss: "one (tail sits still)", say: "一つ" },
    { from: "行く", op: "→", to: "行った", gloss: "went (tail moves)", say: "行った" },
  ],
};

// TRANSITIVITY — the pair intro, this file's first card that is not a writing
// rule. It opens the transitivity track: a handful of verbs come in twos, one
// for when something happens on its own and one for when someone makes it
// happen, and the whole skill is noticing which the sentence describes. Like the
// okurigana and rendaku cards it has no kana section to hang on, so it is gated
// on the first transitivity item of a teach set (see lesson-steps.ts) rather
// than tied to a script's run. Script-neutral (NO_SCRIPT): the idea is about
// verbs, not spelling. The copy never uses the words "transitive" or
// "intransitive" — the app does not lead with the grammatical terms (see the
// header of src/data/transitivity.ts) and describes the contrast in plain
// language instead. The examples are early, common curated pairs.
export const TRANSITIVITY_INTRO: PhaseIntro = {
  id: "intro-transitivity",
  setId: NO_SCRIPT,
  title: "Some verbs come in twos: one for when it happens, one for when you do it.",
  body: [
    {
      lead: "Two verbs, one event.",
      text: "Japanese often has two verbs for the same happening: one for when it happens on its own, and one for when someone makes it happen. English reuses one word for both: 'The door opened' and 'I opened the door' are both 'open'. Japanese uses 開く and 開ける.",
    },
    {
      lead: "The sentence already tells you which.",
      text: "In English you can always hear the difference: whether something acts on its own, or someone acts on it.",
    },
    {
      lead: "The endings often shift in familiar ways.",
      text: "Most pairs share a kanji and swap only the kana on the end. The usual shifts are まる→める, る→す, and く→ける. Naming the shift helps you remember a pair, but it never tells you which verb is which, and some pairs follow no rule at all.",
    },
  ],
  examples: [
    { from: "始まる (はじまる)", op: "→", to: "始める (はじめる)", gloss: "まる → める (The class started. → I started the class.)" },
    { from: "直る (なおる)", op: "→", to: "直す (なおす)", gloss: "る → す (It got fixed. → I fixed it.)" },
    { from: "開く (あく)", op: "→", to: "開ける (あける)", gloss: "く → ける (The door opened. → I opened the door.)" },
  ],
  transitivityPairs: [
    {
      happens: "始まる (はじまる)",
      doIt: "始める (はじめる)",
      happensTail: "まる",
      doItTail: "める",
    },
    {
      happens: "直る (なおる)",
      doIt: "直す (なおす)",
      happensTail: "る",
      doItTail: "す",
    },
    {
      happens: "開く (あく)",
      doIt: "開ける (あける)",
      happensTail: "く",
      doItTail: "ける",
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
 *
 * PUNCTUATION rides the front of the hiragana run only. It is script-neutral and
 * belongs once sentences are readable, which is here; it leads the run because it
 * is about the whole sentence while long vowels and small っ refine single words,
 * and it stays out of the katakana run because it is not a per-script rule to be
 * taught twice. Small っ is still the last card of each script.
 */
export const INTRO_AFTER: Record<string, PhaseIntro[]> = {
  "h-pya": [PUNCTUATION, LONG_H, SOKUON_H],
  "k-pya": [LONG_K, SOKUON_K],
};

/** Every intro, for tests and for anything that wants to list them.
 *
 * Every card here is now reachable from a lesson: the sokuon pair was the one
 * exception for as long as the curriculum had nowhere to put it, and closing
 * each script on it is what settled that. The order below is the order a
 * learner meets them, one script then the other, which is also the order the
 * anchor tables produce. The script-neutral cards close the list: PUNCT is
 * reachable from the hiragana after-run, and ITERATION_MARK, RENDAKU and the
 * three okurigana cards from the word-gated seams in lesson-steps.ts, so every
 * card here has a lesson home. */
export const PHASE_INTROS: PhaseIntro[] = [
  DAKUTEN_H,
  COMBO_H,
  LONG_H,
  SOKUON_H,
  DAKUTEN_K,
  COMBO_K,
  LONG_K,
  SOKUON_K,
  PUNCTUATION,
  ITERATION_MARK,
  RENDAKU,
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  OKURIGANA_FIXED,
  TRANSITIVITY_INTRO,
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
