// Shared types for the kana quiz. The history.json shapes must stay
// byte-compatible with what the legacy Python app wrote.

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

/** Matches the legacy per-char stat object stored in session `detail`. */
export interface CharSessionDetail {
  seen: number;
  misses: number;
  everCorrect: boolean;
  firstTryCorrect: boolean | null;
  slow: number;
  /** other char → times confused with it */
  confused: Record<string, number>;
}

export type SessionStats = Record<string, CharSessionDetail>;

// ---------- history.json shapes (must match legacy exactly) ----------

export interface CharAggregate {
  /** Times the character was shown as a question. */
  seen: number;
  /** Wrong ATTEMPTS — can exceed `seen`, since one showing allows retries. */
  missed: number;
  slow: number;
  /** Times answered correctly on the first attempt. `firstTry / seen` is the
   * strict accuracy; `seen / (seen + missed)` is the forgiving one. */
  firstTry: number;
}

export interface QuizSessionRecord {
  ts: number;
  mode: QuizMode;
  redrill: boolean;
  total: number;
  forgivingPct: number;
  strictPct: number;
  chars: Record<string, CharAggregate>;
  /** Full per-char detail; absent on sessions saved by very old versions. */
  detail?: SessionStats;
}

export interface HistoryFile {
  sessions: QuizSessionRecord[];
  chars: Record<string, CharAggregate>;
}
