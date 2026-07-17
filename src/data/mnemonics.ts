// In-app kana mnemonics — the app's OWN hooks, replacing the outbound
// Tofugu/WaniKani links.
//
// WHAT THIS FILE IS
// =================
// A pure data table, keyed by the character it teaches. It holds the words and
// the drawing; it renders nothing. `MnemonicCard` (components/lesson/
// mnemonic-card.tsx) is the one place it turns into pixels, and two call sites
// (the teach-me walkthrough and the Library entry page) gate on `getMnemonic`
// returning non-null. A kana with no row here shows no card — see the
// hide-when-absent rule in MnemonicCard.
//
// ADDING A ROW IS APPENDING AN ENTRY, AND NOTHING ELSE
// ====================================================
// The key is the glyph, so `MnemonicKey = string`. It is deliberately NOT
// "kana-only" anywhere: a kanji glyph ("生") is a valid key the day someone
// authors one, with zero code change here or at either call site. To fill in
// the rest of hiragana, append to MNEMONICS. To swap in an owner-approved
// vowel, replace that one entry in place.
//
// THE ACCENT COLOUR IS RESERVED FOR THE SOUND
// ===========================================
// This is the rule the whole shape of `SoundLine` exists to enforce. When a
// line highlights a span, that span carries the KANA'S SOUND — never a word
// that describes the drawing. The first draft of this content underlined
// "loop" for あ; "loop" sounds like "oo" and あ is "ah", so that accent was a
// lie the reader's ear had to fight. Here it is not expressible: `SoundLine`
// has one emphasis field, named `sound`, and it is the substring to accent. A
// line with no sound-bearing word to accent sets `sound: null` and highlights
// NOTHING — a shape word is never the fallback. mnemonics.test.ts holds the
// line: a non-null `sound` must contain the entry's own accented sound token.
//
// PROVISIONAL CONTENT
// ===================
// The five vowels below are seeded from the "drawn over the glyph" style
// proposal (scratchpad/vowel-mnemonics-over-glyph.html): KanjiVG stroke
// geometry as the canvas, the mnemonic reusing those real strokes as features
// of the pictured thing. They are PROVISIONAL — the owner replaces each with
// the approved version by editing its entry in place. The SVG stroke data is
// KanjiVG (© KanjiVG contributors, CC BY-SA 3.0); the hooks and drawings are
// original to this app.

/** The glyph a mnemonic teaches. A string, so kanji slot in later unchanged. */
export type MnemonicKey = string;

/**
 * A line of prose with one optional emphasized span — and the emphasis is
 * ALWAYS the sound.
 *
 * There is exactly one emphasis field and it is named `sound`, on purpose: the
 * accent colour on a mnemonic is reserved for the span that carries the kana's
 * pronunciation, and this type cannot express "accent a shape word." When a
 * line has no word that carries the sound, `sound` is `null` and nothing is
 * accented — never a shape word as a consolation highlight.
 */
export interface SoundLine {
  /** Text before the accented span. */
  lead: string;
  /**
   * The exact substring to render in the accent colour — a span that carries
   * the kana's SOUND. `null` when the line has no sound-bearing word, in which
   * case nothing is accented. Invariant (see mnemonics.test.ts): when non-null
   * this contains the entry's accented sound token (`Mnemonic.sound`),
   * case-insensitively.
   */
  sound: string | null;
  /** Text after the accented span. */
  tail: string;
}

/** A real beginner word that shows the kana in use, with the kana highlighted. */
export interface MnemonicExample {
  /** The word in kana, e.g. "あめ". */
  word: string;
  /** Its romaji reading, e.g. "ame". */
  reading: string;
  /** Its English gloss, e.g. "rain". */
  gloss: string;
  /** Index into `word` (by code point) of the kana this entry teaches. */
  hitIndex: number;
}

/** One kana's mnemonic: the hooks, the drawing, and a word that proves it. */
export interface Mnemonic {
  /** The glyph, e.g. "あ". Matches its key in MNEMONICS. */
  glyph: string;
  /** Romaji reading, e.g. "a". */
  romaji: string;
  /**
   * The accented SOUND token — the English sound the analogy calls out and the
   * one span the accent colour is reserved for, e.g. "ee" for い. Every
   * `SoundLine.sound` in this entry carries this (enforced by test).
   */
  sound: string;
  /** Optional IPA / spelled-out sound shown under the reading, e.g. "/a/ · ah". */
  ipa?: string;
  /** What the drawing depicts, e.g. "anchor". Shown as a small tag. */
  object?: string;
  /**
   * The "say it like the X in Y" hook. `sound` accents the English sound. This
   * line always has a sound to accent — an analogy with none would not be one.
   */
  analogy: SoundLine;
  /**
   * The shape→picture hook: how the real strokes become the pictured thing.
   * `sound` accents a sound-bearing word (い → "eel", う → "goose") or is
   * `null` when the picture's name doesn't carry the sound (あ → "anchor").
   */
  mnemonic: SoundLine;
  /**
   * Inline SVG markup, drawn over the glyph's true KanjiVG strokes. Uses
   * `currentColor` for the ink strokes and `var(--accent)` for the feature the
   * mnemonic leans on, so it survives every theme and both light and dark with
   * no recolouring. A single 0 0 109 109 viewBox (the KanjiVG grid).
   */
  svg: string;
  /** A real beginner word with the kana highlighted. */
  example: MnemonicExample;
  /**
   * An honest phonetic flag — where English only gets close and the 🔊 clip is
   * the real answer (う is the loudest case: un-rounded, "trust the 🔊").
   * Rendered muted; omitted when there's nothing to caveat.
   */
  approximate?: string;
}

