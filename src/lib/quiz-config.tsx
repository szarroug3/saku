"use client";

// Quiz configuration context — persisted to localStorage under "saku-cfg" (a
// legacy "kanaquiz-cfg" value is migrated forward on first read), and mirrored to
// the server as the `cfg` field of the settings blob (the source of truth).
//
// The shape used to be the legacy app's whole settings panel. It is what the
// Sky reads now (SAK-373): a stored blob is read field by field, so a key no
// field names is gone the moment the config is next saved.

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
import { DEFAULT_VOICE_ID, isVoiceId } from "@/lib/voice";
import { allGridResponses, allPairResponses, askFromAudioPrompts } from "@/lib/ask-config";
import type { QuizConfig } from "@/types";

export function defaultConfig(): QuizConfig {
  return {
    // Nothing offers another mode: the screens that did went with the old app,
    // so this is "drill" for every learner and is pinned again on every read.
    mode: "drill",
    // No per-mode chooser either. Both always drill the full response set.
    pairResponses: allPairResponses(),
    gridResponses: allGridResponses(),
    // The one user-facing "how to ask" knob, and it lives on Settings. Text is
    // always on; this adds audio. `ask` is DERIVED from it, so it is never read
    // back from storage. Default ON: audio is the richer default, and because
    // text is always present, production cards stay reachable either way.
    audioPrompts: true,
    ask: askFromAudioPrompts(true),
    // SAK-138: a separate knob from audioPrompts (see types/index.ts's doc
    // comment on pitchQuestions). Default ON, same reasoning as audioPrompts.
    pitchQuestions: true,
    length: "limited",
    limType: "cov",
    limCount: 50,
    retries: "lim",
    retryN: 2,
    timer: false,
    timerSec: 10,
    fonts: [...JP_FONTS],
    skyAccent: "pink",
    // The roster's default voice (SAK-98's sole hardcoded pitch voice, kept
    // as the default so an existing learner's pitch clips and cache don't
    // change until they pick differently in Settings — see voice.ts's
    // VOICES). When its bucket isn't configured (voicesEnabled() false) or a
    // clip is missing, speak() falls back to the browser voice, so this is
    // safe even before any audio is cached.
    voiceName: DEFAULT_VOICE_ID,
    graduateRuns: 10,
    // The user's own numbers. Two settings, not a rule — see QuizConfig.
    restFirstMin: 5,
    restThenMin: 10,
  };
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Coerce a parsed/stored config object (from localStorage OR the server) into a
 * full QuizConfig. Anything that is not an object, or nothing at all, is the
 * default config. Shared by the local-cache read and the server reconcile so
 * both land on exactly the same shape.
 *
 * IT READS FIELD BY FIELD, and that is the point (SAK-373). This used to be
 * `{ ...defaultConfig(), ...raw }` plus a list of stale keys to delete
 * afterwards, which meant every key the old app ever stored rode the spread
 * into the object and was written straight back to the server on the next
 * save. Naming what we know is what lets a field leave the model and leave the
 * row: an old blob normalizes to the smaller shape on first read, and the next
 * save is the migration. The `delete` list went with the spread, and so did the
 * migrations it existed for (`dirs`, `styleJp2en`, the two `listen*`, the
 * tri-state `input`, `newKanjiOrder`, `enabled`, the retired modes, and
 * `pitchVoiceId` with the Azure voice ids).
 */
function normalizeConfig(saved: unknown): QuizConfig {
  const base = defaultConfig();
  try {
    if (!saved || typeof saved !== "object") return base;
    const raw = saved as Record<string, unknown>;
    const audioPrompts = bool(raw.audioPrompts, base.audioPrompts);
    // The pre-fonts shape: randomFont true (or absent) meant all of them,
    // false meant the one face the legacy app always drew.
    const stored = Array.isArray(raw.fonts)
      ? raw.fonts.filter((f): f is string => typeof f === "string")
      : [];
    const fonts = stored.length
      ? stored
      : raw.randomFont === false
        ? [JP_FONTS[0]]
        : [...JP_FONTS];
    return {
      mode: base.mode,
      pairResponses: base.pairResponses,
      gridResponses: base.gridResponses,
      audioPrompts,
      ask: askFromAudioPrompts(audioPrompts),
      pitchQuestions: bool(raw.pitchQuestions, base.pitchQuestions),
      length: raw.length === "endless" ? "endless" : "limited",
      limType: raw.limType === "count" ? "count" : "cov",
      limCount: num(raw.limCount, base.limCount),
      retries: raw.retries === "none" || raw.retries === "unl" ? raw.retries : "lim",
      retryN: num(raw.retryN, base.retryN),
      timer: bool(raw.timer, base.timer),
      timerSec: num(raw.timerSec, base.timerSec),
      fonts,
      skyAccent: typeof raw.skyAccent === "string" ? raw.skyAccent : base.skyAccent,
      // A saved legacy id (the retired "Auto" of "", a pre-SAK-100 Azure name,
      // or garbage) is not a roster voice, so it falls back to the default.
      voiceName: typeof raw.voiceName === "string" && isVoiceId(raw.voiceName) ? raw.voiceName : base.voiceName,
      graduateRuns: num(raw.graduateRuns, base.graduateRuns),
      restFirstMin: num(raw.restFirstMin, base.restFirstMin),
      restThenMin: num(raw.restThenMin, base.restThenMin),
    };
  } catch {
    // corrupt storage — fall through to defaults
    return base;
  }
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
      setCfg((prev) => ({ ...fn(prev),  })),
    [],
  );
  const update = useCallback(
    (patch: Partial<QuizConfig>) =>
      setCfg((prev) => ({ ...prev, ...patch,  })),
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
