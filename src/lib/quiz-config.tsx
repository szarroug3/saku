"use client";

// Quiz configuration context — persisted to localStorage under
// "kanaquiz-cfg", same key and shape as the legacy app so existing
// selections survive the conversion.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { JP_FONTS } from "@/lib/config";
// The DATA-FREE seed modules, not kanji-lesson/word-lesson/selection: this
// provider is mounted in the root layout on every route, and those modules
// top-level import the kanji+vocab curricula and the fact registry. Seeding a
// config needs only these pure defaults/clamps.
import {
  LESSON_RANGE_DEFAULT,
  clampLessonRange,
  WORDS_PER_LESSON_DEFAULT,
  clampWordsPerLesson,
} from "@/lib/lesson-sizing";
import { emptySelection } from "@/lib/selection-empty";
import type { QuizConfig } from "@/types";

const STORAGE_KEY = "kanaquiz-cfg";

export function defaultConfig(): QuizConfig {
  return {
    mode: "drill",
    dirs: { jp2en: true, en2jp: false },
    styleJp2en: "typed",
    styleEn2jp: "mc",
    length: "endless",
    limType: "cov",
    limCount: 50,
    retries: "lim",
    retryN: 2,
    timer: false,
    timerSec: 10,
    showAnswer: true,
    scriptLabel: true,
    fonts: [...JP_FONTS],
    blurSubmit: false,
    voiceName: "",
    accuracyMetric: "firstTry",
    showVolume: true,
    graduateRuns: 10,
    slowFloorMs: 1500,
    // Dominates grade order on both axes at once — see NewKanjiOrder.
    newKanjiOrder: "everyday",
    // How long a kanji lesson runs, in draw+assembly cost — see LessonRange.
    lessonMinCost: LESSON_RANGE_DEFAULT.min,
    lessonMaxCost: LESSON_RANGE_DEFAULT.max,
    // How many new words a word lesson teaches — a count, not a cost.
    wordsPerLesson: WORDS_PER_LESSON_DEFAULT,
    // The user's own numbers. Two settings, not a rule — see QuizConfig.
    restFirstMin: 5,
    restThenMin: 10,
    showStreak: true,
    showAccuracy: true,
    showRetryPips: true,
    fadeControls: true,
    // Everything, on day one. An empty query narrows nothing, which is both the
    // honest default and — unlike the 214-key map this replaced — a default
    // that costs six fields no matter how much material the app grows.
    selection: emptySelection(),
  };
}

function loadConfig(): QuizConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const cfg: QuizConfig = { ...defaultConfig(), ...saved };
      // Migrate the pre-fonts shape: randomFont true → all fonts, false →
      // just the first (the legacy app always rendered JP_FONTS[0] then).
      if (!Array.isArray(cfg.fonts) || !cfg.fonts.length) {
        cfg.fonts = saved.randomFont === false ? [JP_FONTS[0]] : [...JP_FONTS];
      }
      // A stored `enabled` map is from before selection was a query. It is not
      // migrated and none is owed: those keys were CHARACTERS, and a character
      // is not a selection — the same reasoning history.ts applied to its own
      // rekey. Dropping it lands you on Everything, which is where a new user
      // starts anyway.
      if (!cfg.selection || typeof cfg.selection !== "object") {
        cfg.selection = emptySelection();
      } else {
        // A partial/older selection object still has to answer every field, or
        // resolve() reads undefined and returns nothing while the UI insists
        // something is selected.
        cfg.selection = { ...emptySelection(), ...cfg.selection };
      }
      // The second of the two enforcement points for the lesson range (the
      // Settings control is the first): a stored max below min — from an older
      // build, a hand edit, or a corrupt write — is pinned back here before it
      // can reach a packer that has no defined behaviour for it.
      const range = clampLessonRange(cfg.lessonMinCost, cfg.lessonMaxCost);
      cfg.lessonMinCost = range.min;
      cfg.lessonMaxCost = range.max;
      // Same guard for the word lesson size: a stored/hand-edited value is
      // pinned to a sane whole count before it reaches nextWordLesson.
      cfg.wordsPerLesson = clampWordsPerLesson(cfg.wordsPerLesson);
      return cfg;
    }
  } catch {
    // corrupt storage — fall through to defaults
  }
  return defaultConfig();
}

interface QuizConfigContextValue {
  cfg: QuizConfig;
  /** Merge a partial update into the config and persist it. */
  update(patch: Partial<QuizConfig>): void;
  /** Functional update for enabled-map edits and other derived changes. */
  set(fn: (prev: QuizConfig) => QuizConfig): void;
  /** False during SSR/first paint, true once localStorage has been read. */
  ready: boolean;
}

const QuizConfigContext = createContext<QuizConfigContextValue | null>(null);

export function QuizConfigProvider({ children }: { children: ReactNode }) {
  // Start from defaults on both server and client, then hydrate from
  // localStorage after mount to avoid SSR/client markup mismatches.
  const [cfg, setCfg] = useState<QuizConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // One-time localStorage hydration must run post-mount (SSR can't read it)
    // and set state synchronously so the real cfg paints in the same pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCfg(loadConfig());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }, [cfg, ready]);

  const set = useCallback(
    (fn: (prev: QuizConfig) => QuizConfig) => setCfg(fn),
    [],
  );
  const update = useCallback(
    (patch: Partial<QuizConfig>) => setCfg((prev) => ({ ...prev, ...patch })),
    [],
  );

  const value = useMemo(
    () => ({ cfg, update, set, ready }),
    [cfg, update, set, ready],
  );
  return (
    <QuizConfigContext.Provider value={value}>
      {children}
    </QuizConfigContext.Provider>
  );
}

export function useQuizConfig(): QuizConfigContextValue {
  const ctx = useContext(QuizConfigContext);
  if (!ctx) throw new Error("useQuizConfig outside QuizConfigProvider");
  return ctx;
}
