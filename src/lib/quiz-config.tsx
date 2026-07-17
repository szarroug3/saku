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

import { CHAR_INDEX } from "@/data/characters";
import { JP_FONTS } from "@/lib/config";
import type { QuizConfig } from "@/types";

const STORAGE_KEY = "kanaquiz-cfg";

export function defaultConfig(): QuizConfig {
  const enabled: Record<string, boolean> = {};
  for (const c of Object.keys(CHAR_INDEX)) enabled[c] = true;
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
    // The user's own numbers. Two settings, not a rule — see QuizConfig.
    restFirstMin: 5,
    restThenMin: 10,
    showStreak: true,
    showAccuracy: true,
    showRetryPips: true,
    fadeControls: true,
    enabled,
  };
}

function loadConfig(): QuizConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.enabled) {
      const cfg: QuizConfig = { ...defaultConfig(), ...saved };
      // Migrate the pre-fonts shape: randomFont true → all fonts, false →
      // just the first (the legacy app always rendered JP_FONTS[0] then).
      if (!Array.isArray(cfg.fonts) || !cfg.fonts.length) {
        cfg.fonts = saved.randomFont === false ? [JP_FONTS[0]] : [...JP_FONTS];
      }
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

/** Chars currently enabled in the picker. */
export function selectedChars(cfg: QuizConfig): string[] {
  return Object.keys(CHAR_INDEX).filter((c) => cfg.enabled[c]);
}
