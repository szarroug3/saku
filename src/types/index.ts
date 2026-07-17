// Shared types for the kana quiz.

// ---------- identity: entries and facts ----------
//
// A character string used to be three things at once: the identity, the
// display glyph, and the primary key. For 214 kana that is elegant. It breaks
// on kanji — and not on collisions, on GRANULARITY.
//
// `history.chars["生"]` held exactly ONE accuracy. 生 has ~11 readings. There
// was nowhere to put セイ-at-88% and ショウ-at-22%, so the app would report
// "生: 61%" — a number true of nothing — and then drill the reading you
// already own.
//
// So identity splits in two:
//
//   Entry — what you look up.  `kanji:生`, `word:先生`, `kana:し`.
//   Fact  — one thing you can be ASKED. 生 is 1 meaning + ~10 readings, each
//           reading keyed on (kanji, word) — never on the kanji alone, because
//           "what is the reading of 生" has eleven answers and cannot be graded.
//
// Facts key history, score accuracy, and feed drills. Entries are what you
// browse, and what confusions are paired by (you mix up 生 and 先, not one of
// 生's readings with one of 先's).
//
// BOTH IDS ARE OPAQUE. The grammar above is illustrative, not an API: ids are
// minted in src/lib/fact-id.ts and resolved by lookup in src/lib/facts.ts.
// Nothing else may parse one. The moment a call site does
// `id.startsWith("kana:")` the model is welded shut, and kanji / vocabulary /
// grammar / counters / whatever comes next becomes a special case instead of
// another row of data.
//
// The brands are load-bearing, in both directions:
//   - `Record<FactId, T>` will NOT accept a bare `string` index. Reaching into
//     history or a run's stats with an un-narrowed string is a compile error.
//   - a function taking `FactId[]` will not accept `EntryId[]`, or vice versa.
// `Object.keys()` still widens back to `string[]`; src/lib/facts.ts `factKeys`
// / `entryKeys` are the sanctioned places to restore the brand, so the cast is
// spelled in one file rather than at every walk.

declare const ENTRY_BRAND: unique symbol;
declare const FACT_BRAND: unique symbol;

/** What you look up. Opaque — mint with src/lib/fact-id.ts, resolve with
 * src/lib/facts.ts. Never parse one. */
export type EntryId = string & { readonly [ENTRY_BRAND]: true };

/** One askable thing — the unit history, accuracy and drilling are keyed by.
 * Opaque; see EntryId. */
export type FactId = string & { readonly [FACT_BRAND]: true };

/**
 * What a generic consumer is allowed to know about a fact.
 *
 * Subject-agnostic on purpose: a screen renders `glyph` and checks `answers`
 * without knowing whether it is looking at kana, a kanji reading, or a
 * conjugation.
 *
 * Deliberately THIN. Everything a subject knows about its own material —
 * kana's script and row, its mnemonics, a kanji's radicals — stays in that
 * subject's module (src/data/characters.ts and CHAR_INDEX, for kana) and is
 * read by that subject's own screens. Fields get promoted here when something
 * generic needs them, not in anticipation.
 */
export interface FactInfo {
  readonly id: FactId;
  /** The entry this fact belongs to. One entry, many facts. */
  readonly entry: EntryId;
  /** What the entry looks like on screen — し, 生, 先生. DISPLAY ONLY: it is
   * not an identity and two entries may legitimately share one. */
  readonly glyph: string;
  /** Accepted answers; the first is the canonical one to display. */
  readonly answers: readonly string[];
  /** Which subject minted this — "kana" today. Carried so that nobody has to
   * infer a subject by parsing an id. */
  readonly subject: string;
  readonly meaning: string | null;
}

// ---------- character data ----------

export interface KanaChar {
  /** The Japanese character (or multi-char combo / word). */
  c: string;
  /** Accepted answers — first entry is the canonical display romaji. */
  r: string[];
  /** Mnemonic, shown in the Kana chart. */
  m?: string;
  /** Reserved for future sets (vocab). */
  meaning?: string;
  /** Reserved for the v3 stroke-order / draw modes. */
  strokes?: unknown;
  /** Reserved for the v2 listen mode. */
  audio?: string;
}

export interface CharSection {
  id: string;
  label: string;
  chars: KanaChar[];
}

export interface CharSet {
  id: string;
  label: string;
  labelJa: string;
  sections: CharSection[];
}

/** Flattened per-character lookup entry (charIndex in the legacy app). */
export interface CharInfo {
  c: string;
  r: string[];
  set: string;
  setLabel: string;
  sec: string;
  secLabel: string;
  meaning: string | null;
}

// ---------- quiz config (localStorage "kanaquiz-cfg") ----------

export type QuizMode = "drill" | "pairs" | "grid";
export type Direction = "jp2en" | "en2jp";
export type AnswerStyle = "typed" | "mc";

