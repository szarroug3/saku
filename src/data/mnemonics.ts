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
// APPROVED vs DRAFT
// =================
// あ–そ (the vowels, K row, S row) are owner-approved. た–ん carry `draft: true`
// — same voice, first-draft hooks that lean harder on the sound where the shape
// is busy. The 🔊 clip in-app is always the source of truth for the exact sound.

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

/** One kana's mnemonic: the hooks, the picture, and a word that proves it. */
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
   * The shape→picture hook: the one-scene story, with the sound landing hard.
   * `sound` accents the sound-bearing word in the story, or is `null` when the
   * story's words name only the shape and none carries the sound.
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
    analogy: { lead: "Say it like the open ", sound: "ah", tail: " in father — not the letter-name “ay,” not “cat.”" },
    mnemonic: {
      lead: "An acrobat tumbles through her aerials — a capital A flipping through the air — while her father watches, mouth open, and gasps “",
      sound: "ahhh",
      tail: "!”",
    },
    example: { word: "あめ", reading: "ame", gloss: "rain", hitIndex: 0 },
  },

  い: {
    glyph: "い",
    romaji: "i",
    sound: "ee",
    ipa: "/i/ · ee",
    object: "two eels",
    analogy: { lead: "Say it like the ", sound: "ee", tail: " in feet — the same sound as eel." },
    mnemonic: {
      lead: "Two eels tear up the river neck-and-neck, one long, one stubby, screeching a thin “",
      sound: "eee",
      tail: "!”",
    },
    example: { word: "いぬ", reading: "inu", gloss: "dog", hitIndex: 0 },
  },

  う: {
    glyph: "う",
    romaji: "u",
    sound: "oo",
    ipa: "/ɯ/ · oo",
    object: "u in the bath",
    analogy: { lead: "Say it like the ", sound: "oo", tail: " in moon — but keep your lips relaxed and unrounded." },
    mnemonic: {
      lead: "A tired letter u tips onto its side and sinks into a hot bath — the line on top is the water settling over it — and sighs a long “",
      sound: "oooh",
      tail: ".”",
    },
    example: { word: "うみ", reading: "umi", gloss: "sea", hitIndex: 0 },
    approximate: "Japanese う is flatter than English “oo” — don’t purse your lips. Trust the 🔊 clip.",
  },

  え: {
    glyph: "え",
    romaji: "e",
    sound: "eh",
    ipa: "/e/ · eh",
    object: "bird from an egg",
    analogy: { lead: "Say it like the ", sound: "eh", tail: " in bed or egg — flat “eh,” never “ay.”" },
    mnemonic: {
      lead: "An exotic bird cracks out of a speckled egg, shakes off the shell, and squawks “",
      sound: "eh",
      tail: "!”",
    },
    example: { word: "えき", reading: "eki", gloss: "station", hitIndex: 0 },
    approximate: "No glide — it’s “eh,” never “ay.” Match the 🔊 clip’s flat vowel.",
  },

  お: {
    glyph: "お",
    romaji: "o",
    sound: "oh",
    ipa: "/o/ · oh",
    object: "wide eyes",
    analogy: { lead: "Say it like the ", sound: "oh", tail: " in oat — a clean “oh.”" },
    mnemonic: {
      lead: "Two eyes go round as Os watching the fireworks burst overhead — a long, amazed “",
      sound: "oh",
      tail: "!”",
    },
    example: { word: "おと", reading: "oto", gloss: "sound", hitIndex: 0 },
    approximate: "Short and pure, no “oh-w” glide at the end. The 🔊 clip is the ruler.",
  },

  // ---- K row — か き く け こ (APPROVED) --------------------------------
  か: {
    glyph: "か",
    romaji: "ka",
    sound: "ka",
    object: "karate kick",
    analogy: { lead: "Say it like the ", sound: "ka", tail: " in karate." },
    mnemonic: {
      lead: "A black belt snaps out a karate kick, one leg flying high, and shouts “",
      sound: "ka",
      tail: "!” as the board splits.",
    },
    example: { word: "かさ", reading: "kasa", gloss: "umbrella", hitIndex: 0 },
  },

  き: {
    glyph: "き",
    romaji: "ki",
    sound: "kee",
    object: "key",
    analogy: { lead: "Say “", sound: "kee", tail: ",” like the word key." },
    mnemonic: {
      lead: "A two-toothed key jams into a rusty lock and screeches “",
      sound: "kee",
      tail: "!” as it forces the door open.",
    },
    example: { word: "き", reading: "ki", gloss: "tree", hitIndex: 0 },
  },

  く: {
    glyph: "く",
    romaji: "ku",
    sound: "ku",
    object: "cuckoo",
    analogy: { lead: "Say “", sound: "ku", tail: "-ku,” like a cuckoo — a sharp “koo.”" },
    mnemonic: {
      lead: "A cuckoo explodes out of the clock, beak stabbing to a sharp point, screaming “",
      sound: "ku-ku",
      tail: "!” on the hour.",
    },
    example: { word: "くち", reading: "kuchi", gloss: "mouth", hitIndex: 0 },
  },

  け: {
    glyph: "け",
    romaji: "ke",
    sound: "ke",
    object: "kelp",
    analogy: { lead: "Say it like the e in bed — “", sound: "keh", tail: ".”" },
    mnemonic: {
      lead: "Two ribbons of ",
      sound: "ke",
      tail: "lp sway in the tide, leaning and parting in the current.",
    },
    example: { word: "けさ", reading: "kesa", gloss: "this morning", hitIndex: 0 },
  },

  こ: {
    glyph: "こ",
    romaji: "ko",
    sound: "co",
    object: "a cobra",
    analogy: { lead: "Sounds like the start of ", sound: "cobra", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "cobra",
      tail: " coiled twice — one loop stacked above the other, like こ.",
    },
    example: { word: "こえ", reading: "koe", gloss: "voice", hitIndex: 0 },
  },

  // ---- S row — さ し す せ そ (APPROVED) --------------------------------
  さ: {
    glyph: "さ",
    romaji: "sa",
    sound: "sa",
    object: "sardine",
    analogy: { lead: "Say “", sound: "sah", tail: ",” as in sardine." },
    mnemonic: {
      lead: "A fat ",
      sound: "sar",
      tail: "dine dangles off the fishing line, body arched, tail flicking — one wriggle and it’s gone.",
    },
    example: { word: "さかな", reading: "sakana", gloss: "fish", hitIndex: 0 },
  },

  し: {
    glyph: "し",
    romaji: "shi",
    sound: "shee",
    object: "a shepherd's crook",
    analogy: { lead: "Like the start of ", sound: "sheep", tail: "." },
    mnemonic: {
      lead: "A shepherd's crook reaches out to hook a stray ",
      sound: "sheep",
      tail: " — し.",
    },
    example: { word: "しろ", reading: "shiro", gloss: "white", hitIndex: 0 },
  },

  す: {
    glyph: "す",
    romaji: "su",
    sound: "soo",
    object: "a bowl of soup",
    analogy: { lead: "Say “", sound: "soo", tail: ".”" },
    mnemonic: {
      lead: "A bowl of soup, a curl of steam rising off the top — す.",
      sound: null,
      tail: "",
    },
    example: { word: "すし", reading: "sushi", gloss: "sushi", hitIndex: 0 },
  },

  せ: {
    glyph: "せ",
    romaji: "se",
    sound: "se",
    object: "a seesaw",
    analogy: { lead: "Say “", sound: "seh", tail: ".”" },
    mnemonic: {
      lead: "Seven kids ",
      sound: "settle",
      tail: " onto the seesaw and it tips — a plank across the middle, one seat flung high — せ.",
    },
    example: { word: "せかい", reading: "sekai", gloss: "world", hitIndex: 0 },
  },

  そ: {
    glyph: "そ",
    romaji: "so",
    sound: "sew",
    object: "sewing",
    analogy: { lead: "Sounds like ", sound: "sew", tail: "." },
    mnemonic: {
      lead: "A needle ",
      sound: "sew",
      tail: "s a zig-zag stitch — そ.",
    },
    example: { word: "そら", reading: "sora", gloss: "sky", hitIndex: 0 },
  },

  // ---- T row — た ち つ て と (DRAFT) -----------------------------------
  た: {
    glyph: "た",
    romaji: "ta",
    sound: "ta",
    object: "“ta-da!” finish",
    analogy: { lead: "Say “", sound: "tah", tail: ".”" },
    mnemonic: {
      lead: "Arms and legs flung wide, the performer lands the big finish: “",
      sound: "ta-da",
      tail: "!”",
    },
    example: { word: "たまご", reading: "tamago", gloss: "egg", hitIndex: 0 },
    draft: true,
  },

  ち: {
    glyph: "ち",
    romaji: "chi",
    sound: "chee",
    object: "a wheel of cheese",
    analogy: { lead: "Say “", sound: "chee", tail: ".”" },
    mnemonic: {
      lead: "A big wheel of ",
      sound: "cheese",
      tail: " with a wedge cut out — ち.",
    },
    example: { word: "ちず", reading: "chizu", gloss: "map", hitIndex: 0 },
    draft: true,
  },

  つ: {
    glyph: "つ",
    romaji: "tsu",
    sound: "tsu",
    object: "wave",
    analogy: { lead: "Say “", sound: "tsu", tail: "” — “tsoo,” one sound, t and s together." },
    mnemonic: {
      lead: "A single ",
      sound: "tsu",
      tail: "nami curls its crest and sweeps over.",
    },
    example: { word: "つき", reading: "tsuki", gloss: "moon", hitIndex: 0 },
    approximate: "One sound — t and s pressed together, not “t” then “sue.” The 🔊 clip nails it.",
    draft: true,
  },

  て: {
    glyph: "て",
    romaji: "te",
    sound: "te",
    object: "telephone pole",
    analogy: { lead: "Say “", sound: "teh", tail: ".”" },
    mnemonic: {
      lead: "A ",
      sound: "te",
      tail: "lephone pole with one crossbar hums in the wind — “teh.”",
    },
    example: { word: "てがみ", reading: "tegami", gloss: "letter", hitIndex: 0 },
    draft: true,
  },

  と: {
    glyph: "と",
    romaji: "to",
    sound: "to",
    object: "stubbed toe",
    analogy: { lead: "Say “", sound: "toh", tail: ".”" },
    mnemonic: {
      lead: "A thorn jabs the ",
      sound: "toe",
      tail: " — “toh!” — one long foot, one sharp splinter crossing it.",
    },
    example: { word: "とり", reading: "tori", gloss: "bird", hitIndex: 0 },
    draft: true,
  },

  // ---- N row — な に ぬ ね の (DRAFT) -----------------------------------
  な: {
    glyph: "な",
    romaji: "na",
    sound: "na",
    object: "a plate of nachos",
    analogy: { lead: "Say “", sound: "nah", tail: ".”" },
    mnemonic: {
      lead: "A plate of ",
      sound: "nachos",
      tail: " piled high — な.",
    },
    example: { word: "なつ", reading: "natsu", gloss: "summer", hitIndex: 0 },
    draft: true,
  },

  に: {
    glyph: "に",
    romaji: "ni",
    sound: "nee",
    object: "needle and thread",
    analogy: { lead: "Say “", sound: "nee", tail: ",” like needle." },
    mnemonic: {
      lead: "Thread the ",
      sound: "nee",
      tail: "dle — the tall needle standing, two stitches beside it.",
    },
    example: { word: "にく", reading: "niku", gloss: "meat", hitIndex: 0 },
    draft: true,
  },

  ぬ: {
    glyph: "ぬ",
    romaji: "nu",
    sound: "noo",
    object: "noodles",
    analogy: { lead: "Say “", sound: "noo", tail: ",” like noodles." },
    mnemonic: {
      lead: "Twirl the ",
      sound: "noo",
      tail: "dles up off the bowl — one big looping slurp.",
    },
    example: { word: "ぬの", reading: "nuno", gloss: "cloth", hitIndex: 0 },
    draft: true,
  },

  ね: {
    glyph: "ね",
    romaji: "ne",
    sound: "ne",
    object: "Nelly the cat",
    analogy: { lead: "Starts like ", sound: "Nelly", tail: "." },
    mnemonic: {
      lead: "",
      sound: "Nelly",
      tail: " the cat curls her tail into a loop — ね.",
    },
    example: { word: "ねこ", reading: "neko", gloss: "cat", hitIndex: 0 },
    draft: true,
  },

  の: {
    glyph: "の",
    romaji: "no",
    sound: "no",
    object: "a pig's nose",
    analogy: { lead: "Say “", sound: "noh", tail: ".”" },
    mnemonic: {
      lead: "A pig's ",
      sound: "nose",
      tail: " — one round snout with a curl, like の.",
    },
    example: { word: "のり", reading: "nori", gloss: "seaweed", hitIndex: 0 },
    draft: true,
  },

  // ---- H row — は ひ ふ へ ほ (DRAFT) -----------------------------------
  は: {
    glyph: "は",
    romaji: "ha",
    sound: "ha",
    object: "big laugh",
    analogy: { lead: "Say “", sound: "hah", tail: ".”" },
    mnemonic: {
      lead: "Throw your head back and laugh: “",
      sound: "ha-ha-ha",
      tail: "!”",
    },
    example: { word: "はな", reading: "hana", gloss: "flower", hitIndex: 0 },
    draft: true,
  },

  ひ: {
    glyph: "ひ",
    romaji: "hi",
    sound: "hee",
    object: "a heel",
    analogy: { lead: "Like the vowel in ", sound: "heel", tail: "." },
    mnemonic: {
      lead: "A bare foot — the ",
      sound: "heel",
      tail: " juts out at the back, just like ひ.",
    },
    example: { word: "ひと", reading: "hito", gloss: "person", hitIndex: 0 },
    draft: true,
  },

  ふ: {
    glyph: "ふ",
    romaji: "fu",
    sound: "fu",
    object: "Mount Fuji",
    analogy: { lead: "A soft ", sound: "fu", tail: " — “foo,” halfway between English f and h." },
    mnemonic: {
      lead: "Climb ",
      sound: "Fu",
      tail: "ji — the peak with clouds drifting past its slopes.",
    },
    example: { word: "ふね", reading: "fune", gloss: "boat", hitIndex: 0 },
    approximate: "Not a hard English “f” — a soft breath between f and h. The 🔊 clip is the guide.",
    draft: true,
  },

  へ: {
    glyph: "へ",
    romaji: "he",
    sound: "he",
    object: "a mountain peak",
    analogy: { lead: "Sounds like the start of ", sound: "Helens", tail: "." },
    mnemonic: {
      lead: "A single mountain peak — Mount St. ",
      sound: "Helens",
      tail: " — へ.",
    },
    example: { word: "へや", reading: "heya", gloss: "room", hitIndex: 0 },
    draft: true,
  },

  ほ: {
    glyph: "ほ",
    romaji: "ho",
    sound: "ho",
    object: "a home",
    analogy: { lead: "Sounds like the start of ", sound: "home", tail: "." },
    mnemonic: {
      lead: "A little ",
      sound: "home",
      tail: " with a wall and a chimney — ほ.",
    },
    example: { word: "ほし", reading: "hoshi", gloss: "star", hitIndex: 0 },
    draft: true,
  },

  // ---- M row — ま み む め も (DRAFT) -----------------------------------
  ま: {
    glyph: "ま",
    romaji: "ma",
    sound: "ma",
    object: "horseshoe magnet",
    analogy: { lead: "Say “", sound: "mah", tail: ".”" },
    mnemonic: {
      lead: "",
      sound: "Ma",
      tail: "ma’s magnet snaps it up — two poles up top, a U-base below.",
    },
    example: { word: "まど", reading: "mado", gloss: "window", hitIndex: 0 },
    draft: true,
  },

  み: {
    glyph: "み",
    romaji: "mi",
    sound: "mi",
    object: "a musical note",
    analogy: { lead: "Say “", sound: "mi", tail: ",” the note — you say it “mee.”" },
    mnemonic: {
      lead: "A musical note — the ",
      sound: "mi",
      tail: " in do-re-mi — み.",
    },
    example: { word: "みみ", reading: "mimi", gloss: "ear", hitIndex: 0 },
    draft: true,
  },

  む: {
    glyph: "む",
    romaji: "mu",
    sound: "moo",
    object: "a cow",
    analogy: { lead: "Sounds like a cow's ", sound: "moo", tail: "." },
    mnemonic: {
      lead: "A cow swishes its tail and lows, ",
      sound: "moo",
      tail: " — む.",
    },
    example: { word: "むし", reading: "mushi", gloss: "insect", hitIndex: 0 },
    draft: true,
  },

  め: {
    glyph: "め",
    romaji: "me",
    sound: "me",
    object: "eye",
    analogy: { lead: "Say “", sound: "meh", tail: ".”" },
    mnemonic: {
      lead: "A ",
      sound: "me",
      tail: "lon-round eye winks — lid and lashes above, the eyeball below. (め even means “eye.”)",
    },
    example: { word: "め", reading: "me", gloss: "eye", hitIndex: 0 },
    draft: true,
  },

  も: {
    glyph: "も",
    romaji: "mo",
    sound: "mo",
    object: "a fishhook",
    analogy: { lead: "Sounds like ", sound: "more", tail: "." },
    mnemonic: {
      lead: "A fishhook baited with two worms — the ",
      sound: "more",
      tail: " worms, the more fish — も.",
    },
    example: { word: "もり", reading: "mori", gloss: "forest", hitIndex: 0 },
    draft: true,
  },

  // ---- Y row — や ゆ よ (DRAFT) -----------------------------------------
  や: {
    glyph: "や",
    romaji: "ya",
    sound: "ya",
    object: "a yacht",
    analogy: { lead: "Sounds like the start of ", sound: "yacht", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "yacht",
      tail: ", mast up and sail full — や.",
    },
    example: { word: "やま", reading: "yama", gloss: "mountain", hitIndex: 0 },
    draft: true,
  },

  ゆ: {
    glyph: "ゆ",
    romaji: "yu",
    sound: "uni",
    object: "a unique fish",
    analogy: { lead: "Sounds like the start of ", sound: "unique", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "unique",
      tail: " fish, its long tail looping back — ゆ.",
    },
    example: { word: "ゆき", reading: "yuki", gloss: "snow", hitIndex: 0 },
    draft: true,
  },

  よ: {
    glyph: "よ",
    romaji: "yo",
    sound: "yo",
    object: "\"yo\"",
    analogy: { lead: "Sounds like ", sound: "yo", tail: "." },
    mnemonic: {
      lead: "It even reads like the word ",
      sound: "yo",
      tail: " — よ.",
    },
    example: { word: "よる", reading: "yoru", gloss: "night", hitIndex: 0 },
    draft: true,
  },

  // ---- R row — ら り る れ ろ (DRAFT — a single soft TAP, between r/l/d) --
  ら: {
    glyph: "ら",
    romaji: "ra",
    sound: "ra",
    object: "a rabbit",
    analogy: { lead: "Sounds like the start of ", sound: "rabbit", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "rabbit",
      tail: " sits up, ears pricked forward — ら.",
    },
    example: { word: "さくら", reading: "sakura", gloss: "cherry blossom", hitIndex: 2 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The 🔊 clip is the target.",
    draft: true,
  },

  り: {
    glyph: "り",
    romaji: "ri",
    sound: "ree",
    object: "reeds",
    analogy: { lead: "Sounds like ", sound: "reeds", tail: "." },
    mnemonic: {
      lead: "Two ",
      sound: "reeds",
      tail: " standing side by side in the water — り.",
    },
    example: { word: "りんご", reading: "ringo", gloss: "apple", hitIndex: 0 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The 🔊 clip is the target.",
    draft: true,
  },

  る: {
    glyph: "る",
    romaji: "ru",
    sound: "rou",
    object: "a looping road",
    analogy: { lead: "Sounds like ", sound: "route", tail: "." },
    mnemonic: {
      lead: "The ",
      sound: "route",
      tail: " drops down and curls into a loop — る.",
    },
    example: { word: "くるま", reading: "kuruma", gloss: "car", hitIndex: 1 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The 🔊 clip is the target.",
    draft: true,
  },

  れ: {
    glyph: "れ",
    romaji: "re",
    sound: "re",
    object: "someone retching",
    analogy: { lead: "Sounds like the start of ", sound: "retching", tail: "." },
    mnemonic: {
      lead: "A person doubled over the toilet, ",
      sound: "retching",
      tail: " — れ.",
    },
    example: { word: "きれい", reading: "kirei", gloss: "pretty", hitIndex: 1 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The 🔊 clip is the target.",
    draft: true,
  },

  ろ: {
    glyph: "ろ",
    romaji: "ro",
    sound: "ro",
    object: "a winding road",
    analogy: { lead: "Sounds like ", sound: "road", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "road",
      tail: " winding down and bending back — ろ (the open bend; る adds the full loop).",
    },
    example: { word: "ろく", reading: "roku", gloss: "six", hitIndex: 0 },
    approximate: "A single soft tap of the tongue — not a hard English “r.” The 🔊 clip is the target.",
    draft: true,
  },

  // ---- W row + ん — わ を ん (DRAFT) ------------------------------------
  わ: {
    glyph: "わ",
    romaji: "wa",
    sound: "wa",
    object: "someone waving",
    analogy: { lead: "Sounds like the start of ", sound: "waving", tail: "." },
    mnemonic: {
      lead: "A person ",
      sound: "waving",
      tail: " one arm high — わ.",
    },
    example: { word: "わたし", reading: "watashi", gloss: "I / me", hitIndex: 0 },
    draft: true,
  },

  を: {
    glyph: "を",
    romaji: "wo",
    sound: "wo",
    object: "a wok",
    analogy: { lead: "Sounds like ", sound: "wok", tail: "." },
    mnemonic: {
      lead: "A ",
      sound: "wok",
      tail: " tossing food up in an arc — を.",
    },
    example: { word: "パンを", reading: "pan o", gloss: "bread [object]", hitIndex: 2 },
    approximate: "The object particle — attaches to a noun (パンを食べる, “eat bread”) and sounds exactly like お.",
    draft: true,
  },

  ん: {
    glyph: "ん",
    romaji: "n",
    sound: "n",
    object: "the letter n",
    analogy: { lead: "Sounds like the letter ", sound: "n", tail: "." },
    mnemonic: {
      lead: "It even looks like a lowercase ",
      sound: "n",
      tail: " — ん.",
    },
    example: { word: "ほん", reading: "hon", gloss: "book", hitIndex: 1 },
    approximate: "One held beat of nasal — its exact colour (m / n / ng) bends to what follows. Trust the 🔊 clip.",
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
