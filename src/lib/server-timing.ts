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

/** From the edge receiving the request (the proxy stamps `x-edge-at`) to
 * now: on a warm process a few tens of milliseconds of routing, on a cold
 * one the load of every module the route needs, which is the cold start
 * itself and which nothing inside those modules can time (SAK-399). Empty
 * when the request did not come through the proxy. */
export function edgeToPage(edgeAt: string | null | undefined): Phase[] {
  const at = Number(edgeAt ?? 0);
  return at ? [{ name: "edge-to-page", ms: Date.now() - at, desc: "from the edge receiving the request to the page rendering" }] : [];
}

/** This request's phases so far, as a `Server-Timing` value. Empty when
 * nothing was measured. */
export function serverTimingValue(extra: readonly Phase[] = []): string {
  return [...extra, ...phasesOf(), ...bootPhases()]
    .map((p) => `${p.name};dur=${p.ms.toFixed(1)}${p.desc ? `;desc="${p.desc.replace(/"/g, "")}"` : ""}`)
    .join(", ");
}

/** How long this process had been alive when it answered, and whether this was
 * the first thing it answered.
 *
 * Read it as a flag, not as a cost. It was `boot` at first, on the assumption
 * that a process starts when a request arrives, so its age at the first
 * request is what booting took. Fluid Compute breaks that: it holds processes
 * ready, so the first request a process serves can be a hundred seconds into
 * its life without having waited a moment for it — which is exactly what the
 * deployed app reported. What the number still tells you is whether a request
 * was the first of its process, which is the one that pays for anything the
 * modules do lazily. */
let served = 0;
export function bootPhases(): Phase[] {
  const first = served++ === 0;
  const up = typeof process !== "undefined" && typeof process.uptime === "function" ? process.uptime() * 1000 : 0;
  if (!up) return [];
  const where = process.env.VERCEL_REGION;
  return [...(where ? [{ name: "region", ms: 0, desc: `this page was built in ${where}` }] : []), {
    name: first ? "first" : "uptime",
    ms: up,
    desc: first
      ? "the first request of this process, which had been alive this long already"
      : "how long this process has been up",
  }];
}

/** Format phases measured outside a request scope (the proxy). */
export function formatPhases(phases: readonly Phase[]): string {
  return phases
    .map((p) => `${p.name};dur=${p.ms.toFixed(1)}${p.desc ? `;desc="${p.desc.replace(/"/g, "")}"` : ""}`)
    .join(", ");
}
