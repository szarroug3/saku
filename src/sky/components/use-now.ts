"use client";

// The clock, for anything on screen that counts down.
//
// A render may not read the clock: the same render on the server and in the
// browser would read two different numbers, and a component that is not the
// same twice is not a component (the app's purity rule, and React's). So the
// clock is state, set from an effect, and null until there is a browser to
// ask. A caller draws whatever it can say without a clock while it is null.
//
// The break screen counts every second; a line that says how many MINUTES are
// left needs far less, so each caller says how often it wants to be woken.
//
// It was the break screen's own private hook until SAK-444 put the break in
// the saved place, which put "3 min left" on the Continue button and in the
// Unfinished row as well.

import { useEffect, useState } from "react";

/** The time now, or null before the first read in the browser. */
export function useNow(everyMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
