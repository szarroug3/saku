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
  /** An optional section heading immediately above this paragraph. This lets one
   * teaching card explain two uses of the same form without flattening them into
   * one uninterrupted run of prose. */
  heading?: string;
  mark?: string;
  lead?: string;
  text: string;
  /** A substring of `text` to render in the accent colour, in place, so a phrase
   * inside the sentence can be picked out (the adjective しずかな in しずかなへや,
   * so the eye sees which part is the adjective and which is the noun). First
   * occurrence only; ignored if it is not found in `text`. */
  accent?: string;
  /** Worked examples anchored directly below this paragraph. */
  examples?: readonly IntroExample[];
  /** Show this paragraph only while it is a step of the teach walk, not when the
   * same card is rendered as a Library term page. It is for text about WHEN the
   * material turns up in the lesson ("each piece turns up just before…"), which is
   * true in the walk but reads as leftover lesson framing to a reader who opened
   * the reference page directly. The library term renderer (TermView) drops these;
   * PhaseIntroView keeps them. */
  lessonOnly?: boolean;
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
  /** A piece of `from` to highlight when the equation is teaching that exact
   * addition, such as the な inserted before a noun. */
  accentFrom?: string;
  /** The operator between the two sides. "=" for a word built from parts (the
   *  default), "→" for one form becoming another. */
  op?: "=" | "→";
  /** The right of the formula — the finished word or form: "生きる", "生きた". */
  to: string;
  /** A piece of `to` to highlight in the completed result. */
  accentTo?: string;
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
  /** The `from` side's pronunciation, for a form-change example (生きる → 生きた)
   *  where both sides are words worth hearing. Present renders a speaker beside
   *  `from` too, so a learner can hear the before and the after. */
  sayFrom?: string;
}

/**
 * One piece of a construction row's "how it's built" equation. A piece is a run
 * of kana with an OPTIONAL numeric annotation shown in parentheses and the accent
 * colour: a numeric piece (じゅう, に, にひゃく) carries its VALUE ("10", "2",
 * "2 × 100"); a counter reading (ほん, にん) is a bare piece with no annotation.
 * Rendered by the count table in phase-intro-view.tsx: kana in text colour, the
 * "(value)" in accent.
 */
export interface CountBuildPiece {
  /** The kana of the piece — "じゅう", "に", "ほん". */
  readonly kana: string;
  /** The numeric annotation shown in parens, accent-coloured — "10", "2 × 10",
   * "11". Absent for a non-numeric piece such as a counter reading. */
  readonly value?: string;
}

/**
 * One row of a construction table — the three columns the page shows: the number
 * or count (`label`), the Japanese word as kanji with its kana reading in parens
 * plus a speaker (`word` + `reading`), and the annotated build equation
 * (`build` → `result`). Everything is DERIVED from the reading engines in
 * number-construction.ts, never hardcoded, so a row can never state a reading the
 * app does not also ship. Rendered by IntroCountTable in phase-intro-view.
 */
export interface CountRow {
  /** Column 1 — the numeral for a number table ("11"), or the numeral plus the
   * counter's English noun for a counter table ("3 people", "1 long thin object"). */
  readonly label: string;
  /** Column 2 — the word in kanji: "十一", "三十四", "三人", "二本". */
  readonly word: string;
  /** Column 2 — the reading of `word`, shown in parens and spoken by the speaker. */
  readonly reading: string;
  /** Other readings accepted for this exact number/count, shown beside the
   * preferred reading. Derived from the same engine set used by quiz grading. */
  readonly alternateReadings?: readonly string[];
  /** Column 3 — the pieces the word is built from, joined with " + ". */
  readonly build: readonly CountBuildPiece[];
  /** Column 3 — the result the pieces make, after the "→". */
  readonly result: CountBuildPiece;
}

/**
 * Whether a count group's "How it's built" column earns its place: true when SOME
 * row carries a real derivation (a non-empty `build`). An all-suppletive group —
 * 〜人's ひとり / ふたり / よにん, whose words are memorised, not built, so every row's
 * `build` is empty — returns false, and IntroCountTable drops the column (header
 * and cells) for it. A row's empty build is the suppletive flag; this is read off
 * the data, never off a counter's name, so any counter whose irregulars are all
 * suppletive loses the trivial column while 〜本 / 〜匹 / big keep theirs (their
 * irregulars carry the real sound shift). A Regular group always has builds.
 */
export function countGroupHasBuild(rows: readonly CountRow[]): boolean {
  return rows.some((row) => row.build.length > 0);
}

/**
 * One titled group of worked count rows — a "Regular" or "Irregular" table,
 * mirroring grammar's Godan / Ichidan / Irregular split. The group's title carries
 * the regular-vs-shifting meaning, but is shown ONLY when a page has both groups;
 * a page with a single group renders one untitled table (see IntroCountTables in
 * phase-intro-view). `counter` picks the first column's header — "Counter" for a
 * counter page, "Number" for a number range.
 */
