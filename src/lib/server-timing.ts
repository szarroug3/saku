// Where a request's time went, in the browser's own network panel.
//
// A page that takes 1.2 seconds tells you nothing about why. The session
// refresh, the history read, the settings read and the work of building the
// page are all inside one response, and from the outside they are one number.
// This splits them.
//
// Two halves, because Next gives a page no way to set a response header:
//
//   - The proxy (src/proxy.ts) runs before rendering and CAN set one, so what
//     it does — refreshing the Supabase session on every request — goes out as
//     a real `Server-Timing` header and shows up under Timing in the network
//     panel with no tooling at all.
//   - A page measures its own phases and renders them as a `<meta>` in the
//     same format. React hoists it into the head, so it arrives with the
//     stream. `document.querySelector('meta[name=server-timing]').content`
//     reads it, and the timePage snippet prints it.
//
// Cheap enough to leave on: a handful of performance.now() calls per request
// and about eighty bytes of head. Diagnosing this in production is the only
// way to diagnose it at all, since a laptop is nothing like the function.

import { cache } from "react";

export interface Phase {
  name: string;
  ms: number;
  desc?: string;
}

/** One request's phases. `cache` scopes it to the request, so a layout and the
 * page inside it write to the same list. */
const phasesOf = cache((): Phase[] => []);

/** Run `work`, and remember how long it took under `name`. */
export async function timed<T>(name: string, work: () => Promise<T>, desc?: string): Promise<T> {
  const started = performance.now();
  try {
    return await work();
  } finally {
    phasesOf().push({ name, ms: performance.now() - started, ...(desc ? { desc } : {}) });
  }
}

/** The same, for work that is not a promise. */
export function timedSync<T>(name: string, work: () => T, desc?: string): T {
  const started = performance.now();
  try {
    return work();
  } finally {
    phasesOf().push({ name, ms: performance.now() - started, ...(desc ? { desc } : {}) });
  }
}

/** This request's phases so far, as a `Server-Timing` value. Empty when
 * nothing was measured. */
export function serverTimingValue(extra: readonly Phase[] = []): string {
  return [...extra, ...phasesOf()]
    .map((p) => `${p.name};dur=${p.ms.toFixed(1)}${p.desc ? `;desc="${p.desc.replace(/"/g, "")}"` : ""}`)
    .join(", ");
}

/** Format phases measured outside a request scope (the proxy). */
export function formatPhases(phases: readonly Phase[]): string {
  return phases
    .map((p) => `${p.name};dur=${p.ms.toFixed(1)}${p.desc ? `;desc="${p.desc.replace(/"/g, "")}"` : ""}`)
    .join(", ");
}
