"use client";

// Settings: how Saku should behave, one row per setting, the label on the
// left and its control on the right, in groups. Tracked under Sky: Settings.
// A pure view: the route hands in the values and takes a patch back, and
// says "Saved" itself, since it is the one that knows.

import type { ComponentType, ReactNode } from "react";

import { ChipRow } from "@/sky/components/chip-row";
import { SkyChip } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { SkyToggle } from "@/sky/components/sky-toggle";
import { RETRIES, SETTING_GROUPS, SETTING_TEXT, type Retries, type SkySettings, type VoiceChoice } from "@/sky/lib/settings";

export interface SkySettingsProps {
  settings: SkySettings;
  onChange: (patch: Partial<SkySettings>) => void;
  voices: readonly VoiceChoice[];
  /** Whether the voices can be heard at all here. */
  voicesEnabled?: boolean;
  /** "Saved as you go", "Saved in this browser only", or nothing. */
  note?: string;
  tip?: ComponentType<{ label: string; children: ReactNode }>;
  height?: string;
}

export function SkySettings({ settings, onChange, voices, voicesEnabled = true, note, tip: Tip, height }: SkySettingsProps) {
  const s = settings;
  const text = (key: keyof SkySettings) => SETTING_TEXT[key];
  const Row = ({ k, dim = false, children }: { k: keyof SkySettings; dim?: boolean; children: ReactNode }) => (
    <div className={`flex items-center justify-between gap-6 border-t border-sky-line py-3 first:border-t-0 ${dim ? "opacity-50" : ""}`}>
      <span className="flex items-center text-[14px] text-sky-ink">
        {text(k).label}
        {Tip && text(k).info && <Tip label={`About ${text(k).label.toLowerCase()}`}>{text(k).info}</Tip>}
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</span>
    </div>
  );
  const toggle = (k: "audioPrompts" | "pitchQuestions" | "requeue" | "showAnswer" | "timer" | "scriptLabel" | "submitOnBlur" | "showVolume", dim = false) => (
    <Row key={k} k={k} dim={dim}><SkyToggle on={s[k]} onClick={() => onChange({ [k]: !s[k] })} label={text(k).label} /></Row>
  );
  const control: Record<keyof SkySettings, () => ReactNode> = {
    audioPrompts: () => toggle("audioPrompts"),
    pitchQuestions: () => toggle("pitchQuestions", !s.audioPrompts),
    requeue: () => toggle("requeue"),
    showAnswer: () => toggle("showAnswer"),
    scriptLabel: () => toggle("scriptLabel"),
    submitOnBlur: () => toggle("submitOnBlur"),
    showVolume: () => toggle("showVolume"),
    retries: () => (
      <Row key="retries" k="retries">
        <ChipRow>
          {(Object.keys(RETRIES) as Retries[]).map((r) => <SkyChip key={r} on={s.retries === r} onClick={() => onChange({ retries: r })}>{RETRIES[r]}</SkyChip>)}
        </ChipRow>
        {s.retries === "limited" && <SkyStepper value={s.retryCount} onChange={(n) => onChange({ retryCount: n })} label={text("retryCount").label} min={1} max={9} />}
      </Row>
    ),
    retryCount: () => null,
    timer: () => (
      <Row key="timer" k="timer">
        <SkyToggle on={s.timer} onClick={() => onChange({ timer: !s.timer })} label={text("timer").label} />
        {s.timer && <SkyStepper value={s.timerSeconds} onChange={(n) => onChange({ timerSeconds: n })} label={text("timerSeconds").label} min={1} max={600} unit="seconds" />}
      </Row>
    ),
    timerSeconds: () => null,
    voice: () => (
      <Row key="voice" k="voice" dim={!s.audioPrompts}>
        {voicesEnabled ? (
          <ChipRow>{voices.map((v) => <SkyChip key={v.id} on={s.voice === v.id} onClick={() => onChange({ voice: v.id })}>{v.label}</SkyChip>)}</ChipRow>
        ) : <span className="text-[12px] text-sky-muted">No voice audio configured</span>}
      </Row>
    ),
    firstBreakMinutes: () => <Row key="first" k="firstBreakMinutes"><SkyStepper value={s.firstBreakMinutes} onChange={(n) => onChange({ firstBreakMinutes: n })} label={text("firstBreakMinutes").label} min={0} max={120} unit="minutes" /></Row>,
    laterBreakMinutes: () => <Row key="later" k="laterBreakMinutes"><SkyStepper value={s.laterBreakMinutes} onChange={(n) => onChange({ laterBreakMinutes: n })} label={text("laterBreakMinutes").label} min={0} max={240} unit="minutes" /></Row>,
    cleanRunsToClearMixup: () => <Row key="clean" k="cleanRunsToClearMixup"><SkyStepper value={s.cleanRunsToClearMixup} onChange={(n) => onChange({ cleanRunsToClearMixup: n })} label={text("cleanRunsToClearMixup").label} min={1} max={50} unit="runs" /></Row>,
  };

  return (
    <SkyPageShell eyebrow="Settings" title="How should Saku behave?" height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        {note && <p className="text-[13px] text-sky-muted">{note}</p>}
        {SETTING_GROUPS.map((g) => (
          <SkyPanel key={g.title} title={g.title} className="max-w-3xl">
            <div className="mt-1">{g.keys.map((k) => control[k]())}</div>
          </SkyPanel>
        ))}
      </div>
    </SkyPageShell>
  );
}

