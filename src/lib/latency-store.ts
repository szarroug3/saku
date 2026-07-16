"use client";

// Where your recall-latency baseline lives.
//
// localStorage rather than history.json, deliberately. This is a DERIVED
// rolling baseline, not practice history: it answers "how fast is this person
// usually", it self-heals in a handful of answers if lost, and it changes on
// every single card — which would mean writing history.json a few hundred
// times a session for data nobody wants to read. history.json stays the
// record of what you practised; this stays a tuning number.

import type { LatencyStyle, LatencyWindow } from "@/lib/slow";
import { recordLatency } from "@/lib/slow";

const KEY = "kanaquiz-latency";

export function loadLatencies(): LatencyWindow {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    // Trust nothing: a hand-edited or half-written value must not poison the
    // threshold. Anything that isn't a finite positive number is dropped.
    const out: LatencyWindow = {};
    for (const style of ["typed", "mc"] as LatencyStyle[]) {
      const xs = (parsed as Record<string, unknown>)[style];
      if (Array.isArray(xs)) {
        const clean = xs.filter(
          (x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0,
        );
        if (clean.length) out[style] = clean;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Append one latency and persist. Returns the new window. */
export function pushLatency(
  window: LatencyWindow,
  style: LatencyStyle,
  latencyMs: number,
): LatencyWindow {
  const next = recordLatency(window, style, latencyMs);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — the baseline just stays in memory for this session
  }
  return next;
}