/** Which accuracy number every screen shows — the same forgiving/strict split
 * the results screen already offers, hoisted to a global preference.
 * firstTry = nailed it immediately · attempt = share of attempts correct. */
export type AccuracyMetric = "firstTry" | "attempt";

export interface QuizConfig {
  mode: QuizMode;
  dirs: { jp2en: boolean; en2jp: boolean };
  styleJp2en: AnswerStyle;
  styleEn2jp: AnswerStyle;
  length: "endless" | "limited";
  limType: "cov" | "count";
  limCount: number;
  retries: "none" | "lim" | "unl";
  retryN: number;
  timer: boolean;
  timerSec: number;
  showAnswer: boolean;
  scriptLabel: boolean;
  /** JP fonts to draw from per card — more than one selected = randomized. */
  fonts: string[];
  blurSubmit: boolean;
  voiceName: string;

  // ---------- what the numbers mean (used everywhere) ----------
  /** Drives the drill HUD pill, the Home deck rings, and the picker circles. */
  accuracyMetric: AccuracyMetric;
  /** Show practice volume next to accuracy, so 88%-from-4-tries can't lie. */
  showVolume: boolean;
  /**
   * Clean runs needed to clear a confusion — after this, its old misses stop
   * feeding Patterns, Home's Confusions card, and Weakest 20. Counts only runs
   * that actually contained the pair's characters. Fast learners want this
   * lower; it is a judgement call, not a fact, so it is yours to set.
   */
  graduateRuns: number;
  /**
   * Never flag a hesitation faster than this, however consistent you get.
   * The slow threshold is max(slowFloorMs, median + 3·MAD) over your recent
   * recall latencies — without a floor, a very fast, very steady run would
   * start flagging 1.6s answers as "slow", which means nothing.
   */
  slowFloorMs: number;

  // ---------- drill HUD (all off = zen, all on = instrumented) ----------
  showStreak: boolean;
  showAccuracy: boolean;
  showRetryPips: boolean;
  /** Fade End quiz / gear while drilling; they wake on mouse move. */
  fadeControls: boolean;
  /** What you are about to drill. See Selection — this replaced `enabled`, a
   * char→bool map with one key per selectable thing. */
  selection: Selection;
}

// ---------- selection: a query, not a set ----------

/**
 * WHAT YOU ARE ABOUT TO DRILL, as a QUESTION rather than as an answer.
 *
 * This replaced `QuizConfig.enabled: Record<string, boolean>` — one key per
 * selectable thing, persisted in full to localStorage. That model has two
 * deaths, and only one of them is technical:
 *
 *   - 214 keys is 4KB. 21,449 is 400KB+, rewritten on every single toggle.
 *   - "Tick what to drill" stops being a gesture anyone can make at 21,449
 *     items. Nobody ticks 21,449 checkboxes. The grid that made kana feel
 *     direct makes kanji feel impossible.
 *
 * So selection stopped being a stored SET and became a stored QUESTION, which
 * is a fixed handful of fields no matter how much material exists. A deck is
 * what you get when you press Drill on a filter.
 *
 * Every field NARROWS: an empty Selection means everything, and each populated
 * field intersects with the others. `resolve()` in src/lib/selection.ts is the
 * only thing that turns one of these into facts, and it is pure.
 */
export interface Selection {
  /** Subject ids to draw from ("kana", "kanji", "word"). Empty = all of them. */
  subjects: string[];
  /** A saved list's id, or null for "not restricted to a list". */
  list: string | null;
  /** Bands to include, OR-ed together — a fact is in if it matches ANY of
   * them. Empty = no state filter. NOT a partition: `mixup` overlaps the
   * others, which is exactly why this is a set and not one value. */
  states: FactState[];
  /** Free text matched against glyph, answers and meaning. Empty = no filter. */
  text: string;
  /**
   * Only facts that appeared in the session with this timestamp; null = no
   * restriction.
   *
   * This is the field that makes Rerun free. A past session is a named list of
   * keys like any other source, so "run that again" is not a feature with its
   * own button and its own code path — it is Drill on a slice, and it comes out
   * of the same resolve() as everything else.
   */
  session: number | null;
  /** Cap on how many facts come back, hardest first; null = all of them. */
  limit: number | null;
}

/**
 * How well you know something, as a WORD — the only vocabulary the UI has for
 * this.
 *
 * The user never sees "stability", "p", "weakness" or "fact". They see New,
 * Shaky, Slipping, Solid and Mix-ups, because those are things a person can
 * mean. The mapping from numbers to these words lives in ONE function
 * (`stateOf` in src/lib/selection.ts) so that when real scheduling lands it
 * changes there and nowhere else.
 */
export type FactState = "new" | "shaky" | "slipping" | "solid" | "mixup";

