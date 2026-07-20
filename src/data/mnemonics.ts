// In-app kana mnemonics — the app's OWN hooks, replacing the outbound
// Tofugu/WaniKani links.
//
// WHAT THIS FILE IS
// =================
// A pure data table, keyed by the character it teaches. It holds the words and
// (when one exists) a drawn picture; it renders nothing. `MnemonicView`
// (components/lesson/mnemonic-view.tsx) is the one place it turns into pixels,
// and two call sites (the lesson walk-through, via
// components/lesson/lesson-item-view.tsx, and the Library entry page) gate on
// `getMnemonic` returning non-null. A kana with no row here shows no block —
// see the hide-when-absent rule in MnemonicView.
//
// ADDING A ROW IS APPENDING AN ENTRY, AND NOTHING ELSE
// ====================================================
// The key is the glyph, so `MnemonicKey = string`. It is deliberately NOT
// "kana-only" anywhere: a kanji glyph ("生") is a valid key the day someone
// authors one, with zero code change here or at either call site. To author a
// new mnemonic, append to MNEMONICS.
//
// THE PICTURE, OR THE GLYPH
// =========================
// The slot on the card shows an `image` when the entry has one — a real drawn
// picture of the object, keyed by romaji under /public/mnemonics — and falls
// back to the plain glyph as a placeholder when it doesn't. The picture is a
// CONSTANT: it sits on a fixed light tile in the card so it reads the same in
// every theme regardless of its own background/transparency.
//
// The `image` is NOT authored on the entry below. `getMnemonic` DERIVES it for
// every kana from the entry's own romaji AND the glyph's SCRIPT — the candidate
// path /mnemonics/<script>/<romaji>.webp, where <script> is "hiragana" or
// "katakana" (see `kanaScript`). Splitting by script is what keeps か and カ,
// which share the romaji "ka", from colliding on one filename: they land in
// /mnemonics/hiragana/ka.webp and /mnemonics/katakana/ka.webp. Every entry
// authored today is hiragana except カ, whose original no-wind karate drawing
// now lives at /mnemonics/katakana/ka.webp. A glyph that is neither kana (a
// future kanji) has no script folder, so it falls back to the flat
// /mnemonics/<romaji>.webp.
//
// It's a candidate: the file may or may not exist. The renderers load it and
// fall back to the plain glyph if it 404s, so a kana shows its drawing when the
// webp is present and the character when it isn't — no registry, no fs check.
// The owner adds a drawing by dropping <romaji>.webp into
// public/mnemonics/<script>/ (or a transparent PNG named <romaji>.png into
// ~/Downloads/kana/<script>/ and running `pnpm mnemonic-images`, which optimizes
// it to that webp). No edit to this table or its test — the romaji and the
// glyph's script already name the file.
//
// THE ACCENT COLOUR IS RESERVED FOR THE SOUND — WHEREVER IT IS SPOKEN
// ==================================================================
// This is the rule the shape of `SoundLine` exists to serve. When a span is
// accented, that span carries the KANA'S SOUND — never a word that describes
// the drawing. The first draft of this content underlined "loop" for あ; "loop"
// sounds like "oo" and あ is "ah", so that accent was a lie the reader's ear had
// to fight. A `SoundLine` is now an ordered array of `SoundSpan`s, and an
// accent lands on EVERY span the sound is actually PRONOUNCED in — the standalone
// phonetic cue ("ah"), the sound inside a reference word (the "a" in f·a·ther,
// split out as its own accented span), and a voiced exclamation of it ("ahhh").
// A span whose letters merely LOOK like the kana but sound different (capital A =
// "ay", the schwa in "acrobat") is left plain. A line with no sound to accent
// carries no accent span at all — a shape word is never a consolation highlight.
// mnemonics.test.ts holds the line: every analogy has at least one accent span
// whose text contains the entry's own accented sound token.
//
// APPROVED vs DRAFT
// =================
// あ–そ (the vowels, K row, S row) are owner-approved. た–ん carry `draft: true`
// — same voice, first-draft hooks that lean harder on the sound where the shape
// is busy. The 🔊 clip in-app is always the source of truth for the exact sound.

/** The glyph a mnemonic teaches. A string, so kanji slot in later unchanged. */
export type MnemonicKey = string;

/**
 * One run of a line: a piece of text, accented or not. `accent: true` paints it
 * in the accent colour — and the accent colour is reserved for the sound, so an
 * accented span is one the kana's pronunciation is actually spoken in. A plain
 * span (no `accent`, or `accent: false`) is ordinary prose. Never author an
 * empty-text span.
 */
export interface SoundSpan {
  /** The text of this run. Always non-empty. */
  text: string;
  /**
   * `true` to render this run in the accent colour, meaning its letters are
   * PRONOUNCED as the kana's sound. Omit (or `false`) for ordinary prose — a
   * span that merely looks like the kana but sounds different stays plain.
   */
  accent?: boolean;
  /**
   * When present, this run is a LINK to `href` — rendered as an anchor opening
   * in a new tab. It exists because for a few kana the honest answer is to
   * point at a real explanation: ら's r-sound has no English equivalent, so the
   * prose sends the reader to a guide rather than pretending an analogy works.
   * A span may be BOTH `accent` and `href` — a linked run that is also spoken
   * as the sound keeps the accent colour and becomes a link.
   */
  href?: string;
}