export interface IntroCountGroup {
  /** The group heading — "Regular" or "Irregular". */
  readonly title: string;
  /** Whether this is a counter table (header "Counter") or a number range
   * (header "Number"). */
  readonly counter: boolean;
  /** The rows of this group. */
  readonly examples: readonly CountRow[];
}

/**
 * One row of the punctuation reference: a mark, its Japanese name, the English
 * mark it stands in for, and what it does. Punctuation is a catalogue rather than
 * a rule with worked examples, so it reads best as a table (see PunctuationTable
 * in phase-intro-view.tsx) instead of the prose-plus-examples every other card
 * uses.
 */
/**
 * One row of a build table: a verb turned into a form by dropping a tail and
 * adding another, shown as the equation `かう − う + って → かって`. The view
 * greys the dropped kana and accents the added one, so the eye reads the change
 * as a change. The optional `label` names the ending(s) the row covers (う・つ・る)
 * for a rule the reader should generalise, and is omitted for a one-off verb.
 */
export interface IntroBuildRule {
  /** The ending(s) this row covers, e.g. "う・つ・る". Omitted for a single verb. */
  label?: string;
  /** The dictionary-form verb, kana-only for a beginner: "かう". Omitted on a
   * `base` row, which starts from the form rather than the dictionary verb. */
  verb?: string;
  /** The kana dropped from the end of `verb`: "う". Omitted for an add-only step
   * (a て-form plus いる), where nothing is removed. */
  drop?: string;
  /** What is added after dropping: "って". Omitted for an irregular row (use
   * `to`), where there is no rule to add by. */
  add?: string;
  /** The whole result, for an IRREGULAR verb that follows no drop/add rule
   * (する → して). When set, the row renders as `verb → to` and `drop`/`add` are
   * ignored — the honest shape for a form you memorise rather than build. */
  to?: string;
  /** Highlight only this part of a whole-result row. `false` keeps the whole
   * equation neutral. When omitted, the whole result keeps the usual accent
   * used for irregular forms. */
  accent?: string | false;
  /** Whether this row gets pronunciation buttons. Phrase-building comparisons
   * containing English glosses set this false; ordinary conjugation rows omit it. */
  audio?: boolean;
  /** An English meaning for the built form, shown in a right-hand "Meaning"
   * column — used where the table doubles as a meaning demonstration (たべている ·
   * is eating), not just a build rule. The column appears only when some row
   * carries one. */
  gloss?: string;
  /** An optional aside for this row, shown in a right-hand notes column — e.g.
   * "The っ is a small っ, not a full-size つ." Rows without one leave the cell
   * empty; the column appears only when some row has a note. */
  note?: string;
}

/**
 * One row of a pattern derivation table: the dictionary verb, the form the
 * pattern attaches to, the finished pattern, and what the finished pattern
 * MEANS (かく · かき · かきにいく · "go in order to write") — the meaning is the
 * pattern applied to the word, not the bare verb.
 */
