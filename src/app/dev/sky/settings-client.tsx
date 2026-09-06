"use client";

// Settings' client side: the Sky's page over the app's own config store,
// so the app and the Sky read one set of settings. The mapping between the
// Sky's words and QuizConfig's fields lives here and nowhere else.

import { useMemo } from "react";

import { askFromAudioPrompts } from "@/lib/ask-config";
import { fontLabel, JP_FONTS } from "@/lib/config";
import { availableFonts } from "@/lib/font-detect";
import { useQuizConfig } from "@/lib/quiz-config";
import { VOICES, voicesEnabled } from "@/lib/voice";
import { SkySettings } from "@/sky/components/sky-settings";
import type { Retries, SkySettings as SkySettingsValues } from "@/sky/lib/settings";
import type { QuizConfig } from "@/types";

import { Tip } from "./quiz-client";

const RETRIES_TO_APP: Record<Retries, QuizConfig["retries"]> = { none: "none", limited: "lim", unlimited: "unl" };
const RETRIES_FROM_APP: Record<QuizConfig["retries"], Retries> = { none: "none", lim: "limited", unl: "unlimited" };

/** The app's config in the Sky's words. */
export function fromConfig(cfg: QuizConfig): SkySettingsValues {
  return {
    audioPrompts: cfg.audioPrompts,
    pitchQuestions: cfg.pitchQuestions,
    voice: cfg.voiceName,
    retries: RETRIES_FROM_APP[cfg.retries],
    retryCount: cfg.retryN,
    timer: cfg.timer,
    timerSeconds: cfg.timerSec,
    accent: cfg.skyAccent ?? "pink",
    fonts: cfg.fonts,
    showVolume: cfg.showVolume,
    cleanRunsToClearMixup: cfg.graduateRuns,
  };
}

/** A change in the Sky's words as the app's config patch. */
export function toConfig(patch: Partial<SkySettingsValues>): Partial<QuizConfig> {
  const out: Partial<QuizConfig> = {};
  if (patch.audioPrompts !== undefined) { out.audioPrompts = patch.audioPrompts; out.ask = askFromAudioPrompts(patch.audioPrompts); }
  if (patch.pitchQuestions !== undefined) out.pitchQuestions = patch.pitchQuestions;
  if (patch.voice !== undefined) out.voiceName = patch.voice;
  if (patch.retries !== undefined) out.retries = RETRIES_TO_APP[patch.retries];
  if (patch.retryCount !== undefined) out.retryN = patch.retryCount;
  if (patch.timer !== undefined) out.timer = patch.timer;
  if (patch.timerSeconds !== undefined) out.timerSec = patch.timerSeconds;
  if (patch.accent !== undefined) out.skyAccent = patch.accent;
  if (patch.fonts !== undefined) out.fonts = [...patch.fonts];
  if (patch.showVolume !== undefined) out.showVolume = patch.showVolume;
  if (patch.cleanRunsToClearMixup !== undefined) out.graduateRuns = patch.cleanRunsToClearMixup;
  return out;
}

/** The voices by name (Sam, 2026-09-06), not the roster's order. */
const VOICES_BY_NAME = [...VOICES].sort((a, b) => a.label.localeCompare(b.label)).map((v) => ({ id: v.id, label: v.label }));

export function SettingsClient() {
  const { cfg, update, ready } = useQuizConfig();
  // the fonts actually installed here, measured once the page is on a client
  const fonts = useMemo(() => (ready ? availableFonts(JP_FONTS).map((family) => ({ family, label: fontLabel(family) })) : []), [ready]);
  return (
    <SkySettings
      settings={fromConfig(cfg)}
      onChange={(patch) => update(toConfig(patch))}
      voices={VOICES_BY_NAME}
      voicesEnabled={voicesEnabled()}
      fonts={fonts}
      tip={Tip}
      height="100%"
    />
  );
}
