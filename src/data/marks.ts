// MARKS — the things that are not characters but rules about how characters are
// read.
//
// THE HOLE THIS FILLS
// ===================
// The Library has kana, kanji, words and grammar, and every one of those shelves
// holds THINGS YOU CAN DRAW. ゛ is not one. Neither is "hold the vowel a beat
// longer", which is a rule with no glyph at all. Before this file the only place
// in the app that said what a dakuten does was a step of the teach walk — read
// once, mid-lesson, and then gone, with nowhere to go back to. A learner who met
// きって in the wild and wanted to know what the small っ was doing had no page to
// open.
//
// So a mark is a Library entry whose subject is a READING RULE. Nine of them:
// the five things the kana curriculum teaches that are not kana, plus four that
// belong to reading BEYOND kana - the iteration mark 々 (a kanji rule), rendaku
// (the voicing that happens on its own in compounds), punctuation (how a
// sentence is pointed), and okurigana (the kana tail a kanji word ends in). The
// first five are kana-adjacent; the last four are met once you are reading
// kanji, compounds and whole sentences, and each says so.
//
// NOT A SECOND COPY OF THE LESSON
// ===============================
// This file authors almost NOTHING. Every explanation here is a pointer into
// src/data/phase-intros.ts (the teaching copy) and src/data/dakuten-rows.ts (the
// conversions), which are what the teach walk already renders. That is the whole
// design constraint: a learner who meets ゛ in a lesson and then looks it up must
// read THE SAME WORDS, because two descriptions of one rule drift apart and
// nobody notices until they contradict each other. The Library mark page renders
// the lesson's own components (PhaseIntroView's body, ConversionCard) over the
// lesson's own data.
//
// What this file DOES author is the small amount that is genuinely new: what
// each mark is CALLED on a shelf, a one-line summary for the row underneath it,
// the alias strings search should find it by, and — for small kana — one aside
// about ぁぃぅぇぉ that has no lesson home (see SMALL_VOWEL_NOTE).
//
// NOT DRILLABLE, AND NOT BY OMISSION
// ==================================
// A mark publishes NO FactInfo and is not in src/lib/facts.ts's SUBJECTS list.
// That is not an oversight to be filled in later — "what is a dakuten" is not a
// question with a gradeable answer, and the app's whole model is that a fact is
// something it can ask and mark. Because facts.ts never hears about marks,
// `factsOf(markEntry(…))` is empty, `sliceIsDrillable` is false, the slice bar
// hides its Drill button, and Progress's by-subject table (built from ALL_FACTS)
// has no Marks row to be 0-of-5 in. Every one of those falls out of the absence
// rather than being special-cased, which is the reason to do it by absence.
//
// Small っ and long vowels ARE drillable — inside WORDS, where きて vs きって is a
// real question with a real answer. That is a words-track question and belongs to
// the words track; see the note at the bottom of src/data/phase-intros.ts, which
// has been saying so since long vowels were first taught.