export interface IntroDeriveRow {
  /** The dictionary verb, kana: かく. */
  verb: string;
  /** The form the pattern attaches to: かき (stem), かいて (て-form). Omitted when
   * the pattern attaches to the word unchanged (a noun, a plain dictionary form). */
  form?: string;
  /** The finished pattern built on the verb: かきにいく. */
  result: string;
  /** What the finished pattern means — the pattern applied to this verb. */
  gloss?: string;
  /**
   * The verb's conjugation class, shown in its own column — e.g. "Godan — adds
   * う" / "Ichidan/irregular — adds よう". Only needed where the pattern's own
   * written form branches by class (〜(よ)うと思う's parenthesized よ); an
   * ordinary pattern conjugates the same way across classes as far as the
   * FORMULA is concerned, so this stays absent there. The column appears only
   * when some row carries one.
   */
  classLabel?: string;
}

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
  /**
   * The kicker above the title, saying what KIND of step this is.
   *
   * Defaults to "Before you go on", which is the honest label for every card in
   * this file: they interrupt a run of characters to explain the rule the next
   * ones follow. A TRACK intro (src/data/track-intros.ts) is not an interruption
   * — it is the first thing in the track, with nothing yet to go on from — so
   * those cards name their subject instead ("What hiragana is"). Optional so the
   * fourteen cards below are untouched.
   */
  eyebrow?: string;
  /**
   * The card's own stable identity, when it teaches ONE nameable thing rather
   * than an idea — a grammar pattern's written form (〜てください), matching
   * byte-for-byte what the Library entry's header shows for the same pattern
   * (see grammar-entry-view.tsx / auto-page.ts's `patternLabel`). Absent for a
   * card that explains a concept with no single name to point at ("Grammar is
   * how words fit together", a kana rule's own title). Distinct from `eyebrow`,
   * which several auto-generated pattern cards share verbatim ("Grammar") and
   * so cannot itself stand in for a name — see lesson-rail.tsx's `railCaption`,
   * the one place this is read.
   */
  name?: string;
  /** One line, the whole point of the card. */
  title: string;
  /** This page is one word-type section of a larger form explanation. Its title
   * is the accented section label, with no separate eyebrow above it. */
  sectionTitle?: boolean;
  /** The Library entry header already states this page's title and meaning, so
   * its intro card can be omitted there while the lesson keeps the full intro. */
  hideLibraryIntro?: boolean;
  body: IntroPara[];
  /** Prose shown after this card's worked build table/footer. Used when the
   * worked example belongs to the first of two named sections, so the second
   * section begins only after that evidence instead of above it. */
  bodyAfterBuild?: IntroPara[];
  /**
   * Worked examples for the rule, shown beside the prose on the Library page (see
   * mark-view.tsx) and below it in the teach walk. Optional: the kana marks carry
   * their evidence in conversion tables (dakuten-rows.ts) instead, so only the
   * glyphless writing rules — 々, rendaku, okurigana — use this.
   */
  examples?: readonly IntroExample[];
  /** Put worked examples under the prose instead of beside it. Used when the
   * example is the immediate next line of one paragraph, not a separate evidence
   * column for the whole page. */
  examplesPlacement?: "beside" | "below";
  /** Zero-based body-paragraph index after which the example box is inserted.
   * More precise than `below` when later notes must continue after the example. */
  examplesAfterBodyIndex?: number;
  /**
   * A build table: the rule as a list of equations (`かう − う + って → かって`),
   * the dropped kana greyed and the added one accented. Used by the grammar
   * te-form pages, where "how to build it" reads best as the transformation
   * itself rather than a sentence describing it.
   */
  buildRules?: readonly IntroBuildRule[];
  /**
   * Worked count examples split into titled "Regular" / "Irregular" tables — the
   * number-construction pages' equivalent of the grammar build tables. Present on
   * the number-range and counter rule cards, rendered by IntroCountTableGroup
   * beneath the prose in place of the single inline examples list.
   */
  countTables?: readonly IntroCountGroup[];
  /**
   * Column headings for a build table's heading row. `label` names the first
   * column (endings on one page, verb types on another) and so has no sensible
   * default; `change` and `note` default to "Change" and "Note".
   */
  buildHeads?: { label?: string; change?: string; note?: string; gloss?: string };
  /**
   * SEVERAL titled build tables on one page, when a single table would lump
   * distinct groups together. The て-form's build page uses this: a Godan table,
   * an Ichidan table, and an Exceptions-and-irregulars table, each under its own
   * heading, rather than one long table with mixed labels. Rendered in place of
   * `buildRules` (a page uses one or the other, not both).
   */
  buildTables?: readonly {
    readonly title: string;
    readonly rules: readonly IntroBuildRule[];
    readonly heads?: { label?: string; change?: string; note?: string; gloss?: string };
  }[];
  /** Build material grouped by the kind of word it applies to. Every grammar
   * table is presented through one of these sections: accented heading,
   * instruction (and optional formula), then the table or table groups. */
  buildSections?: readonly {
    readonly title: string;
    /** Omit the visible heading when the whole lesson already names this one
     * word type, while retaining the section's semantic name in the data. */
    readonly hideTitle?: boolean;
    readonly body: readonly IntroPara[];
    readonly formula?: { base: string; add?: string; trim?: string };
    readonly rules?: readonly IntroBuildRule[];
    readonly heads?: { label?: string; change?: string; note?: string; gloss?: string };
    readonly tables?: readonly {
      readonly title: string;
      readonly rules: readonly IntroBuildRule[];
      readonly heads?: { label?: string; change?: string; note?: string; gloss?: string };
    }[];
    readonly footer?: { chain: string; gloss: string };
  }[];
  /**
   * A build FORMULA for a pattern's "how to build it": the form it hangs off shown
   * in a dashed outline, then + the suffix — [ない-form] + でください. `base` is the
   * form's name ("ない-form"), `add` the suffix, `trim` the tail the pattern drops
   * off the form first ([ます-form] − ます + ましょう). Rendered in place of the build
   * blurb, so the summary reads as the recipe itself before the example tables.
   */
  buildFormula?: { base: string; add: string; trim?: string };
  /**
   * A derivation table for a PATTERN page: the dictionary verb, the form the
   * pattern attaches to, and the finished pattern — かく · かき · かきにいく. Shows
   * the whole chain from the word you look up to the pattern, so a learner sees
   * how the verb travels through the form into the pattern. The form column is
   * dropped when the pattern attaches to the word unchanged (a noun, a plain
   * dictionary form).
   */
  deriveRules?: readonly IntroDeriveRow[];
  /** Column headings for a derivation table. `form` names the middle column
   * (て-form, stem, …); `verb`/`pattern` default to "Verb"/"Pattern". */
  deriveHeads?: { verb?: string; form?: string; pattern?: string };
  /** Several host-specific derivation tables on one page. A pattern that works
   * with both verbs and adjectives keeps those rules in separate titled
   * sections instead of presenting one host as if it were the whole pattern. */
  deriveTables?: readonly {
    readonly title: string;
    readonly instruction?: string;
    readonly formula?: { base: string; add?: string; trim?: string };
    readonly rules: readonly IntroDeriveRow[];
    readonly heads?: { verb?: string; form?: string; pattern?: string };
  }[];
  /**
   * A closing line under a build table that puts the rows together — the chain
   * the steps build toward (たべて、のんで、はなしている) with its meaning. Used by
   * the 〜ている "connect ongoing actions" page: show each verb's form, then
   * combine them.
   */
  buildFooter?: { chain: string; gloss: string };
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
  /**
   * A hedged aside, shown ONCE at the bottom of the card via the shared
   * `Callout` component (the same left-rule "Heads up." treatment kana's
   * conversion tables use) — not another entry in `body`. For a remark that
   * admits an exception or a pattern the reader should notice but not lean on,
   * mixing it into the numbered body paragraphs makes it read as one more claim
   * the card is teaching, when it's the opposite: a caveat about the claims
   * above it. Used by the transitivity intro's が/を pattern note.
   */
  calloutTip?: string;
  /**
   * One real sentence showing the pattern in use, with the piece it actually
   * built picked out — the same "In a sentence" evidence the Library grammar
   * page shows (grammar-entry-view.tsx), generated once by autoPatternPage from
   * the Tatoeba corpus (data/grammar/corpus.ts) so the teach walk and the
   * Library page show the identical sentence rather than two independently
   * chosen ones. Absent, not empty, for a pattern the corpus has not tagged.
   */
  sentenceExample?: SentenceExample;
}

