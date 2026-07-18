// In-app kana mnemonics — the app's OWN hooks, replacing the outbound
// Tofugu/WaniKani links.
//
// WHAT THIS FILE IS
// =================
// A pure data table, keyed by the character it teaches. It holds the words and
// (when one exists) a drawn picture; it renders nothing. `MnemonicCard`
// (components/lesson/mnemonic-card.tsx) is the one place it turns into pixels,
// and two call sites (the teach-me walkthrough and the Library entry page) gate
// on `getMnemonic` returning non-null. A kana with no row here shows no card —
// see the hide-when-absent rule in MnemonicCard.
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
// authored today is hiragana, so today's paths are all
// /mnemonics/hiragana/<romaji>.webp. A glyph that is neither kana (a future
// kanji) has no script folder, so it falls back to the flat
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
      { text: "Say it like the open " },
      { text: "ah", accent: true },
      { text: " in f" },
      { text: "a", accent: true },
      { text: "ther — not the letter-name “ay,” not “cat.”" },
    ],
    mnemonic: [
      { text: "An acrobat tumbles through her aerials — a capital A flipping through the air — while her f" },
      { text: "a", accent: true },
      { text: "ther watches, mouth open, and gasps “ooooh, " },
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
      { text: "Say it like the " },
      { text: "ee", accent: true },
      { text: " in f" },
      { text: "ee", accent: true },
      { text: "t — the same sound as " },
      { text: "ee", accent: true },
      { text: "l." },
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
      { text: "Say it like the " },
      { text: "oo", accent: true },
      { text: " in m" },
      { text: "oo", accent: true },
      { text: "n — but keep your lips relaxed and unrounded." },
    ],
    mnemonic: [
      { text: "A tired letter u tips onto its side and sinks into a hot bath — the line on top is the water settling over it — and sighs a long “" },
      { text: "oooh", accent: true },
      { text: ".”" },
    ],
    example: { word: "うみ", reading: "umi", gloss: "sea", hitIndex: 0 },
    approximate: "Japanese う is flatter than English “oo” — don’t purse your lips. Trust the sound clip.",
  },

  え: {
    glyph: "え",
    romaji: "e",
    sound: "eh",
    ipa: "/e/ · eh",
    object: "bird from an egg",
    analogy: [
      { text: "Say it like the " },
      { text: "eh", accent: true },
      { text: " in b" },
      { text: "e", accent: true },
      { text: "d or " },
      { text: "e", accent: true },
      { text: "gg — flat “" },
      { text: "eh", accent: true },
      { text: ",” never “ay.”" },
    ],
    mnemonic: [
      { text: "An exotic bird cracks out of a sp" },
      { text: "e", accent: true },
      { text: "ckled " },
      { text: "e", accent: true },
      { text: "gg, shakes off the sh" },
      { text: "e", accent: true },
      { text: "ll, and squawks “" },
      { text: "eh", accent: true },
      { text: "!”" },
    ],
    example: { word: "えき", reading: "eki", gloss: "station", hitIndex: 0 },
    approximate: "No glide — it’s “eh,” never “ay.” Match the sound clip’s flat vowel.",
  },

  お: {
    glyph: "お",
    romaji: "o",
    sound: "oh",
    ipa: "/o/ · oh",
    object: "wide eyes",
    analogy: [
      { text: "Say it like the " },
      { text: "oh", accent: true },
      { text: " in " },
      { text: "oa", accent: true },
      { text: "t — a clean “" },
      { text: "oh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "Two eyes g" },
      { text: "o", accent: true },
      { text: " round as " },
      { text: "O", accent: true },
      { text: "s watching the fireworks burst " },
      { text: "o", accent: true },
      { text: "verhead — a long, amazed “" },
      { text: "oh", accent: true },
      { text: "!”" },
    ],
    example: { word: "おと", reading: "oto", gloss: "sound", hitIndex: 0 },
    approximate: "Short and pure, no “oh-w” glide at the end. The sound clip is the ruler.",
  },

  // ---- K row — か き く け こ (APPROVED) --------------------------------
  か: {
    glyph: "か",
    romaji: "ka",
    sound: "ka",
    object: "karate kick",
    analogy: [
      { text: "Say it like the " },
      { text: "ka", accent: true },
      { text: " in karate." },
    ],
    mnemonic: [
      { text: "A black belt snaps out a karate kick, one leg flying high, and shouts “" },
      { text: "ka", accent: true },
      { text: "!” as the board splits." },
    ],
    example: { word: "かさ", reading: "kasa", gloss: "umbrella", hitIndex: 0 },
  },

  き: {
    glyph: "き",
    romaji: "ki",
    sound: "kee",
    object: "key",
    analogy: [
      { text: "Say “" },
      { text: "kee", accent: true },
      { text: ",” like the word " },
      { text: "key", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A two-toothed " },
      { text: "key", accent: true },
      { text: " jams into a rusty lock and screeches “" },
      { text: "kee", accent: true },
      { text: "!” as it forces the door open." },
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
      { text: "-" },
      { text: "ku", accent: true },
      { text: ",” like a cuc" },
      { text: "koo", accent: true },
      { text: " — a sharp “" },
      { text: "koo", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A cuc" },
      { text: "koo", accent: true },
      { text: " explodes out of the clock, beak stabbing to a sharp point, screaming “" },
      { text: "ku", accent: true },
      { text: "-" },
      { text: "ku", accent: true },
      { text: "!” on the hour." },
    ],
    example: { word: "くち", reading: "kuchi", gloss: "mouth", hitIndex: 0 },
  },

  け: {
    glyph: "け",
    romaji: "ke",
    sound: "ke",
    object: "kelp",
    analogy: [
      { text: "Say it like the e in bed — “" },
      { text: "keh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "Two ribbons of " },
      { text: "ke", accent: true },
      { text: "lp sway in the tide, leaning and parting in the current." },
    ],
    example: { word: "けさ", reading: "kesa", gloss: "this morning", hitIndex: 0 },
  },

  こ: {
    glyph: "こ",
    romaji: "ko",
    sound: "co",
    object: "a cobra",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "co", accent: true },
      { text: "bra." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "co", accent: true },
      { text: "bra coiled twice — one loop stacked above the other, like こ." },
    ],
    example: { word: "こえ", reading: "koe", gloss: "voice", hitIndex: 0 },
  },

  // ---- S row — さ し す せ そ (APPROVED) --------------------------------
  さ: {
    glyph: "さ",
    romaji: "sa",
    sound: "sa",
    object: "sardine",
    analogy: [
      { text: "Say “" },
      { text: "sah", accent: true },
      { text: ",” as in " },
      { text: "sa", accent: true },
      { text: "rdine." },
    ],
    mnemonic: [
      { text: "A fat " },
      { text: "sa", accent: true },
      { text: "rdine dangles off the fishing line, body arched, tail flicking — one wriggle and it’s gone." },
    ],
    example: { word: "さかな", reading: "sakana", gloss: "fish", hitIndex: 0 },
  },

  し: {
    glyph: "し",
    romaji: "shi",
    sound: "shee",
    object: "a shepherd's crook",
    analogy: [
      { text: "Like the start of " },
      { text: "shee", accent: true },
      { text: "p." },
    ],
    mnemonic: [
      { text: "A shepherd's crook reaches out to hook a stray " },
      { text: "shee", accent: true },
      { text: "p — し." },
    ],
    example: { word: "しろ", reading: "shiro", gloss: "white", hitIndex: 0 },
  },

  す: {
    glyph: "す",
    romaji: "su",
    sound: "soo",
    object: "a bowl of soup",
    analogy: [
      { text: "Say “" },
      { text: "soo", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A bowl of " },
      { text: "sou", accent: true },
      { text: "p, a curl of steam rising off the top — す." },
    ],
    example: { word: "すし", reading: "sushi", gloss: "sushi", hitIndex: 0 },
  },

  せ: {
    glyph: "せ",
    romaji: "se",
    sound: "se",
    object: "a seesaw",
    analogy: [
      { text: "Say “" },
      { text: "seh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "S" },
      { text: "e", accent: true },
      { text: "ven kids " },
      { text: "se", accent: true },
      { text: "ttle onto the seesaw and it tips — a plank across the middle, one seat flung high — せ." },
    ],
    example: { word: "せかい", reading: "sekai", gloss: "world", hitIndex: 0 },
  },

  そ: {
    glyph: "そ",
    romaji: "so",
    sound: "sew",
    object: "sewing",
    analogy: [
      { text: "Sounds like " },
      { text: "sew", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A needle " },
      { text: "sew", accent: true },
      { text: "s a zig-zag stitch — そ." },
    ],
    example: { word: "そら", reading: "sora", gloss: "sky", hitIndex: 0 },
  },

  // ---- T row — た ち つ て と (DRAFT) -----------------------------------
  た: {
    glyph: "た",
    romaji: "ta",
    sound: "ta",
    object: "“ta-da!” finish",
    analogy: [
      { text: "Say “" },
      { text: "tah", accent: true },
      { text: ".”" },
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
      { text: "se with a wedge cut out — ち." },
    ],
    example: { word: "ちず", reading: "chizu", gloss: "map", hitIndex: 0 },
    draft: true,
  },

  つ: {
    glyph: "つ",
    romaji: "tsu",
    sound: "tsu",
    object: "wave",
    analogy: [
      { text: "Say “" },
      { text: "tsu", accent: true },
      { text: "” — “" },
      { text: "tsoo", accent: true },
      { text: ",” one sound, t and s together." },
    ],
    mnemonic: [
      { text: "A single " },
      { text: "tsu", accent: true },
      { text: "nami curls its crest and sweeps over." },
    ],
    example: { word: "つき", reading: "tsuki", gloss: "moon", hitIndex: 0 },
    approximate: "One sound — t and s pressed together, not “t” then “sue.” The sound clip nails it.",
    draft: true,
  },

  て: {
    glyph: "て",
    romaji: "te",
    sound: "te",
    object: "telephone pole",
    analogy: [
      { text: "Say “" },
      { text: "teh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A " },
      { text: "te", accent: true },
      { text: "lephone pole with one crossbar hums in the wind — “" },
      { text: "teh", accent: true },
      { text: ".”" },
    ],
    example: { word: "てがみ", reading: "tegami", gloss: "letter", hitIndex: 0 },
    draft: true,
  },

  と: {
    glyph: "と",
    romaji: "to",
    sound: "to",
    object: "stubbed toe",
    analogy: [
      { text: "Say “" },
      { text: "toh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A thorn jabs the " },
      { text: "toe", accent: true },
      { text: " — “" },
      { text: "toh", accent: true },
      { text: "!” — one long foot, one sharp splinter crossing it." },
    ],
    example: { word: "とり", reading: "tori", gloss: "bird", hitIndex: 0 },
    draft: true,
  },

  // ---- N row — な に ぬ ね の (DRAFT) -----------------------------------
  な: {
    glyph: "な",
    romaji: "na",
    sound: "na",
    object: "a plate of nachos",
    analogy: [
      { text: "Say “" },
      { text: "nah", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A plate of " },
      { text: "na", accent: true },
      { text: "chos piled high — な." },
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
      { text: ",” like " },
      { text: "nee", accent: true },
      { text: "dle." },
    ],
    mnemonic: [
      { text: "Thread the " },
      { text: "nee", accent: true },
      { text: "dle — the tall " },
      { text: "nee", accent: true },
      { text: "dle standing, two stitches beside it." },
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
      { text: ",” like " },
      { text: "noo", accent: true },
      { text: "dles." },
    ],
    mnemonic: [
      { text: "Twirl the " },
      { text: "noo", accent: true },
      { text: "dles up off the bowl — one big looping slurp." },
    ],
    example: { word: "ぬの", reading: "nuno", gloss: "cloth", hitIndex: 0 },
    draft: true,
  },

  ね: {
    glyph: "ね",
    romaji: "ne",
    sound: "ne",
    object: "Nelly the cat",
    analogy: [
      { text: "Starts like " },
      { text: "Ne", accent: true },
      { text: "lly." },
    ],
    mnemonic: [
      { text: "Ne", accent: true },
      { text: "lly the cat curls her tail into a loop — ね." },
    ],
    example: { word: "ねこ", reading: "neko", gloss: "cat", hitIndex: 0 },
    draft: true,
  },

  の: {
    glyph: "の",
    romaji: "no",
    sound: "no",
    object: "a pig's nose",
    analogy: [
      { text: "Say “" },
      { text: "noh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A pig's " },
      { text: "no", accent: true },
      { text: "se — one round snout with a curl, like の." },
    ],
    example: { word: "のり", reading: "nori", gloss: "seaweed", hitIndex: 0 },
    draft: true,
  },

  // ---- H row — は ひ ふ へ ほ (DRAFT) -----------------------------------
  は: {
    glyph: "は",
    romaji: "ha",
    sound: "ha",
    object: "big laugh",
    analogy: [
      { text: "Say “" },
      { text: "hah", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "Throw your head back and laugh: “" },
      { text: "ha", accent: true },
      { text: "-" },
      { text: "ha", accent: true },
      { text: "-" },
      { text: "ha", accent: true },
      { text: "!”" },
    ],
    example: { word: "はな", reading: "hana", gloss: "flower", hitIndex: 0 },
    draft: true,
  },

  ひ: {
    glyph: "ひ",
    romaji: "hi",
    sound: "hee",
    object: "a heel",
    analogy: [
      { text: "Like the vowel in " },
      { text: "hee", accent: true },
      { text: "l." },
    ],
    mnemonic: [
      { text: "A bare foot — the " },
      { text: "hee", accent: true },
      { text: "l juts out at the back, just like ひ." },
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
      { text: " — “" },
      { text: "foo", accent: true },
      { text: ",” halfway between English f and h." },
    ],
    mnemonic: [
      { text: "Climb " },
      { text: "Fu", accent: true },
      { text: "ji — the peak with clouds drifting past its slopes." },
    ],
    example: { word: "ふね", reading: "fune", gloss: "boat", hitIndex: 0 },
    approximate: "Not a hard English “f” — a soft breath between f and h. The sound clip is the guide.",
    draft: true,
  },

  へ: {
    glyph: "へ",
    romaji: "he",
    sound: "he",
    object: "a mountain peak",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "He", accent: true },
      { text: "lens." },
    ],
    mnemonic: [
      { text: "A single mountain peak — Mount St. " },
      { text: "He", accent: true },
      { text: "lens — へ." },
    ],
    example: { word: "へや", reading: "heya", gloss: "room", hitIndex: 0 },
    draft: true,
  },

  ほ: {
    glyph: "ほ",
    romaji: "ho",
    sound: "ho",
    object: "a home",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "ho", accent: true },
      { text: "me." },
    ],
    mnemonic: [
      { text: "A little " },
      { text: "ho", accent: true },
      { text: "me with a wall and a chimney — ほ." },
    ],
    example: { word: "ほし", reading: "hoshi", gloss: "star", hitIndex: 0 },
    draft: true,
  },

  // ---- M row — ま み む め も (DRAFT) -----------------------------------
  ま: {
    glyph: "ま",
    romaji: "ma",
    sound: "ma",
    object: "horseshoe magnet",
    analogy: [
      { text: "Say “" },
      { text: "mah", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "Ma", accent: true },
      { text: "ma’s magnet snaps it up — two poles up top, a U-base below." },
    ],
    example: { word: "まど", reading: "mado", gloss: "window", hitIndex: 0 },
    draft: true,
  },

  み: {
    glyph: "み",
    romaji: "mi",
    sound: "mi",
    object: "a musical note",
    analogy: [
      { text: "Say “" },
      { text: "mi", accent: true },
      { text: ",” the note — you say it “" },
      { text: "mee", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A musical note — the " },
      { text: "mi", accent: true },
      { text: " in do-re-" },
      { text: "mi", accent: true },
      { text: " — み." },
    ],
    example: { word: "みみ", reading: "mimi", gloss: "ear", hitIndex: 0 },
    draft: true,
  },

  む: {
    glyph: "む",
    romaji: "mu",
    sound: "moo",
    object: "a cow",
    analogy: [
      { text: "Sounds like a cow's " },
      { text: "moo", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "A cow swishes its tail and lows, " },
      { text: "moo", accent: true },
      { text: " — む." },
    ],
    example: { word: "むし", reading: "mushi", gloss: "insect", hitIndex: 0 },
    draft: true,
  },

  め: {
    glyph: "め",
    romaji: "me",
    sound: "me",
    object: "eye",
    analogy: [
      { text: "Say “" },
      { text: "meh", accent: true },
      { text: ".”" },
    ],
    mnemonic: [
      { text: "A " },
      { text: "me", accent: true },
      { text: "lon-round eye winks — lid and lashes above, the eyeball below. (め even means “eye.”)" },
    ],
    example: { word: "め", reading: "me", gloss: "eye", hitIndex: 0 },
    draft: true,
  },

  も: {
    glyph: "も",
    romaji: "mo",
    sound: "mo",
    object: "a fishhook",
    analogy: [
      { text: "Sounds like " },
      { text: "mo", accent: true },
      { text: "re." },
    ],
    mnemonic: [
      { text: "A fishhook baited with two worms — the " },
      { text: "mo", accent: true },
      { text: "re worms, the " },
      { text: "mo", accent: true },
      { text: "re fish — も." },
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
      { text: "Sounds like the start of " },
      { text: "ya", accent: true },
      { text: "cht." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ya", accent: true },
      { text: "cht, mast up and sail full — や." },
    ],
    example: { word: "やま", reading: "yama", gloss: "mountain", hitIndex: 0 },
    draft: true,
  },

  ゆ: {
    glyph: "ゆ",
    romaji: "yu",
    sound: "uni",
    object: "a unique fish",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "uni", accent: true },
      { text: "que." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "uni", accent: true },
      { text: "que fish, its long tail looping back — ゆ." },
    ],
    example: { word: "ゆき", reading: "yuki", gloss: "snow", hitIndex: 0 },
    draft: true,
  },

  よ: {
    glyph: "よ",
    romaji: "yo",
    sound: "yo",
    object: "\"yo\"",
    analogy: [
      { text: "Sounds like " },
      { text: "yo", accent: true },
      { text: "." },
    ],
    mnemonic: [
      { text: "It even reads like the word " },
      { text: "yo", accent: true },
      { text: " — よ." },
    ],
    example: { word: "よる", reading: "yoru", gloss: "night", hitIndex: 0 },
    draft: true,
  },

  // ---- R row — ら り る れ ろ (DRAFT — a single soft TAP, between r/l/d) --
  ら: {
    glyph: "ら",
    romaji: "ra",
    sound: "ra",
    object: "a rabbit",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "ra", accent: true },
      { text: "bbit." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ra", accent: true },
      { text: "bbit sits up, ears pricked forward — ら." },
    ],
    example: { word: "さくら", reading: "sakura", gloss: "cherry blossom", hitIndex: 2 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The sound clip is the target.",
    draft: true,
  },

  り: {
    glyph: "り",
    romaji: "ri",
    sound: "ree",
    object: "reeds",
    analogy: [
      { text: "Sounds like " },
      { text: "ree", accent: true },
      { text: "ds." },
    ],
    mnemonic: [
      { text: "Two " },
      { text: "ree", accent: true },
      { text: "ds standing side by side in the water — り." },
    ],
    example: { word: "りんご", reading: "ringo", gloss: "apple", hitIndex: 0 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The sound clip is the target.",
    draft: true,
  },

  る: {
    glyph: "る",
    romaji: "ru",
    sound: "rou",
    object: "a looping road",
    analogy: [
      { text: "Sounds like " },
      { text: "rou", accent: true },
      { text: "te." },
    ],
    mnemonic: [
      { text: "The " },
      { text: "rou", accent: true },
      { text: "te drops down and curls into a loop — る." },
    ],
    example: { word: "くるま", reading: "kuruma", gloss: "car", hitIndex: 1 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The sound clip is the target.",
    draft: true,
  },

  れ: {
    glyph: "れ",
    romaji: "re",
    sound: "re",
    object: "someone retching",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "re", accent: true },
      { text: "tching." },
    ],
    mnemonic: [
      { text: "A person doubled over the toilet, " },
      { text: "re", accent: true },
      { text: "tching — れ." },
    ],
    example: { word: "きれい", reading: "kirei", gloss: "pretty", hitIndex: 1 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The sound clip is the target.",
    draft: true,
  },

  ろ: {
    glyph: "ろ",
    romaji: "ro",
    sound: "ro",
    object: "a winding road",
    analogy: [
      { text: "Sounds like " },
      { text: "ro", accent: true },
      { text: "ad." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "ro", accent: true },
      { text: "ad winding down and bending back — ろ (the open bend; る adds the full loop)." },
    ],
    example: { word: "ろく", reading: "roku", gloss: "six", hitIndex: 0 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The sound clip is the target.",
    draft: true,
  },

  // ---- W row + ん — わ を ん (DRAFT) ------------------------------------
  わ: {
    glyph: "わ",
    romaji: "wa",
    sound: "wa",
    object: "someone waving",
    analogy: [
      { text: "Sounds like the start of " },
      { text: "wa", accent: true },
      { text: "ving." },
    ],
    mnemonic: [
      { text: "A person " },
      { text: "wa", accent: true },
      { text: "ving one arm high — わ." },
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
      { text: "Sounds like " },
      { text: "wo", accent: true },
      { text: "k." },
    ],
    mnemonic: [
      { text: "A " },
      { text: "wo", accent: true },
      { text: "k tossing food up in an arc — を." },
    ],
    example: { word: "パンを", reading: "pan o", gloss: "bread [object]", hitIndex: 2 },
    approximate: "The object particle — attaches to a noun (パンを食べる, “eat bread”) and sounds exactly like お.",
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
      { text: "It even looks like a lowercase " },
      { text: "n", accent: true },
      { text: " — ん." },
    ],
    example: { word: "ほん", reading: "hon", gloss: "book", hitIndex: 1 },
    approximate: "One held beat of nasal — its exact colour (m / n / ng) bends to what follows. Trust the sound clip.",
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
