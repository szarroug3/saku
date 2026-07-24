"use client";

// Where your recall-latency baseline lives.
//
// localStorage rather than history.json, deliberately. This is a DERIVED
// rolling baseline, not practice history: it answers "how fast is this person
// usually", it self-heals in a handful of answers if lost, and it changes on
// every single card — which would mean writing history.json a few hundred
// times a session for data nobody wants to read. history.json stays the
// record of what you practised; this stays a tuning number.

import { LATENCY_KEY, OLD_LATENCY_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import type { LatencyStyle, LatencyWindow } from "@/lib/slow";
import { recordLatency } from "@/lib/slow";
import { migratedGet } from "@/lib/storage-migrate";

const KEY = LATENCY_KEY;

// The baseline changes on EVERY answered card, so it must NOT POST every card —
// that is the write-storm the whole "latency lives in localStorage, not
// history.json" design exists to avoid. It is a derived, self-healing number, so
// a server copy that is a little behind costs nothing: it is seeded and
// reconciled on load and replayed once on sign-in, and between those it syncs at
// most this often. The last few cards before a reload may not reach the server;
// they self-heal in a handful of answers on the next session.
const LATENCY_PUSH_INTERVAL_MS = 20_000;
let lastLatencyPush = 0;

export function loadLatencies(): LatencyWindow {
  if (typeof window === "undefined") return {};
  try {
    const raw = migratedGet(localStorage, KEY, OLD_LATENCY_KEY);
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
  // Sync to the server, throttled (see LATENCY_PUSH_INTERVAL_MS) so a session of
  // hundreds of cards is a handful of POSTs, not one per answer.
  const now = Date.now();
  if (now - lastLatencyPush >= LATENCY_PUSH_INTERVAL_MS) {
    lastLatencyPush = now;
    pushSettings({ latency: next });
  }
  return next;
}
