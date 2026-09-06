"use client";

// Settings' client side: the Sky's page over the app's own config store,
// so the app and the Sky read one set of settings. The mapping between the
// Sky's words and QuizConfig's fields lives here and nowhere else.

import { askFromAudioPrompts } from "@/lib/ask-config";
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
    requeue: cfg.requeue,
    retries: RETRIES_FROM_APP[cfg.retries],
    retryCount: cfg.retryN,
    showAnswer: cfg.showAnswer,
    timer: cfg.timer,
    timerSeconds: cfg.timerSec,
    scriptLabel: cfg.scriptLabel,
    submitOnBlur: cfg.blurSubmit,
    voice: cfg.voiceName,
    firstBreakMinutes: cfg.restFirstMin,
    laterBreakMinutes: cfg.restThenMin,
    showVolume: cfg.showVolume,
    cleanRunsToClearMixup: cfg.graduateRuns,
  };
}

/** A change in the Sky's words as the app's config patch. */
export function toConfig(patch: Partial<SkySettingsValues>): Partial<QuizConfig> {
  const out: Partial<QuizConfig> = {};
  if (patch.audioPrompts !== undefined) { out.audioPrompts = patch.audioPrompts; out.ask = askFromAudioPrompts(patch.audioPrompts); }
  if (patch.pitchQuestions !== undefined) out.pitchQuestions = patch.pitchQuestions;
  if (patch.requeue !== undefined) out.requeue = patch.requeue;
  if (patch.retries !== undefined) out.retries = RETRIES_TO_APP[patch.retries];
  if (patch.retryCount !== undefined) out.retryN = patch.retryCount;
  if (patch.showAnswer !== undefined) out.showAnswer = patch.showAnswer;
  if (patch.timer !== undefined) out.timer = patch.timer;
  if (patch.timerSeconds !== undefined) out.timerSec = patch.timerSeconds;
  if (patch.scriptLabel !== undefined) out.scriptLabel = patch.scriptLabel;
  if (patch.submitOnBlur !== undefined) out.blurSubmit = patch.submitOnBlur;
  if (patch.voice !== undefined) out.voiceName = patch.voice;
  if (patch.firstBreakMinutes !== undefined) out.restFirstMin = patch.firstBreakMinutes;
  if (patch.laterBreakMinutes !== undefined) out.restThenMin = patch.laterBreakMinutes;
  if (patch.showVolume !== undefined) out.showVolume = patch.showVolume;
  if (patch.cleanRunsToClearMixup !== undefined) out.graduateRuns = patch.cleanRunsToClearMixup;
  return out;
}

export function SettingsClient({ signedIn }: { signedIn: boolean }) {
  const { cfg, update, ready } = useQuizConfig();
  return (
    <SkySettings
      settings={fromConfig(cfg)}
      onChange={(patch) => update(toConfig(patch))}
      voices={VOICES.map((v) => ({ id: v.id, label: v.label }))}
      voicesEnabled={voicesEnabled()}
      note={!ready ? undefined : signedIn ? "Saved as you go, on every device you sign in on." : "Saved as you go, in this browser. Sign in to keep them across devices."}
      tip={Tip}
      height="100%"
    />
  );
}
