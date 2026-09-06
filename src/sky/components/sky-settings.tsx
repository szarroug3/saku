"use client";

// Settings: how Saku should behave, one row per setting, the label on the
// left and its control on the right, in groups. Tracked under Sky: Settings.
// A pure view: the route hands in the values and takes a patch back.

import type { ReactNode } from "react";

import { ChipRow } from "@/sky/components/chip-row";
import { SkyChip } from "@/sky/components/sky-button";
import { SkyInfo } from "@/sky/components/sky-info";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { SkyToggle } from "@/sky/components/sky-toggle";
import { SETTING_GROUPS, SETTING_TEXT, SKY_ACCENTS, type FontChoice, type SkySettings, type VoiceChoice } from "@/sky/lib/settings";

export interface SkySettingsProps {
  settings: SkySettings;
  onChange: (patch: Partial<SkySettings>) => void;
  voices: readonly VoiceChoice[];
  /** Whether the voices can be heard at all here. */
  voicesEnabled?: boolean;
  /** The kana faces installed on this machine; the row hides when none are. */
  fonts: readonly FontChoice[];
  height?: string;
}

/** What a font chip shows: the face is the label. */
const FONT_SAMPLE = "あき";

export function SkySettings({ settings, onChange, voices, voicesEnabled = true, fonts, height }: SkySettingsProps) {
  const s = settings;
  const text = (key: keyof SkySettings) => SETTING_TEXT[key];
  const Row = ({ k, dim = false, children }: { k: keyof SkySettings; dim?: boolean; children: ReactNode }) => (
    <div className={`flex flex-col items-start gap-2 border-t border-sky-line py-3 first:border-t-0 md:flex-row md:items-center md:justify-between md:gap-6 ${dim ? "opacity-50" : ""}`}>
      <span className="flex items-center text-[14px] text-sky-ink">
        {text(k).label}
        {text(k).info && <SkyInfo className="ml-1.5" label={`About ${text(k).label.toLowerCase()}`}>{text(k).info}</SkyInfo>}
      </span>
      <span className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{children}</span>
    </div>
  );
  const toggle = (k: "audioPrompts" | "pitchQuestions" | "timer", dim = false) => (
    <Row key={k} k={k} dim={dim}><SkyToggle on={s[k]} onClick={() => onChange({ [k]: !s[k] })} label={text(k).label} /></Row>
  );
  const toggleFont = (family: string) => onChange({ fonts: s.fonts.includes(family) ? s.fonts.filter((f) => f !== family) : [...s.fonts, family] });
  const control: Record<keyof SkySettings, () => ReactNode> = {
    audioPrompts: () => toggle("audioPrompts"),
    pitchQuestions: () => toggle("pitchQuestions", !s.audioPrompts),
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
    accent: () => (
      <Row key="accent" k="accent">
        <span className="flex flex-wrap gap-2" role="radiogroup" aria-label={text("accent").label}>
          {SKY_ACCENTS.map((a) => (
            <button
              key={a.id} type="button" role="radio" aria-checked={s.accent === a.id} aria-label={a.label} title={a.label}
              onClick={() => onChange({ accent: a.id })}
              className={`h-[22px] w-[22px] rounded-full border-2 transition-transform ${s.accent === a.id ? "scale-110 border-sky-ink" : "border-transparent hover:border-sky-muted"}`}
              style={{ backgroundColor: a.color }}
            />
          ))}
        </span>
      </Row>
    ),
    fonts: () => fonts.length === 0 ? null : (
      <Row key="fonts" k="fonts">
        <span className="flex flex-wrap gap-2">
          {fonts.map((f) => {
            const on = s.fonts.includes(f.family);
            return (
              <button
                key={f.family} type="button" aria-pressed={on} aria-label={f.label} title={f.label}
                onClick={() => toggleFont(f.family)}
                style={{ fontFamily: f.family }}
                className={`h-[26px] rounded-full border px-3 text-[15px] leading-none ${on ? "border-sky-accent bg-sky-accent text-sky-accent-ink" : "border-sky-line text-sky-muted hover:border-sky-accent hover:text-sky-ink"}`}
              >
                {FONT_SAMPLE}
              </button>
            );
          })}
        </span>
      </Row>
    ),
    cleanRunsToClearMixup: () => <Row key="clean" k="cleanRunsToClearMixup"><SkyStepper value={s.cleanRunsToClearMixup} onChange={(n) => onChange({ cleanRunsToClearMixup: n })} label={text("cleanRunsToClearMixup").label} min={1} max={50} unit="runs" /></Row>,
  };

  return (
    <SkyPageShell eyebrow="Settings" title="How should Saku behave?" height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        {SETTING_GROUPS.map((g) => {
          const rows = g.keys.map((k) => control[k]()).filter(Boolean);
          return rows.length ? <SkyPanel key={g.title} title={g.title}><div className="mt-1">{rows}</div></SkyPanel> : null;
        })}
      </div>
    </SkyPageShell>
  );
}