// --- SVG stroke styling ----------------------------------------------------
// Factored out so each drawing reads as its geometry, not its attributes. Ink
// is currentColor (inherits the card's text); the feature the mnemonic points
// at is the accent; faint marks (waterline) are ink at low opacity.
const BASE = `fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"`;
const FEAT = `fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
const ADD = `fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
const DOT = `fill="var(--accent)" stroke="none"`;
const FAINT = `fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="2.2" stroke-linecap="round"`;

/**
 * The table. Keyed by glyph — appending an entry is the whole of adding a
 * mnemonic. PROVISIONAL vowel content, seeded from the over-the-glyph style
 * proposal; the owner replaces each entry in place with the approved version.
 */
export const MNEMONICS: Record<MnemonicKey, Mnemonic> = {
  // あ — the long lower-right curl is an anchor's fluke sweeping out of water.
  あ: {
    glyph: "あ",
    romaji: "a",
    sound: "a",
    ipa: "/a/ · ah",
    object: "anchor",
    analogy: { lead: "Say it like the ", sound: "a", tail: " in father — open and low." },
    mnemonic: {
      lead: "The long curling lower-right stroke is the fluke of an ",
      sound: null,
      tail: "anchor, sweeping up out of the water; the vertical stroke is its shaft, the top cross-stroke its stock.",
    },
    svg: `<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="9" r="5" ${ADD}/>
      <path d="M31.01,33c0.88,0.88,2.75,1.82,5.25,1.75c8.62-0.25,20-2.12,29.5-4.25c1.51-0.34,4.62-0.88,6.62-0.5" ${BASE}/>
      <path d="M49.76,17.62c0.88,1,1.82,3.26,1.38,5.25c-3.75,16.75-6.25,38.13-5.13,53.63c0.41,5.7,1.88,10.88,3.38,13.62" ${BASE}/>
      <path d="M65.63,44.12c0.75,1.12,1.16,4.39,0.5,6.12c-4.62,12.26-11.24,23.76-25.37,35.76c-6.86,5.83-15.88,3.75-16.25-8.38c-0.34-10.87,13.38-23.12,32.38-26.74c12.42-2.37,27,1.38,30.5,12.75c4.05,13.18-3.76,26.37-20.88,30.49" ${FEAT}/>
      <path d="M60,101 l7,4 M67,105 l1,-8" ${ADD}/>
      <path d="M8,100 q6,-5 12,0 t12,0 t12,0 t12,0 t12,0 t12,0" ${FAINT}/>
    </svg>`,
    example: { word: "あめ", reading: "ame", gloss: "rain", hitIndex: 0 },
    approximate: "Not the a in “cat.” The 🔊 clip is the truth; “father” only gets you close.",
  },

  // い — the two strokes ARE two eels swimming side by side.
  い: {
    glyph: "い",
    romaji: "i",
    sound: "ee",
    ipa: "/i/ · ee",
    object: "two eels",
    analogy: { lead: "Say it like the ", sound: "ee", tail: " in feet — the same sound as eel." },
    mnemonic: {
      lead: "Each of the two strokes is an ",
      sound: "eel",
      tail: " swimming — a long one diving on the left, a shorter one on the right. Put an eye at the top of each and you can’t unsee them.",
    },
    svg: `<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.5,29.66c2.01,2.17,2.61,4.68,2.17,7.43c-3.09,19.16-1.03,32.01,7.93,41.45c6.12,6.45,6.26,3.14,7.04-5.21" ${FEAT}/>
      <path d="M72.96,36.51c9.44,8.05,17.79,18.82,18.41,33.83" ${FEAT}/>
      <circle cx="23.5" cy="31.5" r="2.4" ${DOT}/>
      <circle cx="74.5" cy="39.5" r="2.4" ${DOT}/>
      <path d="M38,73 l6,-2 M91,70 l5,3" ${ADD}/>
      <path d="M8,95 q7,-4 13,0 t13,0 t13,0 t13,0 t13,0 t13,0" ${FAINT}/>
    </svg>`,
    example: { word: "いぬ", reading: "inu", gloss: "dog", hitIndex: 0 },
    approximate: "A clean fit, sound and shape both. Short here; a doubled いい just holds it longer.",
  },

  // う — the long sweeping stroke is a goose's neck and body.
  う: {
    glyph: "う",
    romaji: "u",
    sound: "oo",
    ipa: "/ɯ/ · oo",
    object: "goose",
    analogy: {
      lead: "Say it like the ",
      sound: "oo",
      tail: " in goose — but keep your lips unrounded.",
    },
    mnemonic: {
      lead: "The long sweeping stroke is a ",
      sound: "goose",
      tail: "’s neck and body; the small top stroke is its head — add an eye and a beak.",
    },
    svg: `<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg">
      <path d="M42,15.5c5.62,2.12,9.62,3,12.88,3c8.27,0,8,1.12-0.38,5.5" ${BASE}/>
      <path d="M33,42.38c2.12,1.12,4.12,2.88,8.5,1.38c4.38-1.5,12.75-7.12,18.5-7c5.75,0.12,10.25,5,10.25,18c0,15.49-8.25,30.24-24.37,41.24" ${FEAT}/>
      <circle cx="49" cy="18" r="2.3" ${DOT}/>
      <path d="M41,17 l-7,-1 l6,4" ${ADD}/>
    </svg>`,
    example: { word: "うみ", reading: "umi", gloss: "sea", hitIndex: 0 },
    approximate: "Japanese う is flatter than English “oo” — don’t purse your lips. Trust the 🔊 clip.",
  },

  // え — the long bottom stroke sweeping right is an elephant's trunk.
  え: {
    glyph: "え",
    romaji: "e",
    sound: "e",
    ipa: "/e/ · eh",
    object: "elephant",
    analogy: { lead: "Say it like the ", sound: "e", tail: " in bed — short and forward." },
    mnemonic: {
      lead: "The long bottom stroke that sweeps out to the right is the trunk of an ",
      sound: "elephant",
      tail: ", lifting at the tip; the top tick is the eye, the little arc a floppy ear.",
    },
    svg: `<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg">
      <path d="M40.52,13.25c5.62,2.12,10,3,14.12,3c8.27,0,8,1.12-0.38,5.5" ${BASE}/>
      <path d="M32.52,45.12c1.88,1.25,4.5,1.75,7.38,0.62c3.29-1.29,17-7.88,21.25-9.88c4.25-2,8.32,0.04,4.38,4.62c-12.26,14.27-27.26,31.52-39.51,44.4c-3.26,3.42-0.58,3.54,1.5,1.37c13.5-14.12,18.12-20.12,23.62-20.12c7.13,0,3.5,16.75,6.75,22.38c3.25,5.63,19.12,3.75,26.12,2.12" ${FEAT}/>
      <circle cx="49" cy="15" r="2.3" ${DOT}/>
      <path d="M52,40 q13,-3 12,14" ${ADD}/>
      <path d="M89,80 l6,-2" ${ADD}/>
    </svg>`,
    example: { word: "えき", reading: "eki", gloss: "station", hitIndex: 0 },
    approximate: "No glide — it’s “eh,” never “ay.” Match the 🔊 clip’s flat vowel.",
  },

  // お — the looping bottom stroke is a leg mid-kick; the stray stroke is the ball.
  お: {
    glyph: "お",
    romaji: "o",
    sound: "o",
    ipa: "/o/ · oh",
    object: "kicking a ball",
    analogy: { lead: "Say it like the ", sound: "o", tail: " in oat — a clean “oh.”" },
    mnemonic: {
      lead: "The looping bottom-left stroke is a leg mid-kick and the stray upper-right stroke is the ball sailing off — “",
      sound: "oh",
      tail: "! — what a goal.”",
    },
    svg: `<svg viewBox="0 0 109 109" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.88,35.12c1.38,1,3.62,2.38,6,2.12c2.38-0.26,19.62-5.12,21.12-5.74c1.5-0.62,4-1.25,5.88-2" ${BASE}/>
      <path d="M41.5,16.12c2.25,1,3.59,4.39,3.12,7.38c-2.5,16.12-3.37,45.53-2.25,58.38c0.75,8.62-0.64,10.45-7.12,7.12c-5.13-2.62-13.75-8-13.75-12.38c0-7.5,24.38-23.62,44.75-23.62c17.25,0,25,8.25,25,17.25c0,8.25-9.38,18.88-26.75,21" ${BASE}/>
      <circle cx="80" cy="27" r="8" ${FEAT}/>
      <path d="M73,22.12c5.38,2.62,8.88,5.88,10.62,8.25" ${FEAT}/>
      <path d="M64,20 l-8,-3 M66,29 l-9,-1 M63,37 l-8,2" ${ADD}/>
    </svg>`,
    example: { word: "おと", reading: "oto", gloss: "sound", hitIndex: 0 },
    approximate: "Short and pure, no “oh-w” glide at the end. The 🔊 clip is the ruler.",
  },
};

/**
 * The mnemonic for a glyph, or `null` when there is none. This is the whole of
 * the hide-when-absent rule: both call sites render the card only when this
 * returns non-null, so a kana with no entry shows nothing at all — no
 * placeholder, no empty box. Works for any glyph, kana or (later) kanji.
 */
export function getMnemonic(glyph: MnemonicKey): Mnemonic | null {
  return MNEMONICS[glyph] ?? null;
}