import { DAKUTEN_ROWS, type DakutenRow } from "@/data/dakuten-rows";
import {
  COMBO_H,
  COMBO_K,
  DAKUTEN_H,
  DAKUTEN_K,
  ITERATION_MARK,
  LONG_H,
  LONG_K,
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  PUNCTUATION,
  RENDAKU,
  SOKUON_H,
  SOKUON_K,
  type IntroPara,
  type PhaseIntro,
} from "@/data/phase-intros";
import {
  SENTENCE_ORDERING_GUIDES,
  sentenceOrderingIntro,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";
import { entryId } from "@/lib/fact-id";
import type { EntryId } from "@/types";

/** The subject id, in the same shape as KANA_SUBJECT / KANJI_SUBJECT. The URL
 * kind value is `writing-rule`: the shelf is called "Writing rules" on screen,
 * because "Marks" only ever described the dakuten/handakuten and the real
 * category is the writing rules that are not standalone characters. The constant
 * keeps its MARK_ name because the DATA layer here is still a set of `Mark`
 * objects — exactly the split VOCAB_SUBJECT = "word" already makes, where the
 * constant names the module and the string names the URL. */
export const MARK_SUBJECT = "writing-rule";

/** Mint a mark's entry id. Like every other minter, this is the ONLY place a
 * mark id is constructed; everything downstream resolves it by lookup. */
export function markEntry(id: string): EntryId {
  return entryId(MARK_SUBJECT, id);
}

/**
 * One reading rule.
 *
 * `glyph` IS ALLOWED TO BE EMPTY, and three marks need it to be. A long vowel is
 * written ー in katakana and by doubling a vowel kana in hiragana, which is two
 * looks for one idea and no single character. Rendaku has no written form at all
 * (it is the sound the dakuten writes, happening on its own). Punctuation is a
 * whole SET of glyphs (。、「」・〜), not one. The honest answer for all three is
 * the empty string, and every renderer downstream copes with it (see `entryName`
 * in src/lib/library/entries.ts). Putting a stand-in ー, or a lone 。, here would
 * have told a beginner a rule the glyph does not actually stand for.
 */
export interface Mark {
  /** Stable id — the URL, the React key, and what a test names. */
  readonly id: string;
  /** What it is CALLED. This is the entry's title, because its glyph can't be. */
  readonly name: string;
  /** The written token, or "" when the rule has no character. See above. */
  readonly glyph: string;
  /** One line, the whole rule. The row's note and the entry page's sub-line. */
  readonly summary: string;
  /**
   * What someone might TYPE to find this, beyond the name and the glyph.
   *
   * Two populations, deliberately mixed: the English names a learner meets
   * elsewhere ("sokuon", "yoon", "chōonpu" — jargon this app never prints but
   * every other resource does, so search has to answer to it), and the Japanese
   * tokens the entry is about but whose glyph field cannot hold them all (ゃ ゅ
   * ょ are one entry; ー belongs to an entry with no glyph). Search matches an
   * alias exactly, so typing ー finds long vowels even though no glyph does.
   */
  readonly searchAlso: readonly string[];
  /**
   * The teaching copy, per script, IN THE LESSON'S OWN WORDS.
   *
   * A PhaseIntro from src/data/phase-intros.ts, unmodified — the Library renders
   * its paragraphs with the same component the teach walk does. Usually TWO
   * entries, hiragana then katakana, because most of these rules are taught once
   * per script and the two are not always the same rule wearing different glyphs.
   * The three single-card script-neutral marks (々, rendaku, punctuation) carry
   * ONE intro: their rule is the same whichever script spells the words around
   * it, so a second per-script copy would be the same card twice. Okurigana is
   * script-neutral too but carries THREE cards, because the one rule is taught
   * in three moments (see the okurigana cards in phase-intros.ts); the Library
   * shows all three, the lessons gate them one at a time. See NO_SCRIPT.
   */
  readonly intros: readonly PhaseIntro[];
  /**
   * The conversions this mark performs, from src/data/dakuten-rows.ts.
   *
   * Only ゛ and ゜ have any: they are the two marks whose effect is a TABLE (five
   * kana in, five kana out, eight times over across the two scripts), and that
   * table is already built, already rendered by ConversionCard, and already the
   * thing the lesson shows. Empty for the other three, whose rules are prose.
   */
  readonly rows: readonly DakutenRow[];
  /** An aside that belongs to this mark and has no lesson home. Rendered in the
   * shared Callout, so it reads as an aside rather than as more of the rule. */
  readonly note?: string;
  /** Group under the Writing rules shelf. */
  readonly shelf: "writing" | "sentence";
}

/**
 * The paragraphs of an intro that are about ONE mark.
 *
 * The dakuten intro is a single card teaching BOTH ゛ and ゜, which is right in a
 * lesson — you meet them together and the second only makes sense against the
 * first. In the Library they are two entries with two pages, and a page for ゜
 * that opened by explaining ゛ would be answering a question you did not ask.
 *
 * The split is driven by the DATA'S OWN TAG, not by paragraph index: IntroPara
 * carries a `mark` field precisely because those paragraphs are ABOUT a mark, so
 * "the paragraphs about ゛" is a property the copy already states. An untagged
 * paragraph belongs to neither mark specifically and goes to both — in the
 * dakuten intro that is the closing "you already know every shape here", which
 * is true of ゜ as much as of ゛.
 *
 * Every other intro has no tagged paragraphs at all, so this is the identity for
 * combos, small っ and long vowels. That is the point: one rule, applied
 * uniformly, rather than a special case for the one card that needed splitting.
 */
export function bodyFor(intro: PhaseIntro, mark: string): IntroPara[] {
  return intro.body.filter((p) => p.mark === undefined || p.mark === mark);
}

const DAKUTEN = "゛";
const HANDAKUTEN = "゜";

/** ぁぃぅぇぉ, the sixth candidate, as a line rather than a page.
 *
 * IT DID NOT EARN ONE. The other five are each a rule with its own mechanism and
 * its own failure mode, and each is taught somewhere in this app. Small vowels
 * are the SAME mechanism as small ゃゅょ — a shrunken kana fusing onto the one in
 * front of it — pointed at a different job, and the app teaches none of ファ, ティ
 * or ウェ: they are not in the curriculum, not in CHAR_INDEX and not in any
 * lesson. A page for them would have been five entries of material the app
 * actually teaches plus one of invention, and it would have split "small kana
 * fuse" across two pages that mostly agree.
 *
 * So it lives here, on the page about the mechanism it shares, as one call-out
 * that says the thing worth knowing: you will meet these, they are loanwords,
 * recognise them rather than learn them as a set. If the app ever teaches the
 * katakana extension row, this is the sentence that becomes a page.
 */
const SMALL_VOWEL_NOTE =
  "ぁぃぅぇぉ (and ァィゥェォ) shrink the same way, but they fuse a VOWEL onto the kana in front of them, to write sounds Japanese does not natively have: ファ fa, ティ ti, ウェ we. You will see them almost only in katakana loanwords, so they are worth recognizing when they turn up rather than learning as a set.";

/**
 * The nine marks, in the order the curriculum meets them.
 *
 * Which is also the order they build on each other: the two marks that change a
 * consonant, then the two small kana that change a syllable's shape, then the
 * one kana rule that is about time rather than about a character at all - and
 * then the four that belong to reading BEYOND kana: the iteration mark 々, the
 * voicing rendaku does at a compound's seam, how a sentence is pointed, and the
 * okurigana tail a kanji word ends in.
 */
const RAW_MARKS: readonly Mark[] = [
  {
    id: "dakuten",
    name: "Dakuten",
    glyph: DAKUTEN,
    summary: "Two dashes that voice the consonant: k→g, s→z, t→d, h→b.",
    searchAlso: [DAKUTEN, "dakuten", "voiced sounds", "voicing mark", "ten ten"],
    intros: [DAKUTEN_H, DAKUTEN_K],
    rows: DAKUTEN_ROWS.filter((r) => r.mark === DAKUTEN),
    shelf: "writing",
  },
  {
    id: "handakuten",
    name: "Handakuten",
    glyph: HANDAKUTEN,
    summary: "A small circle that turns h into p, and lands on no other row.",
    searchAlso: [HANDAKUTEN, "handakuten", "maru", "small circle", "p sounds"],
    intros: [DAKUTEN_H, DAKUTEN_K],
    rows: DAKUTEN_ROWS.filter((r) => r.mark === HANDAKUTEN),
    shelf: "writing",
  },
  {
    id: "small-tsu",
    name: "Small っ",
    glyph: "っ",
    summary:
      "This is not a sound of its own. It doubles the consonant that follows. きて / きって.",
    searchAlso: [
      "っ",
      "ッ",
      "sokuon",
      "small tsu",
      "little tsu",
      "double consonant",
      "geminate",
    ],
    intros: [SOKUON_H, SOKUON_K],
    rows: [],
    shelf: "writing",
  },
  {
    id: "small-ya",
    name: "Small ゃ ゅ ょ",
    glyph: "ゃゅょ",
    summary: "Fuse onto the i-row kana in front of them to make ONE syllable.",
    searchAlso: [
      "ゃ",
      "ゅ",
      "ょ",
      "ャ",
      "ュ",
      "ョ",
      "yoon",
      "yōon",
      "contracted sounds",
      "small ya",
    ],
    intros: [COMBO_H, COMBO_K],
    rows: [],
    note: SMALL_VOWEL_NOTE,
    shelf: "writing",
  },
  {
    id: "long-vowel",
    // No glyph, and the name is doing the glyph's job — this is the entry that
    // proved the Library's model assumed every entry is a character.
    name: "Long vowels",
    glyph: "",
    summary:
      "Hold a vowel a beat longer and it is a different word: ー in katakana, a doubled vowel in hiragana.",
    searchAlso: [
      "ー",
      "chouonpu",
      "chōonpu",
      "choonpu",
      "long vowel",
      "vowel length",
      "long dash",
      "doubled vowel",
    ],
    intros: [LONG_H, LONG_K],
    rows: [],
    shelf: "writing",
  },
  {
    id: "iteration-mark",
    name: "Iteration mark",
    glyph: "々",
    summary: "Repeats the kanji before it. 時 → 時々.",
    searchAlso: [
      "々",
      "iteration mark",
      "odoriji",
      "repeat mark",
      "kanji repetition",
    ],
    intros: [ITERATION_MARK],
    rows: [],
    shelf: "writing",
  },
  {
    id: "rendaku",
    // No glyph - like long vowels, but for a cleaner reason: rendaku is not a
    // written thing at all, it is the voicing the dakuten writes happening on
    // its own at the seam of a compound.
    name: "Rendaku",
    glyph: "",
    summary:
      "Join two words and the second word's first sound often changes: て + かみ → てがみ.",
    searchAlso: [
      "rendaku",
      "sequential voicing",
      "voicing",
      "compound voicing",
    ],
    intros: [RENDAKU],
    rows: [],
    shelf: "writing",
  },
  {
    id: "punctuation",
    // No glyph — punctuation is a whole SET of marks (。、「」・〜), not one, so
    // a lone 。 here would name a rule the glyph does not stand for.
    name: "Punctuation",
    glyph: "",
    summary: "How a Japanese sentence is punctuated: 。 、 「 」 ・ 〜, and no spaces.",
    searchAlso: [
      "。",
      "、",
      "「",
      "」",
      "・",
      "〜",
      "punctuation",
      "kuten",
      "touten",
      "full stop",
      "comma",
      "quotation marks",
    ],
    intros: [PUNCTUATION],
    rows: [],
    shelf: "writing",
  },
  {
    id: "okurigana",
    // No glyph — okurigana is not a character but the kana TAIL a kanji word
    // ends in (生きる, 高い, 一つ), which is a different tail on every word, so
    // no single token can stand for it.
    name: "Okurigana",
    glyph: "",
    summary:
      "The kana tail written after a kanji, part of the word: 生きる, 高い, 一つ.",
    searchAlso: [
      "okurigana",
      "kana tail",
      "kanji tail",
      "trailing kana",
      "inflectional ending",
      "verb ending",
    ],
    // Script-neutral like 々, rendaku and punctuation, but taught over THREE
    // moments rather than one — the whole idea, the tail that moves, and the
    // tail that sits still — so it carries all three cards. See the okurigana
    // note in phase-intros.ts and the word-gating in lesson-steps.ts.
    intros: [OKURIGANA_INTRO, OKURIGANA_MOVING],
    rows: [],
    shelf: "writing",
  },
  {
    id: "sentence-rule-simple",
    name: "Simple sentences",
    glyph: "",
    summary: "Base sentence ordering: anchor the ending, then place core meaning and context around it.",
    searchAlso: ["simple sentences", "sentence ordering", "sov", "basic order", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-simple",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Simple sentences",
        body: [
          {
            lead: "Step 1: Anchor the ending.",
            text: "Find the final verb or statement-ending chunk first. It stabilizes the rest of the sentence.",
          },
          {
            lead: "Step 2: Place core meaning.",
            text: "Put the core object/place chunk before the ending, then frame with topic/time chunks on the left.",
          },
          {
            lead: "Step 3: Use particles as labels.",
            text: "Read は, が, を, に, で as role labels so chunk placement follows structure instead of English word order.",
          },
        ],
        examples: [
          {
            from: "サクは店に",
            to: "サクは店に行った",
            reading: "さくは みせに いった",
            gloss: "As for Saku, she went to the store.",
            say: "サクは店に行った",
          },
          {
            from: "サクは赤いボールで",
            to: "サクは赤いボールで遊んだ",
            reading: "さくは あかい ぼーるで あそんだ",
            gloss: "As for Saku, she played with the red ball.",
            say: "サクは赤いボールで遊んだ",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-conditional",
    name: "Conditional sentences",
    glyph: "",
    summary: "Use IF-boundary markers to keep condition and result chunks in the right order.",
    searchAlso: ["conditional sentences", "if clause", "たら", "ば", "なら", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-conditional",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Conditional sentences",
        body: [
          {
            lead: "Step 1: Find the IF boundary.",
            text: "Markers like たら, ば, and なら close the condition chunk. Keep that chunk intact.",
          },
          {
            lead: "Step 2: Then place the result chunk.",
            text: "After condition placement, build the main result clause and keep its ending anchored near the right edge.",
          },
          {
            lead: "Step 3: Context still frames left.",
            text: "Topic, time, and place chunks remain on the left side around the conditional structure.",
          },
        ],
        examples: [
          {
            from: "雨が降ったら",
            to: "雨が降ったら私は家にいる",
            reading: "あめが ふったら わたしは いえに いる",
            gloss: "If it rains, I stay home.",
            say: "雨が降ったら私は家にいる",
          },
          {
            from: "時間があれば",
            to: "時間があれば私は行く",
            reading: "じかんが あれば わたしは いく",
            gloss: "If I have time, I will go.",
            say: "時間があれば私は行く",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-causal",
    name: "Because / so",
    glyph: "",
    summary: "Cause/result ordering: place reason chunks and outcome chunks in a clear flow.",
    searchAlso: ["because / so", "because", "cause", "から", "ので", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-causal",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Because / so",
        body: [
          {
            lead: "Step 1: Identify cause markers.",
            text: "Use から and ので to locate reason chunks.",
          },
          {
            lead: "Step 2: Order cause and result clearly.",
            text: "Build reason and outcome as separate chunks so logical flow stays readable.",
          },
          {
            lead: "Step 3: Keep the ending anchor.",
            text: "Even with reason markers, the final predicate still closes the clause near the end.",
          },
        ],
        examples: [
          {
            from: "雨だから",
            to: "雨だから私は走らない",
            reading: "あめだから わたしは はしらない",
            gloss: "Because it is raining, I do not run.",
            say: "雨だから私は走らない",
          },
          {
            from: "疲れたので",
            to: "疲れたのでサクは早く寝る",
            reading: "つかれたので さくは はやく ねる",
            gloss: "Because she is tired, Saku goes to bed early.",
            say: "疲れたのでサクは早く寝る",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-obligation",
    name: "Must / have to",
    glyph: "",
    summary: "Obligation frames attach near the end and govern the action chunk before them.",
    searchAlso: ["must / have to", "must", "have to", "なければ", "ないといけない", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-obligation",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Must / have to",
        body: [
          {
            lead: "Step 1: Spot obligation frames.",
            text: "Patterns like なければならない, なければいけない, and ないといけない mark mandatory structure.",
          },
          {
            lead: "Step 2: Attach them to the action chunk.",
            text: "Place the action chunk first, then close with the obligation expression.",
          },
          {
            lead: "Step 3: Keep topic/time outside the frame.",
            text: "Context chunks stay left; do not split the obligation expression apart.",
          },
        ],
        examples: [
          {
            from: "明日私は早く起き",
            to: "明日私は早く起きなければならない",
            reading: "あした わたしは はやく おきなければ ならない",
            gloss: "Tomorrow I must wake up early.",
            say: "明日私は早く起きなければならない",
          },
          {
            from: "サクは宿題を終え",
            to: "サクは宿題を終えなければいけない",
            reading: "さくは しゅくだいを おえなければ いけない",
            gloss: "Saku has to finish her homework.",
            say: "サクは宿題を終えなければいけない",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-sequential",
    name: "After / while doing",
    glyph: "",
    summary: "Sequence markers connect action chunks and define event order.",
    searchAlso: ["after / while doing", "sequence", "てから", "ている", "てみる", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-sequential",
        setId: "",
        eyebrow: "Sentence rule",
        title: "After / while doing",
        body: [
          {
            lead: "Step 1: Find sequence connectors.",
            text: "Markers like てから and ている show how actions chain or continue.",
          },
          {
            lead: "Step 2: Preserve event order.",
            text: "Keep linked actions in the intended sequence before closing with the final predicate.",
          },
          {
            lead: "Step 3: Do not split linked chunks.",
            text: "Treat connector-bearing chunks as structural units while placing context around them.",
          },
        ],
        examples: [
          {
            from: "宿題をしてから",
            to: "宿題をしてから私は寝る",
            reading: "しゅくだいを してから わたしは ねる",
            gloss: "After doing homework, I sleep.",
            say: "宿題をしてから私は寝る",
          },
          {
            from: "図書館でサクは",
            to: "図書館でサクは勉強している",
            reading: "としょかんで さくは べんきょうしている",
            gloss: "At the library, Saku is studying.",
            say: "図書館でサクは勉強している",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-desire",
    name: "Want to / easy / hard",
    glyph: "",
    summary: "Desire/ease endings stay attached to action chunks they evaluate.",
    searchAlso: ["want to / easy / hard", "たい", "やすい", "にくい", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-desire",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Want to / easy / hard",
        body: [
          {
            lead: "Step 1: Locate evaluation endings.",
            text: "Markers like たい, やすい, and にくい show desire or ease/difficulty tied to an action.",
          },
          {
            lead: "Step 2: Keep action and evaluation together.",
            text: "Place the action chunk so its attached ending remains structurally connected.",
          },
          {
            lead: "Step 3: Frame with topic/context as usual.",
            text: "Context chunks stay left while the evaluated action closes near the end.",
          },
        ],
        examples: [
          {
            from: "私は日本へ",
            to: "私は日本へ行きたい",
            reading: "わたしは にほんへ いきたい",
            gloss: "I want to go to Japan.",
            say: "私は日本へ行きたい",
          },
          {
            from: "この本は",
            to: "この本は読みやすい",
            reading: "この ほんは よみやすい",
            gloss: "This book is easy to read.",
            say: "この本は読みやすい",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-giving",
    name: "Giving and receiving",
    glyph: "",
    summary: "Helper endings encode benefit direction between giver and receiver.",
    searchAlso: ["giving and receiving", "てあげる", "てくれる", "てもらう", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-giving",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Giving and receiving",
        body: [
          {
            lead: "Step 1: Identify helper endings.",
            text: "Use てあげる, てくれる, and てもらう to determine direction of benefit.",
          },
          {
            lead: "Step 2: Place giver/receiver context clearly.",
            text: "Keep who-does-what-for-whom readable around the final helper chunk.",
          },
          {
            lead: "Step 3: Respect perspective.",
            text: "These forms encode viewpoint, so chunk order should preserve beneficiary direction.",
          },
        ],
        examples: [
          {
            from: "私は友達に本を貸して",
            to: "私は友達に本を貸してあげる",
            reading: "わたしは ともだちに ほんを かして あげる",
            gloss: "I lend a book to my friend.",
            say: "私は友達に本を貸してあげる",
          },
          {
            from: "サクは私に夕飯を作って",
            to: "サクは私に夕飯を作ってくれた",
            reading: "さくは わたしに ゆうはんを つくって くれた",
            gloss: "Saku made dinner for me.",
            say: "サクは私に夕飯を作ってくれた",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-reported",
    name: "I think / seems like",
    glyph: "",
    summary: "Stance endings wrap a core statement with opinion or probability.",
    searchAlso: ["i think / seems like", "と思う", "らしい", "かもしれない", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-reported",
        setId: "",
        eyebrow: "Sentence rule",
        title: "I think / seems like",
        body: [
          {
            lead: "Step 1: Separate proposition and stance.",
            text: "Build the core statement chunk first, then attach the opinion/probability layer.",
          },
          {
            lead: "Step 2: Read inside then outside.",
            text: "The inner clause carries content; the ending carries confidence or viewpoint.",
          },
          {
            lead: "Step 3: Keep stance marker position stable.",
            text: "Markers like と思う and かもしれない belong near the sentence end where stance is expressed.",
          },
        ],
        examples: [
          {
            from: "彼が来る",
            to: "彼が来ると思う",
            reading: "かれが くる と おもう",
            gloss: "I think he will come.",
            say: "彼が来ると思う",
          },
          {
            from: "明日は雨",
            to: "明日は雨かもしれない",
            reading: "あしたは あめ かもしれない",
            gloss: "It might rain tomorrow.",
            say: "明日は雨かもしれない",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-contrast",
    name: "Even though / without",
    glyph: "",
    summary: "のに marks contrast; ないで links an action done without another action.",
    searchAlso: ["even though / without", "contrast", "のに", "ないで", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-contrast",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Even though / without",
        body: [
          {
            lead: "Step 1: Identify the clause relationship.",
            text: "のに sets up an expectation and contrasting result; ないで links an action done without another action.",
          },
          {
            lead: "Step 2: Keep the first clause intact.",
            text: "Treat the clause ending in のに or ないで as one unit before placing the main result.",
          },
          {
            lead: "Step 3: Read the marker’s actual job.",
            text: "のに means “even though”; ないで means “without doing.” Both connect a setup to the following action, but only のに expresses contrast.",
          },
        ],
        examples: [
          {
            from: "雨なのに",
            to: "雨なのに彼は出かけた",
            reading: "あめなのに かれは でかけた",
            gloss: "Even though it was raining, he went out.",
            say: "雨なのに彼は出かけた",
          },
          {
            from: "朝ごはんを食べないで",
            to: "朝ごはんを食べないで私は出た",
            reading: "あさごはんを たべないで わたしは でた",
            gloss: "Without eating breakfast, I left.",
            say: "朝ごはんを食べないで私は出た",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
  {
    id: "sentence-rule-request",
    name: "Requests and proposals",
    glyph: "",
    summary: "Request/proposal endings close the sentence after the target action chunk.",
    searchAlso: ["requests and proposals", "てください", "ましょう", "request", "sentence rule"],
    intros: [
      {
        id: "sentence-rule-request",
        setId: "",
        eyebrow: "Sentence rule",
        title: "Requests and proposals",
        body: [
          {
            lead: "Step 1: Find request/proposal endings.",
            text: "Markers such as てください and ましょう carry instruction/proposal force.",
          },
          {
            lead: "Step 2: Place target action first.",
            text: "Build the object/action chunk before the final request/proposal expression.",
          },
          {
            lead: "Step 3: Keep social function at the end.",
            text: "The sentence-ending request frame is what makes the utterance polite, directive, or invitational.",
          },
        ],
        examples: [
          {
            from: "この文を読んで",
            to: "この文を読んでください",
            reading: "この ぶんを よんで ください",
            gloss: "Please read this sentence.",
            say: "この文を読んでください",
          },
          {
            from: "今始め",
            to: "今始めましょう",
            reading: "いま はじめましょう",
            gloss: "Let us start now.",
            say: "今始めましょう",
          },
        ],
      },
    ],
    rows: [],
    shelf: "sentence",
  },
];

export const MARKS: readonly Mark[] = RAW_MARKS.map((mark) => {
  if (mark.shelf !== "sentence") return mark;
  const tierId = mark.id.replace("sentence-rule-", "") as SentenceOrderingTierId;
  const guide = SENTENCE_ORDERING_GUIDES[tierId];
  return {
    ...mark,
    name: tierId === "sequential" ? "Te-form links and helpers" : mark.name,
    summary: guide.title,
    intros: [sentenceOrderingIntro(tierId)],
  };
});

/** The mark an entry id names, or undefined. A lookup, like every other id
 * resolution in the app — this never takes an id apart. */
export function markFor(entry: EntryId): Mark | undefined {
  return BY_ENTRY.get(entry);
}

const BY_ENTRY: ReadonlyMap<EntryId, Mark> = new Map(
  MARKS.map((m) => [markEntry(m.id), m]),
);

/**
 * "hiragana" → "In hiragana". A mark's intro already carries which script it
 * belongs to; this only puts a word on it. A SCRIPT-NEUTRAL card (setId "", the
 * NO_SCRIPT the four reading-rule marks carry) belongs to no script and gets NO
 * label — returns `null`, NOT the empty string, so the view draws no pill at all
 * rather than a stray empty one. Anything else is a set id we do not ship,
 * returned as-is rather than mapped to a guess.
 *
 * Extracted from mark-view.tsx so the mapping is a testable pure function; the
 * view renders `<Lbl>` only when this is truthy.
 */
export function scriptLabel(setId: string): string | null {
  if (setId === "hiragana") return "In hiragana";
  if (setId === "katakana") return "In katakana";
  if (setId === "") return null;
  return setId;
}