/**
 * A line of prose as an ordered array of spans. The accent colour lands on
 * EVERY span the sound is pronounced in — the phonetic cue, each in-word
 * instance (e.g. the "a" in f·a·ther split out as its own span), and any voiced
 * exclamation of it — and never on a shape word. A line with no sound to accent
 * is simply all-plain spans (or a single plain span). Invariant (see
 * mnemonics.test.ts): every analogy carries at least one accent span whose text
 * contains the entry's accented sound token (`Mnemonic.sound`), case-insensitively.
 */
export type SoundLine = SoundSpan[];

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

/** One kana's mnemonic: the hooks, the picture, and a word that proves it. */
export interface Mnemonic {
  /** The glyph, e.g. "あ". Matches its key in MNEMONICS. */
  glyph: string;
  /** Romaji reading, e.g. "a". */
  romaji: string;
  /**
   * The accented SOUND token — the English sound the analogy calls out and the
   * one the accent colour is reserved for, e.g. "ee" for い. The analogy always
   * carries an accent span whose text contains this token (enforced by test);
   * it stays the invariant anchor across every re-segmentation of the prose.
   */
  sound: string;
  /** Optional IPA / spelled-out sound shown under the reading, e.g. "/a/ · ah". */
  ipa?: string;
  /** What the drawing depicts, e.g. "anchor". Shown as a small tag. */
  object?: string;
  /**
   * The "say it like the X in Y" hook, as a span array. Accents every span the
   * sound is spoken in (the cue and each in-word instance). This line always
   * carries at least one accent span — an analogy with none would not be one.
   * Rendered SECONDARY: muted and slightly smaller than the mnemonic below.
   */
  analogy: SoundLine;
  /**
   * The shape→picture hook: the one-scene story, as a span array, with the sound
   * accented wherever it is pronounced. MAY carry zero accent spans when the
   * story's words name only the shape and none is spoken as the sound. This is
   * the memory hook, so it is rendered PROMINENT — full text colour, comfortable
   * size — and the analogy is the muted secondary line.
   */
  mnemonic: SoundLine;
  /**
   * The candidate path to a drawn picture of the object, served from
   * /public/mnemonics and keyed by the glyph's SCRIPT + romaji (e.g.
   * "/mnemonics/hiragana/a.webp"). NOT authored on the entry: `getMnemonic`
   * derives it for every kana from the entry's romaji and the glyph's script
   * (see `kanaScript`), so it is always present on a returned Mnemonic. It is a
   * CANDIDATE — the file may not exist. The renderers load it and fall back to
   * the plain glyph on error, which is how a kana with no drawing shows its
   * character. The picture is theme-agnostic — the card mounts it on a fixed
   * light tile — so its own background/transparency doesn't matter.
   */
  image?: string;
  /** A real beginner word with the kana highlighted. */
  example: MnemonicExample;
  /**
   * An honest phonetic flag — where English only gets close and the 🔊 clip is
   * the real answer (う is the loudest case: un-rounded, "trust the 🔊").
   * Rendered muted; omitted when there's nothing to caveat.
   */
  approximate?: string;
  /**
   * First-draft content flag. `true` on た–ん, whose hooks are first-draft and
   * lean harder on the sound where the shape is busy. Absent (approved) on
   * あ–そ. Purely advisory metadata; the card renders draft and approved rows
   * identically.
   */
  draft?: boolean;
}

/**
 * The table. Keyed by glyph — appending an entry is the whole of authoring a
 * mnemonic. All 46 base hiragana. あ–そ are owner-approved; た–ん carry
 * `draft: true`. No entry carries an `image` — `getMnemonic` derives the
 * candidate /mnemonics/<script>/<romaji>.webp path, and the renderers fall back
 * to the glyph when that file is absent, so the character shows until one is
 * drawn.
 */
