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
      lead: "(dakuten): two dashes.",
      text: "It voices the consonant, meaning your vocal cords buzz: か ka → が ga, さ sa → ざ za, た ta → だ da, は ha → ば ba.",
    },
    {
      mark: "゜",
      lead: "(handakuten): a small circle,",
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
      lead: "(dakuten): two dashes.",
      text: "It voices the consonant, meaning your vocal cords buzz: カ ka → ガ ga, サ sa → ザ za, タ ta → ダ da, ハ ha → バ ba.",
    },
    {
      mark: "゜",
      lead: "(handakuten): a small circle,",
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
      text: "A full-size kana followed by a SMALL や, ゆ or よ is one syllable, not two: き + ゃ is “kya”, said in a single beat, not “ki-ya”.",
    },
    {
      lead: "The size is the whole tell.",
      text: "きゃ, with the small ゃ, is “kya”. きや, with a full-size や, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
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
      text: "A full-size kana followed by a SMALL ャ, ュ or ョ is one syllable, not two: キ + ャ is “kya”, said in a single beat, not “ki-ya”.",
    },
    {
      lead: "The size is the whole tell.",
      text: "キャ, with the small ャ, is “kya”. キヤ, with a full-size ヤ, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height.",
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
      text: "え is usually lengthened with い: せんせい is said “sensee”, not “sen-say”. And お is usually lengthened with う: おとうさん is said “otoosan”, not “oto-u-san”.",
    },
    {
      text: "This is a rule, not a new set of characters. There is nothing here to draw, only something to listen for.",
    },
  ],
};

export const LONG_K: PhaseIntro = {
  id: "intro-long-vowel-katakana",
  setId: "katakana",
  title: "Katakana holds a vowel with one long dash.",
  body: [
    {
      text: "The rule is the one you met in hiragana (a held vowel is a different word), written a different way. Katakana uses a single dash, ー, whatever the vowel is: コーヒー (coffee), ケーキ (cake).",
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
      lead: "(small tsu): a shrunken つ.",
      text: "It is never said on its own. It stops the mouth for one beat and doubles the consonant that comes after it: きて kite → きって kitte, さか saka → さっか sakka.",
    },
    {
      lead: "The size is the whole tell, again.",
      text: "きって, with the small っ, is “kitte”. きつて, with a full-size つ, would be “kitsute”: three separate sounds. Look at the height, exactly as you do with ゃ.",
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
      lead: "(small tsu): a shrunken ツ.",
      text: "The rule you met in hiragana, on katakana shapes: ベッド beddo (bed), カップ kappu (cup), サッカー sakkā (soccer).",
    },
    {
      lead: "Borrowed words are full of it,",
      text: "because the languages Japanese borrows from are full of consonants that land hard. If a loanword stops short in the middle, expect a ッ there.",
    },
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
      lead: "。 (kuten) is the full stop,",
      text: "a small hollow circle rather than a dot, and 、(touten) is the comma. They do the jobs the English period and comma do, they just look different: これはペンです。",
    },
    {
      lead: "Quotation marks are corner brackets.",
      text: "「 」(kagi) wrap speech and quotes the way English quotation marks do: 「おはよう」と言った. The double form 『 』wraps a quote inside a quote, and the titles of books and works.",
    },
    {
      lead: "A few more you will see.",
      text: "・(nakaguro) is a middle dot that separates list items or the parts of a foreign name: アメリカ・カナダ. 〜 (the wave dash) marks a range or a “from, to”: 5〜10. ？ and ！ are borrowed from the West and used mostly in casual writing; formal text often does without them.",
    },
    {
      lead: "And the thing that is missing.",
      text: "Japanese leaves NO spaces between words. The switches between kanji, hiragana and katakana do the work an English space does, so you learn to see where one word ends by the change in script rather than by a gap.",
    },
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
      mark: "々",
      lead: "(odoriji): a repeat mark.",
      text: "It stands in for the kanji just before it, so you write the character once and 々 says “again”. 人 (ひと, person) becomes 人々 (ひとびと, people); 時 (とき, time) becomes 時々 (ときどき, sometimes).",
    },
    {
      lead: "It repeats the CHARACTER, not the reading.",
      text: "々 copies the kanji, and the copy is then read like the second half of any compound, which often means its sound voices. That is why 人々 is “hito-bito”, not “hito-hito”: see rendaku, the rule doing that.",
    },
    {
      lead: "You meet it only once compounds do.",
      text: "That is why it waits here and does not sit with the kana marks. It is common once you are reading: 様々 (さまざま, various), 少々 (しょうしょう, a little), 国々 (くにぐに, various countries).",
    },
  ],
};

// RENDAKU — sequential voicing, and the app's second glyphless mark.
// =================================================================
// Long vowels proved a mark can have no glyph; rendaku is the second, and for a
// cleaner reason: it is not a written thing at all. It is what the dakuten
// WRITES, happening on its own at the seam of a compound. That is why it belongs
// beside dakuten on the shelf (marks.ts) and why it is taught alongside 々: the
// first 々 word a learner meets, 時々, voices (とき → どき), so the two rules are
// visible in one word.
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
  title: "Join two words and the second often voices.",
  body: [
    {
      lead: "Rendaku (sequential voicing):",
      text: "when two elements form a compound, the first consonant of the SECOND element often picks up a dakuten sound. て (hand) + かみ (paper) becomes てがみ (letter), か → が. It is the voicing the dakuten writes, happening on its own at the join.",
    },
    {
      lead: "You just saw it in 々.",
      text: "時 とき + 時 とき is ときどき, the second half's と voicing to ど; 人 ひと + 人 ひと is ひとびと, ひ voicing to び. The repeated half voices exactly like any second element does.",
    },
    {
      lead: "It is a tendency, not a law.",
      text: "It does not always happen, and there are known brakes on it, so treat it as something to expect and recognise rather than a rule to apply blindly. When a word's reading is given to you, trust the reading.",
    },
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
      lead: "A word can be a kanji plus a kana tail.",
      text: "The kana written after a kanji is part of the word, not a separate thing tacked on. The single character 生 becomes 生きる (いきる, to live) and 生まれる (うまれる, to be born): one kanji, two words, and the kana tail is what tells them apart.",
    },
    {
      lead: "The tail even settles the reading.",
      text: "生 on its own can be read several ways, and the kana after it decides which. 生きる takes い, 生まれる takes う: same character, different tail, different sound. That trailing kana has a name, okurigana.",
    },
  ],
};

export const OKURIGANA_MOVING: PhaseIntro = {
  id: "intro-okurigana-moving",
  setId: NO_SCRIPT,
  title: "Sometimes the tail moves.",
  body: [
    {
      lead: "On a verb or an い-adjective, the tail changes.",
      text: "The okurigana is exactly the part that shifts when the word does a different job. 生きる (いきる) becomes 生きた (lived) and 生きない (does not live); 高い (たかい, expensive) becomes 高かった (was expensive). The kanji holds still and the tail carries the change.",
    },
    {
      lead: "How it changes is grammar.",
      text: "For now, just notice that the tail is the moving part. Which form to use, and when, is taught on the grammar side, not here.",
    },
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
      lead: "Compare a verb you have already met.",
      text: "行く (いく, to go) reshapes its tail as it works: 行った (went), 行かない (does not go). 一つ does none of that. It is the same kind of kana tail, but a fixed one, so read it as part of the word and leave it be.",
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