/**
 * A named list of things to drill. ONE OBJECT, FOUR SOURCES: an imported file,
 * a saved search, a past session, a built-in shelf. All of them are a name and
 * a way to get keys, and everything downstream — the sidebar, the drill bar,
 * resolve() — treats them identically.
 *
 * EXCEPT AT ONE MOMENT, and this is a real hole rather than a tidy-up. The
 * "one object" claim is true for READING a list and false for WRITING to one:
 *
 *   You CAN add か to "Core 2k". Core 2k is a fixed set of words; adding to it
 *   means the set now has か in it, forever, and that is the whole of what
 *   happened.
 *
 *   You CANNOT add か to "Kanji I miss". That is not a set, it is a RULE that
 *   recomputes every time you look at it. A hand-added item would either vanish
 *   the next time the rule ran, or silently freeze your live search into a
 *   frozen list without telling you. Both are lies.
 *
 * So there are two kinds, and the split is exactly "does a person or a rule
 * decide what is in it". Derived lists are simply not offered for writing —
 * they are one object with fixed lists everywhere else.
 */
export type SavedList =
  | {
      kind: "fixed";
      id: string;
      name: string;
      created: number;
      /** The set. ENTRIES, not facts: you file 生, not one of its readings. */
      entries: EntryId[];
      origin: "import" | "manual";
    }
  | {
      kind: "derived";
      id: string;
      name: string;
      created: number;
      /** The rule. Re-resolved on every read, which is why you cannot add to it. */
      query: Selection;
      origin: "search" | "session";
    };

export interface ListsFile {
  lists: SavedList[];
}

// ---------- per-session stats (in-memory during a quiz) ----------

/** One fact's stats for one run. Keyed by FactId — see SessionStats. */
export interface FactSessionDetail {
  seen: number;
  misses: number;
  /** Did you land it at ALL this session — a yes/no over the whole run, which
   * the results boards ask ("never got it"). Not the same question as
   * `correct`, which counts how many of the showings you landed. */
  everCorrect: boolean;
  firstTryCorrect: boolean | null;
  /**
   * SHOWINGS answered correctly this session — folds into FactAggregate.correct
   * and so into forgiving accuracy. Not the same question as `everCorrect`.
   */
  correct: number;
  slow: number;
  /**
   * ENTRY you answered with instead → how many times. Keyed by EntryId, NOT
   * FactId, and that is the whole point: you mix up 生 with 先, not 生's
   * ON-reading-in-学生 with one of 先's readings. A confusion is a failure to
   * tell two things apart, and the things are entries.
   *
   * So this map and the map that contains it live in DIFFERENT key spaces.
   * Anything that reads across them must convert explicitly — see
   * `qualifies()` in src/lib/confusions.ts, whose signature exists to make that
   * conversion impossible to forget.
   */
  confused: Record<EntryId, number>;
}

/** One run's detail, keyed by FACT — the unit that can actually be graded. */
export type SessionStats = Record<FactId, FactSessionDetail>;

// ---------- history.json shapes ----------

/**
 * One fact's lifetime totals. The key (a FactId) lives in the record that holds
 * this, so the aggregate itself carries no identity.
 *
 * Two units live here and must not be confused: `seen`, `firstTry` and
 * `correct` count SHOWINGS (the fact put on screen as a question), while
 * `missed` counts ATTEMPTS (one showing can produce several, so `missed` may
 * exceed `seen`).
 *
 * Both accuracies divide by `seen`, so they answer the same question about the
 * same population and only differ in what counts as a pass:
 *   strict    = firstTry / seen
 *   forgiving = correct  / seen
 *
 * `stability` and `lastTested` land here next; nothing below depends on this
 * field list being closed.
 */
export interface FactAggregate {
  /** Times the fact was shown as a question. SHOWINGS. */
  seen: number;
  /** Wrong ATTEMPTS — can exceed `seen`, since one showing allows retries. */
  missed: number;
  slow: number;
  /** SHOWINGS answered correctly on the first attempt — the strict numerator. */
  firstTry: number;
  /**
   * SHOWINGS that ended in a correct answer, first try or after retries — the
   * forgiving numerator. A showing that ended with no correct answer (you ran
   * out of retries, ended the quiz early, or left a grid card blank) counts 0,
   * so it reads as never right rather than as a pass. The forgiving metric used
   * to be `seen / (seen + missed)`, which scored an unanswered showing 100%.
   */
  correct: number;
}

export interface QuizSessionRecord {
  ts: number;
  mode: QuizMode;
  redrill: boolean;
  total: number;
  forgivingPct: number;
  strictPct: number;
  facts: Record<FactId, FactAggregate>;
  /** Full per-fact detail; absent on summary-only sessions. */
  detail?: SessionStats;
}

export interface HistoryFile {
  sessions: QuizSessionRecord[];
  /** Lifetime totals per FACT. Was `chars`, keyed by the character itself —
   * which gave 生 one accuracy slot for eleven readings. */
  facts: Record<FactId, FactAggregate>;
}
