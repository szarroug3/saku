"use client";

// Quiz configuration context — persisted to localStorage under "saku-cfg" (a
// legacy "kanaquiz-cfg" value is migrated forward on first read), and mirrored to
// the server as the `cfg` field of the settings blob (the source of truth). The
// shape is unchanged from the legacy app so existing selections survive.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { JP_FONTS } from "@/lib/config";
import { CFG_KEY, OLD_CFG_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { migratedGet } from "@/lib/storage-migrate";
import { useSettings } from "@/lib/use-settings";
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
import {
  allGridResponses,
  allPairResponses,
  askFromInput,
  deriveInput,
} from "@/lib/ask-config";
import type { QuizConfig } from "@/types";

export function defaultConfig(): QuizConfig {
  return {
    mode: "drill",
    pairResponses: ["definition", "romaji", "sentence"],
    gridResponses: ["definition", "romaji"],
    // The one user-facing input axis. `ask` is DERIVED from it (see
    // askFromInput / normalizeConfig) — everything else about how to ask is
    // automatic and always-on. "text" is the safe default: no surprise audio for
    // a beginner who may have no TTS voice installed.
    input: "text",
    ask: askFromInput("text"),
    length: "limited",
    limType: "cov",
    limCount: 50,
    // Missed cards come back later in the run, by default.
    requeue: true,
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
    // Deliberately no `dirs` / `styleJp2en` / `styleEn2jp` / `listenRomaji` /
    // `listenMeaning` here — they were replaced by `ask` above and are migrated
    // forward from any saved config in normalizeConfig.
    // Everything, on day one. An empty query narrows nothing, which is both the
    // honest default and — unlike the 214-key map this replaced — a default
    // that costs six fields no matter how much material the app grows.
    selection: emptySelection(),
  };
}

/** Coerce a parsed/stored config object (from localStorage OR the server) into a
 * full, clamped QuizConfig. Anything that is not an object — or nothing at all —
 * is the default config. Shared by the local-cache read and the server reconcile
 * so both land on exactly the same shape. */
function normalizeConfig(saved: unknown): QuizConfig {
  try {
    if (saved && typeof saved === "object") {
      const raw = saved as Partial<QuizConfig> & { randomFont?: boolean };
      const cfg: QuizConfig = { ...defaultConfig(), ...raw };
      // Product decision: only first-try accuracy is supported.
      cfg.accuracyMetric = "firstTry";
      // Pairs and grid have no per-mode chooser any more: they ALWAYS drill the
      // full relationship / response set, so a stored (possibly narrowed) value
      // is discarded and pinned to the full set here.
      cfg.pairResponses = allPairResponses();
      cfg.gridResponses = allGridResponses();
      // "How to ask" is now a single derived axis. Resolve the user-facing
      // `input` (text/audio/both) from whatever was stored, then REGENERATE
      // `ask` from it — the stored `ask` only matters for this one-time read:
      //   - a new `input` field wins outright;
      //   - else a stored `ask` (task-30 shape) reads its prompt format back;
      //   - else the OLD dirs/styles/listen fields migrate through the same lens;
      //   - else default "text".
      // The old fields are then dropped so they can't shadow the new model.
      const rawObj = raw as Record<string, unknown>;
      // A short-lived build exposed sentence practice as a separate "mixed"
      // mode. Sentences now correctly use the Japanese-sentence source inside
      // Drill, so migrate that saved UI state back to Drill.
      if (rawObj.mode === "mixed") cfg.mode = "drill";
      // Sentence listening used to be a standalone mode; it now folds into the
      // Audio prompt format, so a saved listen-sentence config becomes an audio
      // drill.
      const wasListenSentence = raw.mode === "listen-sentence";
      if (wasListenSentence) cfg.mode = "drill";
      let input = deriveInput(rawObj);
      // A standalone listen-sentence run was audio; fold that in so the audio
      // prompt survives the mode migration.
      if (wasListenSentence && input === "text") input = "audio";
      cfg.input = input;
      cfg.ask = askFromInput(input);
      // Missed cards requeue by default; only an explicit stored false turns it
      // off. Absent (older config) means on.
      cfg.requeue = rawObj.requeue === false ? false : true;
      for (const stale of [
        "dirs",
        "styleJp2en",
        "styleEn2jp",
        "listenRomaji",
        "listenMeaning",
        // Retired setting: the teaching order is always "everyday" now, so a
        // saved newKanjiOrder is dropped rather than carried on the config.
        "newKanjiOrder",
      ]) {
        delete (cfg as unknown as Record<string, unknown>)[stale];
      }
      // Migrate the pre-fonts shape: randomFont true → all fonts, false →
      // just the first (the legacy app always rendered JP_FONTS[0] then).
      if (!Array.isArray(cfg.fonts) || !cfg.fonts.length) {
        cfg.fonts = raw.randomFont === false ? [JP_FONTS[0]] : [...JP_FONTS];
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

/** The config from this browser's localStorage cache — the new `saku-cfg` key,
 * migrated forward from the legacy `kanaquiz-cfg` on first read. */
function loadConfig(): QuizConfig {
  try {
    return normalizeConfig(JSON.parse(migratedGet(localStorage, CFG_KEY, OLD_CFG_KEY) ?? "null"));
  } catch {
    return defaultConfig();
  }
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

  // The server's copy, seeded server-side (see settings-provider). Frozen at mount
  // in a ref: the reconcile below is a one-time "server wins over local cache".
  const { serverSettings } = useSettings();
  const seededServer = useRef(serverSettings);

  useEffect(() => {
    // One-time hydration, post-mount (SSR can't read localStorage). SERVER WINS:
    // if the server has a cfg it is normalized and used (and the write-back below
    // reconciles the local cache to it); otherwise the migrated local cache stands.
    const srvCfg = seededServer.current?.cfg;
    setCfg(srvCfg ? normalizeConfig(srvCfg) : loadConfig());
    setReady(true);
  }, []);

  // The write-back mirrors every change into the localStorage paint cache and,
  // for user changes only, pushes it to the server. The first post-hydration run
  // is the reconcile itself — it seeds the cache but must NOT push, or a value
  // that came DOWN from the server would be echoed straight back up.
  const hydratedOnce = useRef(false);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    if (hydratedOnce.current) pushSettings({ cfg });
    else hydratedOnce.current = true;
  }, [cfg, ready]);

  const set = useCallback(
    (fn: (prev: QuizConfig) => QuizConfig) =>
      setCfg((prev) => ({ ...fn(prev), accuracyMetric: "firstTry" })),
    [],
  );
  const update = useCallback(
    (patch: Partial<QuizConfig>) =>
      setCfg((prev) => ({ ...prev, ...patch, accuracyMetric: "firstTry" })),
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
