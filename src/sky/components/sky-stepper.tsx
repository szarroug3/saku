"use client";

// A number between its own minus and plus, in the chip's shape: how many
// cards a practice deck holds, how many minutes a break is. Typed or
// stepped; a half-typed number is not a change, and an empty box goes back
// to the value on blur. Sam, 2026-09-06: the browser's spinner was not pretty.

import { useState } from "react";

import { SkyInput } from "@/sky/components/sky-input";

export interface SkyStepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  /** What the number is of, after the box: "minutes". */
  unit?: string;
  className?: string;
}

export function SkyStepper({ value, onChange, label, min = 1, max = Number.POSITIVE_INFINITY, unit, className = "" }: SkyStepperProps) {
  // what is being typed, and the value it was typed over: once the value
  // moves on (a step, a recipe loaded) the box shows the value again
  const [edit, setEdit] = useState<{ over: number; text: string } | null>(null);
  const text = edit && edit.over === value ? edit.text : String(value);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (n: number) => { if (Number.isFinite(n)) onChange(clamp(n)); };
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex h-[26px] items-stretch overflow-hidden rounded-full border border-sky-line text-[12px] font-semibold">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => commit(value - 1)} className="px-2.5 text-sky-muted hover:bg-sky-card hover:text-sky-ink disabled:cursor-not-allowed disabled:opacity-40">−</button>
        <SkyInput
          type="number" min={min} max={Number.isFinite(max) ? max : undefined} step={1} inputMode="numeric" aria-label={label}
          value={text}
          onChange={(e) => { setEdit({ over: value, text: e.target.value }); const n = parseInt(e.target.value, 10); if (n >= min) commit(n); }}
          onBlur={() => setEdit(null)}
          className="w-11 !rounded-none !border-x !border-y-0 !border-sky-line !bg-transparent !px-1 !py-0 text-center !text-[12px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => commit(value + 1)} className="px-2.5 text-sky-muted hover:bg-sky-card hover:text-sky-ink disabled:cursor-not-allowed disabled:opacity-40">+</button>
      </span>
      {unit && <span className="text-[12px] text-sky-muted">{unit}</span>}
    </span>
  );
}