/**
 * A worked sentence for a grammar pattern's card: a real sentence, its gloss,
 * and the `[start, end)` span of the piece this pattern built, to accent.
 */
export interface SentenceExample {
  /** The whole sentence: "最初着る前に洗濯してください。" */
  readonly jp: string;
  /** Its English gloss: "Wash before first wearing." */
  readonly en: string;
  /** The `[start, end)` span of `jp` this pattern actually built — the part to
   * highlight, not the whole sentence. */
  readonly span: readonly [number, number];
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
      text: "You already know every shape here.",
    },
    // TAGGED ゛, AND THE TAG IS THE FIX. The count and the worked pair are both
    // about the two dashes: か → が is dakuten, and 25 is dakuten plus handakuten
    // together. Untagged, this sentence went to BOTH Library pages (see
    // `bodyFor` in data/marks.ts), so the ゜ page said "this is 25 more
    // characters" two lines under its own "it only ever lands on the は row" —
    // the circle makes five. The lesson card is unchanged: it teaches both marks
    // at once and the sentence is true of the pair. Only the split needed to know
    // which mark it belongs to.
    {
      mark: "゛",
      text: "か and が are the same character with a mark, so this is 25 more characters without a single new drawing to learn.",
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
      text: "The marks work exactly as they did in hiragana, on shapes you already know.",
    },
    // Tagged ゛ for the reason the hiragana card's closing line is. Same
    // sentence, same split, same page it was wrong on.
    {
      mark: "゛",
      text: "カ and ガ are the same character with a mark, so this is 25 more characters without a single new drawing to learn.",
    },
  ],
};

