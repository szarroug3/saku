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
  kanaPreview: boolean;
  /** JP fonts to draw from per card — more than one selected = randomized. */
  fonts: string[];
  blurSubmit: boolean;
  voiceName: string;
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
  seen: number;
  missed: number;
  slow: number;
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
