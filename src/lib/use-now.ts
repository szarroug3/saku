"use client";

// A ticking clock, for screens whose copy is time-relative.
//
// Two rules it exists to keep:
//
//   Never read the clock during render. The server and the client render at
//   different instants, so `Date.now()` in a render body is a hydration
//   mismatch waiting to happen — and React's own lint rejects it outright as
//   an impure call. Here the clock is state, seeded post-mount.
//
//   One interval per screen, not one per component. The rest screen's digits
//   and the bar above them are the same clock; two components each running
//   their own `setInterval` would drift apart on screen for no reason.
//
// Returns null until mounted, which is the honest answer: on the server there
// is no "now" that will still be true when this paints.

import { useEffect, useState } from "react";

export function useNow(active: boolean, everyMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    // Seeded here, not in useState's initialiser, for the hydration reason
    // above: the first paint must match what the server sent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs]);

  return now;
}
