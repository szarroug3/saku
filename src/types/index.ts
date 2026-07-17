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
  /** Per-character selection map: char → enabled. */
  enabled: Record<string, boolean>;
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
 * What you have DONE with a fact — counts, and nothing but counts.
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
 * EVERY FIELD IS A COUNT, which is exactly what makes this type poolable: add
 * two of them and you have counted a real, larger population of showings. That
 * is why it is its own type rather than part of FactAggregate — see FactState.
 */
export interface FactCounts {
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

/**
 * What the ranking model BELIEVES about one fact — its entire input, and the
 * whole memory of src/lib/scoring.ts.
 *
 * NOT POOLABLE, and that is why it is a separate type from FactCounts. Counts
 * sum; a belief does not. "The stability of hiragana basic" is not a quantity —
 * you hold 71 separate predictions, and adding them up answers nothing. This is
 * the same trap as an entry's accuracy in src/lib/accuracy.ts, one level down,
 * and it is closed the same way: `totalFor` returns FactCounts, so a pooled
 * thing has no `stability` field to read and reaching for one is a compile
 * error rather than a plausible number.
 *
 * NEVER RENDER EITHER FIELD. The user asked, of a real stability figure, "does
 * stability 106d mean I did that 106 days in a row?" — and that reading is the
 * honest one for anything a study app puts on screen next to a character. It is
 * a PREDICTION that reads as a HISTORY, and no caption fixes that. These two
 * numbers exist to order a list. The order is the only thing the user sees.
 */
export interface FactState {
  /**
   * Days until predicted recall of this fact falls to ~37% (1/e).
   *
   * A duration, not a due date. The distinction is the reason this app has its
   * own model at all: a due date is a promise the app cannot keep and the user
   * can fail, and it turns a study session into a debt. A stability is just how
   * fast the app's confidence decays, and it is only ever read as an ORDER.
   */
  stability: number;
  /**
   * ms epoch of the last session that tested this fact; 0 = never tested.
   *
   * WRITTEN ONLY BY EVIDENCE — a session you actually answered, at that
   * session's own timestamp. Nothing else may touch it. If browsing a chart, or
   * opening a screen, or the passage of time could write here, then the model's
   * clock would measure app usage rather than your memory, and `elapsedDays`
   * would silently stop meaning what its name says.
   */
  lastTested: number;
}

/**
 * One fact's stored record: what you did (counts) and what the model believes
 * (state). The key (a FactId) lives in the record that holds this, so the
 * aggregate itself carries no identity.
 *
 * The two halves are folded from the same evidence, in one place —
 * src/lib/aggregate.ts — but they are not the same KIND of thing, and the split
 * above is what keeps the difference from being a comment.
 */
export interface FactAggregate extends FactCounts, FactState {}

export interface QuizSessionRecord {
  ts: number;
  mode: QuizMode;
  redrill: boolean;
  total: number;
  forgivingPct: number;
  strictPct: number;
  /**
   * What this run did, per fact. COUNTS, not aggregates — a session carries
   * EVIDENCE and never belief.
   *
   * A session has no `stability`: stability is not a thing that happened to
   * you on Tuesday, it is what the model concluded from every Tuesday so far,
   * and it exists only in the fold (src/lib/aggregate.ts). Nor a `lastTested`
   * — the session already has `ts`, which is the same fact stated once. Giving
   * a session a state field would invite exactly one bug, and it is the bad
   * one: some future writer stamping a stability here from a live clock, and
   * the replay in deleteSessions then disagreeing with the incremental fold in
   * saveSession about what the same file means.
   */
  facts: Record<FactId, FactCounts>;
  /** Full per-fact detail; absent on summary-only sessions. */
  detail?: SessionStats;
}

export interface HistoryFile {
  sessions: QuizSessionRecord[];
  /**
   * Per FACT: lifetime counts, and what the model believes. Was `chars`, keyed
   * by the character itself — which gave 生 one accuracy slot for eleven
   * readings.
   *
   * DERIVED, entirely, from `sessions` — src/lib/aggregate.ts is the fold, and
   * the only writer. It is stored rather than recomputed on read because
   * saveSession folds incrementally and the 200-session cap means the sessions
   * no longer say everything the aggregate knows.
   */
  facts: Record<FactId, FactAggregate>;
}
