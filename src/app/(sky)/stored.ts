"use client";

// A value kept in the browser, read the way React likes an outside store
// read: nothing on the server, the stored text on the client, re-read when
// it is written from anywhere on the page. Shared by practice (its saved
// recipes and misses) and the quiz (the rest between rounds).

import { useMemo, useSyncExternalStore } from "react";

const CHANGED = "sky:stored:changed";

export function readStored<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

export function writeStored(key: string, value: unknown) {
  try { if (value === null || value === undefined) window.localStorage.removeItem(key); else window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* a browser with no storage keeps nothing */ }
  window.dispatchEvent(new Event(CHANGED));
}

export function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(
    (onChange) => { window.addEventListener(CHANGED, onChange); window.addEventListener("storage", onChange); return () => { window.removeEventListener(CHANGED, onChange); window.removeEventListener("storage", onChange); }; },
    () => { try { return window.localStorage.getItem(key); } catch { return null; } },
    () => null,
  );
  return useMemo(() => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } }, [raw, fallback]);
}