export const MNEMONICS: Record<MnemonicKey, Mnemonic> = {
  // ---- Vowels — あ い う え お (APPROVED) --------------------------------
  あ: {
    glyph: "あ",
    romaji: "a",
    sound: "ah",
    ipa: "/a/ · ah",
    object: "father",
    analogy: [
      { text: "Say the open " },
      { text: "ah", accent: true },
      { text: " in f" },
      { text: "a", accent: true },
      { text: "ther." },
    ],
    mnemonic: [
      { text: "An acrobat tumbles through her aerials while her f" },
      { text: "a", accent: true },
      { text: "ther watches, mouth open, and claps saying “ooooh, " },
      { text: "ahhh", accent: true },
      { text: "!”" },
    ],
    example: { word: "あめ", reading: "ame", gloss: "rain", hitIndex: 0 },
  },

  い: {
    glyph: "い",
    romaji: "i",
    sound: "ee",
    ipa: "/i/ · ee",
    object: "two eels",
    analogy: [
      { text: "Say the " },
      { text: "ee", accent: true },
      { text: " in f" },
      { text: "ee", accent: true },
      { text: "t." },
    ],
    mnemonic: [
      { text: "Two " },
      { text: "ee", accent: true },
      { text: "ls tear up the river neck-and-neck, one long, one stubby, scr" },
      { text: "ee", accent: true },
      { text: "ching a thin “" },
      { text: "eee", accent: true },
      { text: "!”" },
    ],
    example: { word: "いぬ", reading: "inu", gloss: "dog", hitIndex: 0 },
  },

  う: {
    glyph: "う",
    romaji: "u",
    sound: "oo",
    ipa: "/ɯ/ · oo",
    object: "u in the bath",
    analogy: [
      { text: "Say the " },
      { text: "oo", accent: true },
      { text: " in moon (lips relaxed)." },
    ],
    mnemonic: [
      { text: "A tired letter u sinks into a hot bath and sighs “" },
      { text: "oooh", accent: true },
      { text: ".”" },
    ],
    example: { word: "うみ", reading: "umi", gloss: "sea", hitIndex: 0 },
    approximate: "Japanese う is flatter than English “oo”. Don’t purse your lips.",
  },

  え: {
    glyph: "え",
    romaji: "e",
    sound: "eh",
    ipa: "/e/ · eh",
    object: "bird from an egg",
    analogy: [
      { text: "Say the " },
      { text: "eh", accent: true },
      { text: " in " },
      { text: "e", accent: true },
      { text: "gg." },
    ],
    mnemonic: [
      { text: "A bird cracks out of a speckled " },
      { text: "e", accent: true },
      { text: "gg and squawks “" },
      { text: "ehh", accent: true },
      { text: "!”" },
    ],
    example: { word: "えき", reading: "eki", gloss: "station", hitIndex: 0 },
    approximate: "No glide. It’s “eh,” not “ay.”",
  },

  お: {
    glyph: "お",
    romaji: "o",
    sound: "oh",
    ipa: "/o/ · oh",
    object: "wide eyes",
    analogy: [
      { text: "Say the " },
      { text: "oh", accent: true },
      { text: " in " },
      { text: "o", accent: true },
      { text: "at." },
    ],
    mnemonic: [
      { text: "Two eyes go round as " },
      { text: "O", accent: true },
      { text: "s at the fireworks. You hear an amazed “" },
      { text: "oh", accent: true },
      { text: "!” from the crowd." },
    ],
    example: { word: "おと", reading: "oto", gloss: "sound", hitIndex: 0 },
    approximate: "Short and pure, no “oh-w” glide at the end.",
  },

  // ---- K row — か き く け こ (APPROVED) --------------------------------
  か: {
    glyph: "か",
    romaji: "ka",
    sound: "ka",
    object: "karate kick",
    analogy: [
      { text: "Say “" },
      { text: "ka", accent: true },
      { text: "” as in " },
      { text: "ka", accent: true },
      { text: "rate." },
    ],
    mnemonic: [
      { text: "A black belt shouts “" },
      { text: "ka", accent: true },
      { text: "!” as his " },
      { text: "ka", accent: true },
      { text: "rate kick sends a gust curling beside his knee." },
    ],
    example: { word: "かさ", reading: "kasa", gloss: "umbrella", hitIndex: 0 },
  },

  // The same kick without か's separate wind stroke teaches angular カ.
  カ: {
    glyph: "カ",
    romaji: "ka",
    sound: "ka",
    object: "karateka",
    analogy: [
      { text: "Say “" },
      { text: "ka", accent: true },
      { text: "” as in " },
      { text: "ka", accent: true },
      { text: "rate." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ka", accent: true },
      { text: "rate" },
      { text: "ka", accent: true },
      { text: " snaps up one knee and delivers a powerful " },
      { text: "ka", accent: true },
      { text: "rate kick." },
    ],
    example: { word: "カメラ", reading: "kamera", gloss: "camera", hitIndex: 0 },
  },

  き: {
    glyph: "き",
    romaji: "ki",
    sound: "kee",
    object: "key",
    analogy: [
      { text: "Say “" },
      { text: "kee", accent: true },
      { text: "” like " },
      { text: "key", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A two-toothed key jams a rusty lock and screeches “" },
      { text: "kee", accent: true },
      { text: "!”" },
    ],
    example: { word: "き", reading: "ki", gloss: "tree", hitIndex: 0 },
  },

  く: {
    glyph: "く",
    romaji: "ku",
    sound: "ku",
    object: "cuckoo",
    analogy: [
      { text: "Say “" },
      { text: "ku", accent: true },
      { text: "” as in " },
      { text: "cu", accent: true },
      { text: "c" },
      { text: "koo", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "cu", accent: true },
      { text: "c" },
      { text: "koo", accent: true },
      { text: " explodes from the clock, beak open wide yelling “" },
      { text: "ku", accent: true },
      { text: "! " },
      { text: "ku", accent: true },
      { text: "!”" },
    ],
    example: { word: "くち", reading: "kuchi", gloss: "mouth", hitIndex: 0 },
  },

  け: {
    glyph: "け",
    romaji: "ke",
    sound: "keh",
    object: "kelp",
    analogy: [
      { text: "Say “" },
      { text: "keh", accent: true },
      { text: "” as in " },
      { text: "ke", accent: true },
      { text: "lp." },
    ],
    mnemonic: [
      { text: "Two ribbons of " },
      { text: "ke", accent: true },
      { text: "lp sway in the tide, leaning and parting." },
    ],
    example: { word: "けさ", reading: "kesa", gloss: "this morning", hitIndex: 0 },
  },

  こ: {
    glyph: "こ",
    romaji: "ko",
    sound: "koh",
    object: "cobra",
    analogy: [
      { text: "Say “" },
      { text: "koh", accent: true },
      { text: "” as in " },
      { text: "co", accent: true },
      { text: "bra." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "co", accent: true },
      { text: "bra coiled twice, one loop stacked above the other." },
    ],
    example: { word: "こえ", reading: "koe", gloss: "voice", hitIndex: 0 },
  },

  // ---- S row — さ し す せ そ (APPROVED) --------------------------------
  さ: {
    glyph: "さ",
    romaji: "sa",
    sound: "sah",
    object: "sardine",
    analogy: [
      { text: "Say “" },
      { text: "sah", accent: true },
      { text: "” as in " },
      { text: "sa", accent: true },
      { text: "rdine." },
    ],
    mnemonic: [
      { text: "A fat " },
      { text: "sa", accent: true },
      { text: "rdine dangles off the fishing line, body arched, tail flicking." },
    ],
    example: { word: "さかな", reading: "sakana", gloss: "fish", hitIndex: 0 },
  },

  し: {
    glyph: "し",
    romaji: "shi",
    sound: "shee",
    object: "shepherd’s crook",
    analogy: [
      { text: "Say “" },
      { text: "shee", accent: true },
      { text: "” as in " },
      { text: "shee", accent: true },
      { text: "p." },
    ],
    mnemonic: [
      { text: "A shepherd’s crook reaches out to hook a stray " },
      { text: "shee", accent: true },
      { text: "p as " },
      { text: "she", accent: true },
      { text: " yells “come back " },
      { text: "shee", accent: true },
      { text: "p!!”" },
    ],
    example: { word: "しろ", reading: "shiro", gloss: "white", hitIndex: 0 },
  },

  す: {
    glyph: "す",
    romaji: "su",
    sound: "sue",
    object: "soup",
    analogy: [
      { text: "Say “" },
      { text: "sue", accent: true },
      { text: "” as in " },
      { text: "sou", accent: true },
      { text: "p." },
    ],
    mnemonic: [
      { text: "A bowl of " },
      { text: "sou", accent: true },
      { text: "p, a curl of steam rising off the top." },
    ],
    example: { word: "すし", reading: "sushi", gloss: "sushi", hitIndex: 0 },
  },

  せ: {
    glyph: "せ",
    romaji: "se",
    sound: "seh",
    object: "seesaw",
    analogy: [
      { text: "Say “" },
      { text: "seh", accent: true },
      { text: "” as in " },
      { text: "se", accent: true },
      { text: "ven." },
    ],
    mnemonic: [
      { text: "Se", accent: true },
      { text: "ven kids " },
      { text: "se", accent: true },
      { text: "ttle onto the seesaw and it tips, a plank across the middle with one seat flung high." },
    ],
    example: { word: "せかい", reading: "sekai", gloss: "world", hitIndex: 0 },
  },

  そ: {
    glyph: "そ",
    romaji: "so",
    sound: "so",
    object: "sewing",
    analogy: [
      { text: "Say “" },
      { text: "so", accent: true },
      { text: "” like " },
      { text: "sew", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A needle " },
      { text: "sew", accent: true },
      { text: "s a zig-zag stitch." },
    ],
    example: { word: "そら", reading: "sora", gloss: "sky", hitIndex: 0 },
  },

  // ---- T row — た ち つ て と (DRAFT) -----------------------------------
  た: {
    glyph: "た",
    romaji: "ta",
    sound: "tah",
    object: "ta-da!",
    analogy: [
      { text: "Say “" },
      { text: "tah", accent: true },
      { text: "” as in " },
      { text: "ta", accent: true },
      { text: "-da." },
    ],
    mnemonic: [
      { text: "Arms and legs flung wide, the performer lands the big finish: “" },
      { text: "ta", accent: true },
      { text: "-da!”" },
    ],
    example: { word: "たまご", reading: "tamago", gloss: "egg", hitIndex: 0 },
    draft: true,
  },

  ち: {
    glyph: "ち",
    romaji: "chi",
    sound: "chee",
    object: "a wheel of cheese",
    analogy: [
      { text: "Say “" },
      { text: "chee", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A big wheel of " },
      { text: "chee", accent: true },
      { text: "se with a wedge cut out: ち." },
    ],
    example: { word: "ちず", reading: "chizu", gloss: "map", hitIndex: 0 },
    draft: true,
  },

  つ: {
    glyph: "つ",
    romaji: "tsu",
    sound: "tsu",
    object: "tsunami",
    analogy: [
      { text: "Say “" },
      { text: "tsu", accent: true },
      { text: "” as in " },
      { text: "tsu", accent: true },
      { text: "nami. This is a t+s as one sound." },
    ],
    mnemonic: [
      { text: "A single " },
      { text: "tsu", accent: true },
      { text: "nami curls its crest and sweeps over." },
    ],
    example: { word: "つき", reading: "tsuki", gloss: "moon", hitIndex: 0 },
    approximate: "One sound: t and s pressed together, not “t” then “sue.”",
    draft: true,
  },

  て: {
    glyph: "て",
    romaji: "te",
    sound: "teh",
    object: "telephone pole",
    analogy: [
      { text: "Say “" },
      { text: "teh", accent: true },
      { text: "” as in " },
      { text: "te", accent: true },
      { text: "lephone." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "te", accent: true },
      { text: "lephone pole with one crossbar hums in the wind." },
    ],
    example: { word: "てがみ", reading: "tegami", gloss: "letter", hitIndex: 0 },
    draft: true,
  },

  と: {
    glyph: "と",
    romaji: "to",
    sound: "toh",
    object: "stubbed toe",
    analogy: [
      { text: "Say “" },
      { text: "toh", accent: true },
      { text: "” like " },
      { text: "toe", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A thorn jabs the " },
      { text: "toe", accent: true },
      { text: " one long foot, one sharp splinter crossing it." },
    ],
    example: { word: "とり", reading: "tori", gloss: "bird", hitIndex: 0 },
    draft: true,
  },

  // ---- N row — な に ぬ ね の (DRAFT) -----------------------------------
  な: {
    glyph: "な",
    romaji: "na",
    sound: "nah",
    object: "nachos",
    analogy: [
      { text: "Say “" },
      { text: "nah", accent: true },
      { text: "” as in " },
      { text: "na", accent: true },
      { text: "chos." },
    ],
    mnemonic: [
      { text: "A plate of " },
      { text: "na", accent: true },
      { text: "chos, piled high with ingredients. You say “" },
      { text: "nah, nah", accent: true },
      { text: ", I can’t eat anymore” but then you do anyway." },
    ],
    example: { word: "なつ", reading: "natsu", gloss: "summer", hitIndex: 0 },
    draft: true,
  },

  に: {
    glyph: "に",
    romaji: "ni",
    sound: "nee",
    object: "needle and thread",
    analogy: [
      { text: "Say “" },
      { text: "nee", accent: true },
      { text: "” as in " },
      { text: "nee", accent: true },
      { text: "dle." },
    ],
    mnemonic: [
      { text: "A tall threaded " },
      { text: "nee", accent: true },
      { text: "dle standing upright, two " },
      { text: "nea", accent: true },
      { text: "t stitches sewn in beside it." },
    ],
    example: { word: "にく", reading: "niku", gloss: "meat", hitIndex: 0 },
    draft: true,
  },

  ぬ: {
    glyph: "ぬ",
    romaji: "nu",
    sound: "noo",
    object: "noodles",
    analogy: [
      { text: "Say “" },
      { text: "noo", accent: true },
      { text: "” as in " },
      { text: "noo", accent: true },
      { text: "dles." },
    ],
    mnemonic: [
      { text: "Twirl the " },
      { text: "noo", accent: true },
      { text: "dles up off the bowl, one big looping slurp." },
    ],
    example: { word: "ぬの", reading: "nuno", gloss: "cloth", hitIndex: 0 },
    draft: true,
  },

  ね: {
    glyph: "ね",
    romaji: "ne",
    sound: "neh",
    object: "Nelly the cat",
    analogy: [
      { text: "Say “" },
      { text: "neh", accent: true },
      { text: "” as in " },
      { text: "Ne", accent: true },
      { text: "lly." },
    ],
    mnemonic: [
      { text: "Ne", accent: true },
      { text: "lly the cat stretching her back up high." },
    ],
    example: { word: "ねこ", reading: "neko", gloss: "cat", hitIndex: 0 },
    draft: true,
  },

  の: {
    glyph: "の",
    romaji: "no",
    sound: "noh",
    object: "nose",
    analogy: [
      { text: "Say “" },
      { text: "noh", accent: true },
      { text: "” as in " },
      { text: "no", accent: true },
      { text: "se." },
    ],
    mnemonic: [
      { text: "A pig’s " },
      { text: "no", accent: true },
      { text: "se with some mud on it after it had a nice afternoon outside." },
    ],
    example: { word: "のり", reading: "nori", gloss: "seaweed", hitIndex: 0 },
    draft: true,
  },

  // ---- H row — は ひ ふ へ ほ (DRAFT) -----------------------------------
  は: {
    glyph: "は",
    romaji: "ha",
    sound: "ha",
    object: "ha! ha! ha!",
    analogy: [
      { text: "Say “" },
      { text: "ha", accent: true },
      { text: "” as in " },
      { text: "ha! ha! ha!", accent: true },
    ],
    mnemonic: [
      { text: "Throw your head back and laugh, “" },
      { text: "ha-ha-ha", accent: true },
      { text: "!” It even looks like " },
      { text: "ha", accent: true },
      { text: "." },
    ],
    example: { word: "はな", reading: "hana", gloss: "flower", hitIndex: 0 },
    draft: true,
  },

  ひ: {
    glyph: "ひ",
    romaji: "hi",
    sound: "he",
    object: "heel",
    analogy: [
      { text: "Say “" },
      { text: "he", accent: true },
      { text: "” as in " },
      { text: "hee", accent: true },
      { text: "l." },
    ],
    mnemonic: [
      { text: "A bare foot, the " },
      { text: "hee", accent: true },
      { text: "l juts out at the bottom." },
    ],
    example: { word: "ひと", reading: "hito", gloss: "person", hitIndex: 0 },
    draft: true,
  },

  ふ: {
    glyph: "ふ",
    romaji: "fu",
    sound: "fu",
    object: "Mount Fuji",
    analogy: [
      { text: "A soft " },
      { text: "fu", accent: true },
      { text: " as in " },
      { text: "Fu", accent: true },
      { text: "ji." },
    ],
    mnemonic: [
      { text: "A windy road climbing up the peak of Mount " },
      { text: "Fu", accent: true },
      { text: "ji, clouds drifting all around it." },
    ],
    example: { word: "ふね", reading: "fune", gloss: "boat", hitIndex: 0 },
    approximate: "Not a hard English “f”, but a soft breath between f and h.",
    draft: true,
  },

  へ: {
    glyph: "へ",
    romaji: "he",
    sound: "heh",
    object: "Mount St. Helens",
    analogy: [
      { text: "Say “" },
      { text: "heh", accent: true },
      { text: "” as in " },
      { text: "He", accent: true },
      { text: "lens." },
    ],
    mnemonic: [
      { text: "A single mountain peak, Mount St. " },
      { text: "He", accent: true },
      { text: "lens, high in the sky covered in clouds." },
    ],
    example: { word: "へや", reading: "heya", gloss: "room", hitIndex: 0 },
    draft: true,
  },

  ほ: {
    glyph: "ほ",
    romaji: "ho",
    sound: "ho",
    object: "home",
    analogy: [
      { text: "Say “" },
      { text: "ho", accent: true },
      { text: "” as in " },
      { text: "ho", accent: true },
      { text: "me." },
    ],
    mnemonic: [
      { text: "A little " },
      { text: "ho", accent: true },
      { text: "me with a wall and a chimney." },
    ],
    example: { word: "ほし", reading: "hoshi", gloss: "star", hitIndex: 0 },
    draft: true,
  },

  // ---- M row — ま み む め も (DRAFT) -----------------------------------
  ま: {
    glyph: "ま",
    romaji: "ma",
    sound: "mah",
    object: "mama",
    analogy: [
      { text: "Say “" },
      { text: "mah", accent: true },
      { text: "” as in " },
      { text: "mama", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "Mama", accent: true },
      { text: " standing arms out wide, baby running towards hard arms out wide running into " },
      { text: "mama", accent: true },
      { text: "’s arms." },
    ],
    example: { word: "まど", reading: "mado", gloss: "window", hitIndex: 0 },
    draft: true,
  },

  み: {
    glyph: "み",
    romaji: "mi",
    sound: "me",
    object: "musical note, mi",
    analogy: [
      { text: "Say “" },
      { text: "me", accent: true },
      { text: "” as in do, re, " },
      { text: "mi", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A musical note: the " },
      { text: "mi", accent: true },
      { text: " in do-re-mi." },
    ],
    example: { word: "みみ", reading: "mimi", gloss: "ear", hitIndex: 0 },
    draft: true,
  },

  む: {
    glyph: "む",
    romaji: "mu",
    sound: "moo",
    object: "cow",
    analogy: [
      { text: "Say “" },
      { text: "moo", accent: true },
      { text: "” like a cow’s " },
      { text: "mooooo", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A cow swishes its tail in a pasture and bellows, “" },
      { text: "mooooo", accent: true },
      { text: "!”" },
    ],
    example: { word: "むし", reading: "mushi", gloss: "insect", hitIndex: 0 },
    draft: true,
  },

  め: {
    glyph: "め",
    romaji: "me",
    sound: "meh",
    object: "eye",
    analogy: [
      { text: "Say “" },
      { text: "meh", accent: true },
      { text: "” as in " },
      { text: "me", accent: true },
      { text: "lon." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "me", accent: true },
      { text: "lon-round eye winks up at you, lid and lashes heavy with make-up. め even means “eye”!" },
    ],
    example: { word: "め", reading: "me", gloss: "eye", hitIndex: 0 },
    draft: true,
  },

  も: {
    glyph: "も",
    romaji: "mo",
    sound: "mo",
    object: "fishhook with worms",
    analogy: [
      { text: "Say “" },
      { text: "mo", accent: true },
      { text: "” as in " },
      { text: "mo", accent: true },
      { text: "re." },
    ],
    mnemonic: [
      { text: "A fishhook with two worms; the " },
      { text: "mo", accent: true },
      { text: "re worms, the " },
      { text: "mo", accent: true },
      { text: "re fish!" },
    ],
    example: { word: "もり", reading: "mori", gloss: "forest", hitIndex: 0 },
    draft: true,
  },

  // ---- Y row — や ゆ よ (DRAFT) -----------------------------------------
  や: {
    glyph: "や",
    romaji: "ya",
    sound: "ya",
    object: "a yacht",
    analogy: [
      { text: "Say " },
      { text: "ya", accent: true },
      { text: " as in " },
      { text: "ya", accent: true },
      { text: "cht." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ya", accent: true },
      { text: "cht, mast up and sail full, swaying in the wind." },
    ],
    example: { word: "やま", reading: "yama", gloss: "mountain", hitIndex: 0 },
    draft: true,
  },

  ゆ: {
    glyph: "ゆ",
    romaji: "yu",
    sound: "yoo",
    object: "unique fish",
    analogy: [
      { text: "Say " },
      { text: "yoo", accent: true },
      { text: " as in " },
      { text: "u", accent: true },
      { text: "nique." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "u", accent: true },
      { text: "nique " },
      { text: "eu", accent: true },
      { text: "lachon fish named " },
      { text: "Yu", accent: true },
      { text: "ni, its long tail swaying in the water." },
    ],
    example: { word: "ゆき", reading: "yuki", gloss: "snow", hitIndex: 0 },
    draft: true,
  },

  よ: {
    glyph: "よ",
    romaji: "yo",
    sound: "yo",
    object: "“yo”",
    analogy: [
      { text: "Say " },
      { text: "yo", accent: true },
      { text: " like " },
      { text: "yo-yo", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "yo-yo", accent: true },
      { text: " bobbing up and down. It even reads like the word " },
      { text: "yo", accent: true },
      { text: "." },
    ],
    example: { word: "よる", reading: "yoru", gloss: "night", hitIndex: 0 },
    draft: true,
  },

  // ---- R row — ら り る れ ろ (DRAFT — a single soft TAP, between r/l/d) --
  ら: {
    glyph: "ら",
    romaji: "ra",
    sound: "ra",
    object: "rabbit",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "ra", accent: true },
      { text: "bbit." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ra", accent: true },
      { text: "bbit sits up, ears pricked forward looking at a barrel of " },
      { text: "ra", accent: true },
      { text: "dishes excitedly." },
    ],
    example: { word: "さくら", reading: "sakura", gloss: "cherry blossom", hitIndex: 2 },
    approximate: "A single soft tap of the tongue, not a hard English “r.”",
    draft: true,
  },

  り: {
    glyph: "り",
    romaji: "ri",
    sound: "ree",
    object: "reeds",
    analogy: [
      { text: "Say “" },
      { text: "ree", accent: true },
      { text: "” as in " },
      { text: "ree", accent: true },
      { text: "ds." },
    ],
    mnemonic: [
      { text: "Two " },
      { text: "ree", accent: true },
      { text: "ds swaying happily in the b" },
      { text: "ree", accent: true },
      { text: "zy autumn wind, " },
      { text: "rea", accent: true },
      { text: "lly soaking in some afternoon sun." },
    ],
    example: { word: "りんご", reading: "ringo", gloss: "apple", hitIndex: 0 },
    approximate: "A single soft tap of the tongue, not a hard English “r.”",
    draft: true,
  },

  る: {
    glyph: "る",
    romaji: "ru",
    sound: "roo",
    object: "looping route",
    analogy: [
      { text: "Say “" },
      { text: "roo", accent: true },
      { text: "” like " },
      { text: "rou", accent: true },
      { text: "te." },
    ],
    mnemonic: [
      { text: "The " },
      { text: "rou", accent: true },
      { text: "te drops down and curls into a loop." },
    ],
    example: { word: "くるま", reading: "kuruma", gloss: "car", hitIndex: 1 },
    approximate: "A single soft tap of the tongue, not a hard English “r.”",
    draft: true,
  },

  れ: {
    glyph: "れ",
    romaji: "re",
    sound: "reh",
    object: "someone retching",
    analogy: [
      { text: "Say “" },
      { text: "reh", accent: true },
      { text: "” as in " },
      { text: "re", accent: true },
      { text: "tching." },
    ],
    mnemonic: [
      { text: "A person doubled over the toilet, " },
      { text: "re", accent: true },
      { text: "tching, their back curved up as they heave." },
    ],
    example: { word: "きれい", reading: "kirei", gloss: "pretty", hitIndex: 1 },
    approximate: "A single soft tap of the tongue, not a hard English “r.”",
    draft: true,
  },

  ろ: {
    glyph: "ろ",
    romaji: "ro",
    sound: "roh",
    object: "winding road",
    analogy: [
      { text: "Say “" },
      { text: "roh", accent: true },
      { text: "” as in " },
      { text: "ro", accent: true },
      { text: "ad." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ro", accent: true },
      { text: "ad winding down and bending back." },
    ],
    example: { word: "ろく", reading: "roku", gloss: "six", hitIndex: 0 },
    approximate: "A single soft tap of the tongue, not a hard English “r.”",
    draft: true,
  },

  // ---- W row + ん — わ を ん (DRAFT) ------------------------------------
  わ: {
    glyph: "わ",
    romaji: "wa",
    sound: "wa",
    object: "wand",
    analogy: [
      { text: "Say “" },
      { text: "wa", accent: true },
      { text: "” as in " },
      { text: "wa", accent: true },
      { text: "nd." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "wa", accent: true },
      { text: "nd waving around swishing magical spells in the air." },
    ],
    example: { word: "わたし", reading: "watashi", gloss: "I / me", hitIndex: 0 },
    draft: true,
  },

  を: {
    glyph: "を",
    romaji: "wo",
    sound: "wo",
    object: "a wok",
    analogy: [
      { text: "Say “" },
      { text: "wo", accent: true },
      { text: "” as in " },
      { text: "wo", accent: true },
      { text: "ah!" },
    ],
    mnemonic: [
      { text: "A " },
      { text: "wo", accent: true },
      { text: "k tossing food up in an arc: を." },
    ],
    example: { word: "パンを", reading: "pan o", gloss: "bread [object]", hitIndex: 2 },
    approximate: "This is the object particle. It attaches to a noun (パンを食べる, “eat bread”) and sounds exactly like お.",
    draft: true,
  },

  ん: {
    glyph: "ん",
    romaji: "n",
    sound: "n",
    object: "the letter n",
    analogy: [
      { text: "Sounds like the letter " },
      { text: "n", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "It looks like a lowercase cursive " },
      { text: "n", accent: true },
      { text: "!" },
    ],
    example: { word: "ほん", reading: "hon", gloss: "book", hitIndex: 1 },
    approximate: "One held beat of nasal. Its exact colour (m / n / ng) bends to what follows.",
    draft: true,
  },
};

/**
 * The syllabary a single glyph belongs to, by Unicode block: "hiragana" for a
 * code point in the Hiragana block (U+3040–U+309F) and "katakana" for one in the
 * Katakana block (U+30A0–U+30FF). `null` for anything else — a kanji, a Latin
 * letter, an empty string, or a multi-code-point string. This is what splits the
 * mnemonic-image storage by script, so か and カ (both romaji "ka") don't collide
 * on one filename.
 */
export function kanaScript(glyph: string): "hiragana" | "katakana" | null {
  const cp = glyph.codePointAt(0);
  if (cp === undefined) return null;
  // Guard against multi-code-point strings: only a single-glyph input classifies.
  if (String.fromCodePoint(cp) !== glyph) return null;
  if (cp >= 0x3040 && cp <= 0x309f) return "hiragana";
  if (cp >= 0x30a0 && cp <= 0x30ff) return "katakana";
  return null;
}

/**
 * The mnemonic for a glyph, or `null` when there is none. This is the whole of
 * the hide-when-absent rule: both call sites render the card only when this
 * returns non-null, so a kana with no entry shows nothing at all — no
 * placeholder, no empty box. Works for any glyph, kana or (later) kanji.
 */
export function getMnemonic(glyph: MnemonicKey): Mnemonic | null {
  const entry = MNEMONICS[glyph];
  if (!entry) return null;
  // Every entry gets a CANDIDATE image path derived from its own romaji AND the
  // glyph's script — the picture at public/mnemonics/<script>/<romaji>.webp.
  // Splitting by script keeps か and カ (both "ka") from sharing one filename.
  // It's a candidate, not a promise: the file may not exist yet. The renderers
  // load it and fall back to the plain glyph on error (a missing file 404s), so
  // "the drawing shows if the webp is there, else the character" needs no
  // registry and no fs check here. Drawing a new kana is: drop <romaji>.webp
  // into public/mnemonics/<script>/ (or a PNG + run `pnpm mnemonic-images`) — no
  // edit to this table or its test. A glyph that is neither kana (a future
  // kanji) has no script folder, so it keeps the flat /mnemonics/<romaji>.webp
  // fallback rather than crashing.
  const script = kanaScript(glyph);
  const image = script
    ? `/mnemonics/${script}/${entry.romaji}.webp`
    : `/mnemonics/${entry.romaji}.webp`;
  return { ...entry, image };
}
