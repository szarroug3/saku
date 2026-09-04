"use client";

// A switch for the wash: the baked bitmap that ships, the live CSS gradients
// for tuning, and three modes that isolate a cost (nothing, stars only,
// gradients only). It sets data-wash on <html>; sky-wash.css does the rest.
// Dev pages only. Measured 2026-09-04: "gradients only" is the one that lags.

import { useEffect, useState } from "react";

const MODES = [
  ["", "baked"],
  ["live", "live CSS"],
  ["off", "off"],
  ["stars", "stars only"],
  ["gradients", "gradients only"],
] as const;

/** `initial` picks the starting mode: the wash page tunes in "live", so edits
 * show on save; the token gallery shows what ships, the baked bitmap.
 * `onChange` reports the mode, so a page can show or hide things that only
 * make sense in one of them (the editor only edits the live CSS). */
export type WashMode = (typeof MODES)[number][0];

export function WashSwitch({ initial = "", onChange }: { initial?: WashMode; onChange?: (mode: WashMode) => void }) {
  const [mode, setMode] = useState<WashMode>(initial);
  useEffect(() => {
    if (mode) document.documentElement.dataset.wash = mode;
    else delete document.documentElement.dataset.wash;
    onChange?.(mode);
    return () => { delete document.documentElement.dataset.wash; };
  }, [mode, onChange]);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 rounded-full border border-sky-line bg-sky-card-strong p-1 font-sky-ui text-[12px] text-sky-muted">
      <span className="px-2">wash</span>
      {MODES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
          className={`rounded-full px-2.5 py-1 ${mode === value ? "bg-sky-ink text-sky-ground-0" : "hover:text-sky-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