export const COMBO_H: PhaseIntro = {
  id: "intro-combo-hiragana",
  setId: "hiragana",
  title: "A small や, ゆ or よ fuses onto the kana in front of it.",
  body: [
    {
      text: "Only the い-row kana take these: き, し, ち, に, ひ, み, り and their voiced partners. き with a small ゃ is one sound in one beat, kya, not two.",
    },
    {
      lead: "The size is the whole tell.",
      text: "きゃ, with the small ゃ, is “kya”. きや, with a full-size や, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height. You will misread a few at first. That is normal, and it stops once you have seen enough of them.",
    },
    {
      text: "No new shapes again. Each one is two characters you already know, one of them shrunk. These are called yōon: a small ゃ, ゅ or ょ fused onto the kana in front of it.",
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
      text: "Only the イ-row kana take these: キ, シ, チ, ニ, ヒ, ミ, リ and their voiced partners. キ with a small ャ is one sound in one beat, kya, not two.",
    },
    {
      lead: "The size is the whole tell.",
      text: "キャ, with the small ャ, is “kya”. キヤ, with a full-size ヤ, is “kiya”: two separate sounds, two beats. Side by side the difference is obvious; on its own, look at the height. You will misread a few at first. That is normal, and it stops once you have seen enough of them.",
    },
    {
      text: "Same rule as the hiragana yōon, on shapes you already know. Nothing new to draw.",
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
  title: "A held vowel is a different word.",
  body: [
    {
      text: "おばさん is your aunt. おばあさん, with the vowel held one beat longer, is your grandmother.",
    },
    {
      lead: "In hiragana you hold the sound by adding the matching vowel kana.",
      text: "The あ after ば doubles that あ sound, so ば is held a beat longer. い lengthens with another い, う with another う.",
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
      text: "Same rule as hiragana: a held vowel makes a different word. Katakana just writes it differently, with a single dash, ー, whatever the vowel is.",
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

// PARTICLE READING — three base kana that change sound when they do a job.
// ========================================================================
// は, へ and を are read one way as ordinary kana and another way when they act
// as a particle: は ha/wa, へ he/e, を always o. This is a READING rule about
// three characters a learner meets in the base hiragana run, not a phase that
// starts (dakuten, combos) nor a rule that lands once every shape is known
// (long vowels, small っ). So it is not word-gated like 々 or rendaku — those
// have no kana section to hang on, and this one does: は is the first glyph of
// the h-h row (はひふへほ).
//
// ANCHORED BEFORE h-h, the row where は is taught. 私は is one of the very first
// things anyone learns to say, so the rule has to land during the kana run,
// right as は appears, rather than waiting for the words track — a learner who
// meets は as "ha" and only hears about "wa" weeks later reads 私は wrong for
// weeks and has to unlearn it. BEFORE, not AFTER: は opens the h-h row, so the
// before-anchor puts the rule immediately ahead of は itself, the earliest and
// closest point to where it is taught, which is the "here is what is about to
// change" the before-run is for. へ rides the same row; を is met later in h-w,
// and the card names it forward, which is honest for a rule worth knowing early.
//
// The sounds are set off in curly quotes, the same way every other card in this
// file marks a sound in prose (“kya”, “kitte”): IntroBody has no italic
// primitive, and inventing one for this card alone is exactly the drift this
// file exists to prevent. Reinforcement lives on は and へ's own cards (the NOTES
// table in src/data/characters.ts); を's own card teaches its particle role and
// its /o/ reading (src/data/mnemonics.ts).
export const PARTICLE_RULE: PhaseIntro = {
  id: "intro-particle-reading",
  setId: "hiragana",
  title: "Three kana change their sound when they do a job.",
  body: [
    {
      text: "は is normally “ha”, but when it marks the topic of a sentence it is read “wa”: 私は is “watashi wa”.",
    },
    {
      text: "へ is normally “he”, but when it points somewhere it is read “e”: 学校へ is “gakkou e”.",
    },
    {
      text: "を is only ever used for this job, and it is always read “o”.",
    },
    {
      text: "Everywhere else, they keep their usual sound. You will learn 私は on your first day, so this one is worth knowing early.",
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
  title: "Japanese punctuates its sentences differently.",
  body: [
    {
      lead: "And the thing that isn’t there: spaces.",
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
  title: "The kanji does not always finish the word.",
  body: [
    {
      lead: "Words can have trailing kana.",
      text: "This kana tail is called okurigana and is part of the word. One kanji can start several words. The tail is what tells them apart.",
      accent: "okurigana",
    },
    {
      lead: "The tail affects the pronunciation.",
      text: "生 on its own can be read several ways. In 生きる, the tail is きる and 生 is read い. In 生まれる, the tail is まれる and 生 is read う. Same kanji, different tail, different sound.",
    },
  ],
  // No worked examples: the second paragraph already names 生きる (tail きる, 生 =
  // い) and 生まれる (tail まれる, 生 = う), so an example panel beside it restated
  // the prose word for word. The moving/not-moving cards below carry the examples.
};

export const OKURIGANA_MOVING: PhaseIntro = {
  id: "intro-okurigana-moving",
  setId: NO_SCRIPT,
  title: "Sometimes the tail moves. Sometimes it stays.",
  body: [
    {
      lead: "On a verb or an adjective, the tail can change.",
      text: "The okurigana is the part that shifts when the word changes tense or form. The kanji stays put; only the tail moves.",
      examples: [
        { from: "生きる", accentFrom: "きる", op: "→", to: "生きた", accentTo: "きた", gloss: "lived", sayFrom: "生きる", say: "生きた" },
        { from: "生きる", accentFrom: "きる", op: "→", to: "生きない", accentTo: "きない", gloss: "does not live", sayFrom: "生きる", say: "生きない" },
      ],
    },
    {
      lead: "Not every tail moves.",
      text: "Plenty of words have okurigana that never changes. 答え is just 答え: the え sits on the end and stays put, no matter how the word is used.",
      examples: [
        { from: "答 + え", accentFrom: "え", to: "答え", accentTo: "え", reading: "こたえ", gloss: "answer", say: "答え" },
      ],
    },
  ],
};

// OKURIGANA_FIXED merged into OKURIGANA_MOVING above.

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
      text: "You will get these backwards for a while. English gives you no help here, because 'open' does both jobs. Expect to mix them up, and expect that to sort itself out with time.",
    },
    {
      lead: "The endings often shift in familiar ways.",
      text: "Most pairs share a kanji and swap only the kana on the end. The usual shifts are まる→める, る→す, and く→ける. Naming the shift helps you remember a pair, but it never tells you which verb is which, and some pairs follow no rule at all.",
    },
  ],
  calloutTip:
    "The sentence itself can hint at which one it is. が often marks the thing something happens to when no one is named as doing it; を often marks the thing someone is acting on. It is worth noticing, not something to lean on. Plenty of sentences will not fit the pattern, and it is no substitute for knowing the pair itself.",
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

// COUNTER SOUND CHANGE — the h→p/b shift, presented the way the Writing rules
// shelf presents dakuten: a rule with worked forms, not six memorised words. It
// opens no track (that is track-counters, in track-intros.ts); it is the rule
// card the counters track's phase 2 rides in on, word-gated in lesson-steps.ts
// ahead of the first counted form whose reading shifts (本 or 匹). Script-neutral
// (NO_SCRIPT): the shift is a sound, not a spelling of one script.
//
// DRAFT copy for the owner's voice pass, the same as the track intros and the
// task-22 listening copy. The FORMS in `examples` are FACTUAL DATA, verified
// against a reference (see src/data/counters.ts); the prose is scaffolding. Every
// draft string is quoted in the task report.
export const COUNTER_SOUND_CHANGE: PhaseIntro = {
  id: "intro-counter-sound-change",
  setId: NO_SCRIPT,
  title: "Some counters change their sound after certain numbers.",
  body: [
    {
      lead: "After 1, 6, 8 and 10, an h-sound counter hardens.",
      text: "本 is ほん on its own, but 一本 is いっぽん and 六本 is ろっぽん. The same shift lands on 匹: 一匹 is いっぴき, 六匹 is ろっぴき.",
    },
    {
      lead: "After 3, it voices instead.",
      text: "三本 is さんぼん and 三匹 is さんびき. That is the dakuten sound you already know, arriving at the seam between the number and the counter.",
    },
    {
      lead: "Not every counter does this.",
      text: "枚 begins with ま, so it never shifts: 一枚 is いちまい, 三枚 is さんまい. When a counter starts with an h-sound, expect the change; otherwise read it straight.",
    },
  ],
  examples: [
    { from: "一 + 本", to: "一本", reading: "いっぽん", gloss: "one long thin object (p)", say: "一本" },
    { from: "三 + 本", to: "三本", reading: "さんぼん", gloss: "three long thin objects (b)", say: "三本" },
    { from: "六 + 本", to: "六本", reading: "ろっぽん", gloss: "six long thin objects (p)", say: "六本" },
    { from: "三 + 匹", to: "三匹", reading: "さんびき", gloss: "three small animals (b)", say: "三匹" },
    { from: "三 + 枚", to: "三枚", reading: "さんまい", gloss: "three flat things (no shift)", say: "三枚" },
  ],
};

// HOW NUMBERS COMBINE — the tens rule, now the "tens" generative unit's rule
// card. It is shown by the numbers scheduler's tens unit (src/lib/counter-lesson
// .ts), right after 1-10 and before the generative 11-99 reading round, which is
// where "you can build the rest yourself" is true rather than hypothetical. It is
// no longer word-gated on a run of 11-99 forms (those forms are gone; the unit
// owns showing this card). Still in CONCEPT_CARD_IDS so the reset sweep and the
// settings mirror know it. Script-neutral (NO_SCRIPT): a number is a sound, not a
// spelling of one script. The READINGS in `examples` are verified data
// (number-reading.ts); the prose is the owner's to finalize.
export const NUMBERS_COMPOSE: PhaseIntro = {
  id: "intro-numbers-compose",
  setId: NO_SCRIPT,
  title: "Past ten, you build numbers instead of memorizing them.",
  body: [
    {
      lead: "The tens are a digit in front of じゅう.",
      text: "じゅう is ten, にじゅう is two tens (20), さんじゅう is 30. There are no new words the way English jumps to “twenty” and “thirty”: every ten is a digit you already know, plus じゅう.",
    },
    {
      lead: "For the numbers between, add a ones digit on the end.",
      text: "にじゅういち is 21, よんじゅうなな is 47. Once you know 1 to 10 and じゅう, you can say every number up to 99 without learning another word.",
    },
    {
      lead: "Three of the digits read two ways.",
      text: "4 is よん or し, 7 is なな or しち, and 9 is きゅう or く. Counting leans on the first of each (よん, なな, きゅう), but the other reading turns up in fixed words and telling the time, so both are worth knowing.",
    },
  ],
  examples: [
    { from: "に + じゅう", to: "20", reading: "にじゅう", gloss: "twenty", say: "にじゅう" },
    { from: "さん + じゅう", to: "30", reading: "さんじゅう", gloss: "thirty", say: "さんじゅう" },
    { from: "にじゅう + いち", to: "21", reading: "にじゅういち", gloss: "twenty-one", say: "にじゅういち" },
    { from: "よんじゅう + なな", to: "47", reading: "よんじゅうなな", gloss: "forty-seven", say: "よんじゅうなな" },
  ],
  examplesPlacement: "below",
};

// THE BIG STEPS — 100 / 1,000 / 10,000, their sound shifts, and 万-grouping. The
// "big" generative unit's rule card (src/lib/counter-lesson.ts), shown after the
// tens unit and before the generative 100-9999 reading round. It teaches the
// three base words the compose rule cannot build (ひゃく, せん, いちまん), the
// hundreds/thousands hardening (300 さんびゃく, 8,000 はっせん), and that Japanese
// groups in ten-thousands (100,000 = 十万) rather than reaching for a word for
// "million". A once-ever concept card (id in CONCEPT_CARD_IDS). Script-neutral
// (NO_SCRIPT). The READINGS in `examples` are verified against number-reading.ts;
// the prose is the owner's to finalize. Mirrors NUMBERS_COMPOSE's structure.
export const NUMBERS_BIG: PhaseIntro = {
  id: "intro-numbers-big",
  setId: NO_SCRIPT,
  title: "The big steps are their own words. Everything between builds from them.",
  body: [
    {
      lead: "The big jumps are three words of their own.",
      text: "100 is ひゃく, 1,000 is せん, 10,000 is いちまん. Learn those three and you can already say numbers into the tens of thousands, by putting a digit in front the same way にじゅう is two tens.",
    },
    {
      lead: "A few of them shift sound, like the counters do.",
      text: "300 is さんびゃく, 600 is ろっぴゃく and 800 is はっぴゃく, not さんひゃく. 3,000 is さんぜん and 8,000 is はっせん. It is the same hardening you met on 本 and 匹, landing at the seam before ひゃく and せん.",
    },
    {
      lead: "Japanese counts in ten-thousands, not thousands.",
      text: "After まん there is no fresh word for “million”. 100,000 is 十万 じゅうまん, ten of the ten-thousands, and 1,000,000 is 百万, a hundred of them. You keep grouping by 万 instead of a bigger single word.",
    },
  ],
  examples: [
    { from: "百", to: "100", reading: "ひゃく", gloss: "hundred", say: "ひゃく" },
    { from: "三 + 百", to: "300", reading: "さんびゃく", gloss: "three hundred (shift)", say: "さんびゃく" },
    { from: "六 + 百", to: "600", reading: "ろっぴゃく", gloss: "six hundred (shift)", say: "ろっぴゃく" },
    { from: "八 + 百", to: "800", reading: "はっぴゃく", gloss: "eight hundred (shift)", say: "はっぴゃく" },
    { from: "千", to: "1,000", reading: "せん", gloss: "thousand", say: "せん" },
    { from: "三 + 千", to: "3,000", reading: "さんぜん", gloss: "three thousand (shift)", say: "さんぜん" },
    { from: "八 + 千", to: "8,000", reading: "はっせん", gloss: "eight thousand (shift)", say: "はっせん" },
    { from: "万", to: "10,000", reading: "いちまん", gloss: "ten thousand", say: "いちまん" },
    { from: "十 + 万", to: "100,000", reading: "じゅうまん", gloss: "hundred thousand (十万)", say: "じゅうまん" },
  ],
  examplesPlacement: "below",
};

// PITCH ACCENT — a pronunciation card, and this file's first card about how a
// word SOUNDS rather than how it is written.
// =========================================================================
// ⚠️ DRAFT COPY — Sam to finalize. ⚠️ Every `title`, `lead` and `text` below is
// placeholder prose written to prove the mechanism and land the three jobs (what
// pitch is, how it helps, why now), in the same status as the track intros and
// the counter/keigo cards. The STRUCTURE is the deliverable; the sentences are
// scaffolding for the owner's voice pass. The 箸/橋 pair and the glossary term it
// echoes (src/data/terms.ts, "pitch-accent") are the fixed facts; the wording is
// not. Every draft string here is quoted in the task report.
//
// WHY IT EXISTS AND WHERE IT FIRES
// --------------------------------
// The app draws a pitch overline over a word's reading — on the drill reveal, on
// the Library entry, and (task 09) wherever else a reading shows — the moment the
// word has verified pitch. That line was appearing with nothing to say what it
// meant: a mark a learner cannot read is at best noise and at worst a habit set
// wrong. So this card is word-gated in lesson-steps.ts ONCE, ahead of the first
// word the learner meets that carries a verified pitch, so the line is always
// taught before it is first drawn. It is a once-ever concept card (its id is in
// CONCEPT_CARD_IDS, src/lib/intro-shown.ts), not a per-lesson rule reminder:
// ~69% of words carry pitch, so re-firing it per lesson would put it ahead of
// almost every word lesson. Script-neutral (NO_SCRIPT): pitch is a sound, not a
// spelling of one script.
//
// DISPLAY, NEVER GRADED. The card says outright that the app never asks the
// learner to produce or pick a pitch — the overline is shown so a wrong habit is
// not set, and that is the whole of its job. See pitch-mark.tsx.
export const PITCH_INTRO: PhaseIntro = {
  id: "intro-pitch",
  setId: NO_SCRIPT,
  eyebrow: "What pitch accent is",
  title: "A word carries a tune: some morae are said high, some low.",
  body: [
    {
      lead: "Pitch accent is the rise and fall across a word.",
      text: "Japanese does not stress a syllable the way English does. Instead the voice sits high on some beats of a word and low on others, and where it drops is fixed for each word. From now on, a thin line is drawn over the reading to show it: the line runs over the high beats and turns down where the voice falls.",
    },
    {
      lead: "A flat line means the pitch never drops.",
      text: "Many words have no fall at all. Their line runs level across the reading and simply stops, with no downturn, which tells you the voice holds its pitch to the end of the word instead of dropping partway through.",
    },
    {
      lead: "The symbol is here to help you tell same-sounding words apart.",
      text: "箸 (chopsticks) and 橋 (bridge) are both read はし, and the pitch is the only difference in sound: 箸 starts high and drops, 橋 starts low and rises. We show the line so you learn that difference from the start, because a pronunciation learned wrong is hard to unlearn later. Most words are not a pair like this, so mostly the line is just how the word sounds.",
    },
    {
      lead: "The audio does not include the pitch.",
      text: "The “hear it” speaker is a synthesized voice, and it uses its own accent rather than the word's real one. So trust the LINE over the reading, not the sound, when you want the accent. The sound is there to teach you the word, and the line is there to teach you its pitch.",
    },
  ],
};

// ON'YOMI AND KUN'YOMI — a reading card, the first thing to name the two reading
// families outright. It fires once, ahead of the first curriculum kanji a learner
// meets that HAS an on'yomi (word-gated in lesson-steps.ts, the same shape the
// pitch card uses). A kanji entry then carries a brief side-by-side reading hint
// with example words; this card is where the CONCEPT is taught, so that hint can
// stay practical. Once-ever (id in CONCEPT_CARD_IDS).
// Script-neutral (NO_SCRIPT): a reading is a sound, not a spelling. The example
// readings are real (人 じん/ひと, 車 しゃ/くるま). The stable id and exported
// constant keep existing completion history valid even though the card now names
// both on'yomi and kun'yomi.
export const ONYOMI_INTRO: PhaseIntro = {
  id: "intro-onyomi",
  setId: NO_SCRIPT,
  eyebrow: "Kun’yomi and on’yomi",
  title: "A kanji can carry a native Japanese reading and a borrowed Chinese reading.",
  body: [
    {
      lead: "Kun’yomi is the native Japanese reading.",
      text: "Japanese already had words such as ひと (person) and くるま (car) before their kanji was added. Those native words were matched to 人 and 車. If a kanji is used by itself, or has hiragana attached to its tail, you usually read it using kun’yomi.",
    },
    {
      lead: "On’yomi is the reading borrowed from Chinese.",
      text: "When multiple kanji are linked together to form a larger vocabulary word, you usually read them using on’yomi. 人 becomes じん in 外国人 (foreigner), and 車 becomes しゃ in 電車 (train).",
    },
    {
      lead: "Use that pattern as a clue, not a guarantee.",
      text: "Japanese has many exceptions and mixed-reading words, so the word itself always wins. Each kanji page places its kun’yomi and on’yomi side by side, with an everyday word showing where each reading is used.",
    },
  ],
};

// BUILT FROM — the card that explains how to READ the "Built from" box: which
// piece is the meaning and which is only the sound. It fires once, ahead of the
// first curriculum kanji whose Built-from box actually has pieces to show
// (word-gated in lesson-steps.ts), so the distinction arrives with a real example
// on screen rather than in the abstract. Leans on the on'yomi card having been
// read — the "sound piece" is exactly the on-reading that card just named.
// Once-ever (id in CONCEPT_CARD_IDS). Script-neutral. Examples are real jōyō
// kanji (河 = 氵 + 可, 明 = 日 + 月).
export const BUILT_FROM_INTRO: PhaseIntro = {
  id: "intro-built-from",
  setId: NO_SCRIPT,
  eyebrow: "How a kanji is built",
  title: "A kanji's pieces do one of two jobs: give the meaning, or give the sound.",
  body: [
    {
      lead: "Some pieces are a clue to the meaning.",
      text: "河 (river) is 氵 next to 可. The 氵 is the water piece, and it tells you what 河 is about: something to do with water. A piece that works this way carries the idea of the kanji, and the box tags it “meaning”.",
    },
    {
      lead: "Some pieces are only there for the sound.",
      text: "The 可 in 河 says nothing about rivers. It is there because it lends 河 its on'yomi, か: the reading 河 takes in a word like 河川 (かせん, a river). The box tags a piece like this “phonetic” and shows the reading it lends, with a word where you can hear it.",
    },
    {
      lead: "A kanji can be all meaning, too.",
      text: "明 (bright) is 日 (sun) beside 月 (moon): two meaning pieces, no sound piece, the two of them together giving the idea of brightness. Plenty of kanji are built this way.",
    },
    {
      lead: "And some pieces are just shape.",
      text: "A few strokes are only there to make the character look the way it does, carrying neither a meaning nor a sound worth learning. The box leaves those out, so what it shows you is always doing one of the two real jobs.",
    },
  ],
};

/**
 * Section id → the card shown BEFORE that section's characters.
 *
 * Keyed on the FIRST group of each phase, so the concept lands the moment the
 * phase starts and never again. The one base-row key is h-h: the particle
 * reading rule rides the は row rather than a phase opening, because は is where
 * it first matters (see the PARTICLE_RULE note above).
 */
export const INTRO_BEFORE: Record<string, PhaseIntro> = {
  "h-h": PARTICLE_RULE,
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
  PARTICLE_RULE,
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
  TRANSITIVITY_INTRO,
  COUNTER_SOUND_CHANGE,
  NUMBERS_COMPOSE,
  NUMBERS_BIG,
  PITCH_INTRO,
  ONYOMI_INTRO,
  BUILT_FROM_INTRO,
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
