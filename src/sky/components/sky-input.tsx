"use client";

// The one text box the Sky types into: the Atlas's search and the Quiz's
// answer. One look, so a box reads as a box wherever it is.

import { forwardRef, type InputHTMLAttributes } from "react";

const BOX = "min-w-0 rounded-xl border border-sky-muted/45 bg-sky-card px-4 py-2.5 text-[16px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none";

export const SkyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SkyInput({ className = "", ...props }, ref) {
  return <input ref={ref} autoComplete="off" autoCapitalize="off" spellCheck={false} {...props} className={`${BOX} ${className}`} />;
});
